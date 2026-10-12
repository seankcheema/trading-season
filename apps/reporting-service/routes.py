"""
Reporting API routes: the caller's profile, the report runs produced from the
trade-events files, and the console's views of activity, orders and
customers (console.py).

Nothing here reaches the trading database. The runs are files the consumer
wrote; the profile and the console are read from the read model, which this
process builds from the consumer's event files (read_model.py).

The profile is the caller's own and needs only a valid token. Everything else
covers every account on the platform. The report runs are served to analysts
and admins; the console, which shows individual customers and their orders,
to admins only.
"""

import logging
import uuid
from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory

from app import ADMIN_ROLE, REPORT_READER_ROLES, require_auth, require_role
from models import User, db
from read_model import read_model
import console
import run_store

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api/reporting')


def _files_dir():
    return current_app.config['REPORTING_FILES_DIR']


def _now():
    return datetime.now(timezone.utc).isoformat()


def reads_read_model(f):
    """
    Run the endpoint against an up-to-date read model. Place it under the
    auth decorators, so a refused caller costs nothing. The tables have one
    connection, so the lock is held until the session has let go of it.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        with read_model.lock:
            try:
                read_model.sync(db.session, _files_dir())
                return f(*args, **kwargs)
            finally:
                db.session.rollback()

    return decorated_function


@api_bp.route('/profile', methods=['GET'])
@require_auth
@reads_read_model
def get_user_profile():
    """GET /api/reporting/profile: the caller's trader profile."""
    user = db.session.get(User, g.user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'user_id': str(user.user_id),
        'first_name': user.first_name,
        'last_name': user.last_name,
        'trader_level': user.trader_level,
        'available_funds': float(user.available_funds),
        'timestamp': _now(),
    }), 200


@api_bp.route('/runs', methods=['GET'])
@require_auth
@require_role(*REPORT_READER_ROLES)
def list_runs():
    """GET /api/reporting/runs: every complete report run, newest first."""
    files_dir = _files_dir()
    return jsonify({
        'latest': run_store.latest_run_id(files_dir),
        'runs': run_store.list_runs(files_dir),
        'timestamp': _now(),
    }), 200


@api_bp.route('/runs/latest', methods=['GET'])
@require_auth
@require_role(*REPORT_READER_ROLES)
def latest_report():
    """GET /api/reporting/runs/latest: the latest run's report.json."""
    files_dir = _files_dir()
    run_id = run_store.latest_run_id(files_dir)
    report = run_store.read_report(files_dir, run_id) if run_id else None
    if report is None:
        return jsonify({'error': 'No report has been generated yet'}), 404
    return jsonify(report), 200


@api_bp.route('/runs/<run_id>/files/<name>', methods=['GET'])
@require_auth
@require_role(*REPORT_READER_ROLES)
def run_file(run_id, name):
    """GET /api/reporting/runs/<run_id>/files/<name>: one PNG chart of a run."""
    if not run_store.is_safe_run_id(run_id) or not run_store.is_safe_file_name(name):
        return jsonify({'error': 'Not found'}), 404
    directory = run_store.runs_dir(_files_dir()) / run_id
    if not (directory / name).is_file():
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(directory, name, mimetype='image/png', max_age=0)


@api_bp.route('/scheduler/status', methods=['GET'])
def get_scheduler_status():
    """GET /api/reporting/scheduler/status: when the last run was generated (public, for monitoring)."""
    files_dir = _files_dir()
    run_id = run_store.latest_run_id(files_dir)
    report = run_store.read_report(files_dir, run_id) if run_id else None
    return jsonify({
        'latest_run': run_id,
        'generated_at': report.get('generatedAt') if report else None,
        'interval_minutes': current_app.config['SCHEDULER_INTERVAL_MINUTES'],
        'timestamp': _now(),
    }), 200


# The furthest a time zone sits from UTC, in minutes.
MAX_TZ_OFFSET_MINUTES = 14 * 60


def _whole_number(name, default, low, high):
    """A query parameter as an integer inside [low, high], or None when it is not one."""
    raw = request.args.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return None
    return value if low <= value <= high else None


@api_bp.route('/activity', methods=['GET'])
@require_auth
@require_role(ADMIN_ROLE)
@reads_read_model
def get_activity():
    """GET /api/reporting/activity: platform activity over a range, in the viewer's days."""
    range_key = request.args.get('range', 'today')
    if range_key not in console.RANGES:
        return jsonify({'error': f"range must be one of {', '.join(console.RANGES)}"}), 400
    tz_offset = _whole_number('tzOffset', 0, -MAX_TZ_OFFSET_MINUTES, MAX_TZ_OFFSET_MINUTES)
    if tz_offset is None:
        return jsonify({'error': 'tzOffset must be minutes east of UTC, between -840 and 840'}), 400
    return jsonify(console.activity(db.session, range_key, datetime.now(timezone.utc), tz_offset)), 200


@api_bp.route('/orders', methods=['GET'])
@require_auth
@require_role(ADMIN_ROLE)
@reads_read_model
def list_orders():
    """GET /api/reporting/orders: the newest orders and cash transfers across every account."""
    limit = _whole_number('limit', console.DEFAULT_ORDER_LIMIT, 1, console.MAX_ORDER_LIMIT)
    if limit is None:
        return jsonify({'error': f'limit must be between 1 and {console.MAX_ORDER_LIMIT}'}), 400
    return jsonify(console.orders(db.session, limit)), 200


@api_bp.route('/orders/<int:order_id>', methods=['GET'])
@require_auth
@require_role(ADMIN_ROLE)
@reads_read_model
def get_order(order_id):
    """GET /api/reporting/orders/<order_id>: one order with its ledger impact and audit trail."""
    order = console.order_detail(db.session, order_id)
    if order is None:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify(order), 200


@api_bp.route('/customers', methods=['GET'])
@require_auth
@require_role(ADMIN_ROLE)
@reads_read_model
def list_customers():
    """GET /api/reporting/customers: every trader with their balances and lock status."""
    return jsonify(console.customers(db.session, datetime.now(timezone.utc))), 200


@api_bp.route('/customers/<user_id>', methods=['GET'])
@require_auth
@require_role(ADMIN_ROLE)
@reads_read_model
def get_customer(user_id):
    """GET /api/reporting/customers/<user_id>: one customer with their accounts, orders and transfers."""
    try:
        parsed = uuid.UUID(user_id)
    except ValueError:
        return jsonify({'error': 'Customer not found'}), 404
    found = console.customer(db.session, parsed, datetime.now(timezone.utc))
    if found is None:
        return jsonify({'error': 'Customer not found'}), 404
    return jsonify(found), 200


def init_routes(app):
    """Register routes with Flask app"""
    app.register_blueprint(api_bp)
    logger.info("Registered API routes")
