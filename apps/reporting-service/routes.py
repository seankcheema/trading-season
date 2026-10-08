"""
Reporting API routes: the caller's profile, and the report runs produced
from the trade-events files. Trade data is never read from the database here.

The profile is the caller's own and needs only a valid token. The report runs
cover every account on the platform, so they are served to analysts only.
"""

import logging
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, send_from_directory

from app import REPORT_READER_ROLE, require_auth, require_role
from db_service import UserRepository
import run_store

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api/reporting')


def _files_dir():
    return current_app.config['REPORTING_FILES_DIR']


def _now():
    return datetime.now(timezone.utc).isoformat()


@api_bp.route('/profile', methods=['GET'])
@require_auth
def get_user_profile():
    """GET /api/reporting/profile: the caller's trader profile."""
    user = UserRepository.get_user(g.user_id)
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
@require_role(REPORT_READER_ROLE)
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
@require_role(REPORT_READER_ROLE)
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
@require_role(REPORT_READER_ROLE)
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


def init_routes(app):
    """Register routes with Flask app"""
    app.register_blueprint(api_bp)
    logger.info("Registered API routes")
