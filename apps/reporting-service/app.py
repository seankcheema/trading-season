"""
Trading Season Reporting Service
Python Flask microservice for report runs and the admin console.

Everything it serves comes from Kafka. The consumer process (consumer.py)
writes what it consumes to files; this web process reads those files and
keeps its own read model of them (read_model.py). It has no connection to
the trading database.
"""

import os
import uuid
from pathlib import Path
from flask import Flask, jsonify, request, g, send_from_directory
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect
from datetime import datetime, UTC
import jwt
import requests
from functools import wraps
from config import config
import logging

# The read model's tables; filled from the event files, never from the trading database
from models import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_ROOT = Path(__file__).resolve().parent

# Initialize Flask app
app = Flask(__name__)

# Load configuration
config_name = os.getenv('FLASK_ENV', 'development')
app.config.from_object(config[config_name])

# Configure SQLAlchemy for the read model: an in-memory SQLite database, for
# which Flask-SQLAlchemy keeps one connection shared by every thread.
app.config['SQLALCHEMY_DATABASE_URI'] = app.config['READ_MODEL_URL']
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {}

# Initialize the read model
db.init_app(app)

# Enable CORS for the SPA's bearer-token requests only. This service does not
# use cookie-based auth, so cross-origin credentials stay disabled.
CORS(
    app,
    origins=app.config['CORS_ORIGINS'],
    supports_credentials=False,
    allow_headers=['Authorization', 'Content-Type'],
)

# Enable CSRF protection. It only checks POST, PUT, PATCH and DELETE, so the
# read-only API is unaffected; a state-changing route added later is protected
# by default.
csrf = CSRFProtect(app)


# ============================================================================
# JWT Authentication
# ============================================================================

class JWKSCache:
    """Cache for JWKS from Auth Service"""
    def __init__(self):
        self.keys = None
        self.cached_at = None
        self.cache_ttl = 3600  # 1 hour
    
    def get_keys(self):
        """Fetch JWKS with caching"""
        now = datetime.now()
        if self.keys is None or (now - self.cached_at).total_seconds() > self.cache_ttl:
            try:
                response = requests.get(
                    app.config['AUTH_JWKS_URL'],
                    timeout=5
                )
                response.raise_for_status()
                self.keys = response.json()['keys']
                self.cached_at = now
                logger.info("JWKS cache refreshed")
            except Exception as e:
                logger.error(f"Failed to fetch JWKS: {e}")
                raise
        return self.keys


jwks_cache = JWKSCache()


def candidate_keys(keys, kid):
    """
    The JWKS keys a token may have been signed with. A token that names a
    key id gets exactly that key. The auth service signs its tokens without a
    key id, so such a token is checked against every published key, the same
    way the Java services' JWKS verifier does.
    """
    if kid is None:
        return list(keys)
    return [k for k in keys if k.get('kid') == kid]


def verify_token(token):
    """Verify JWT token and return decoded payload"""
    try:
        from jwt.algorithms import RSAAlgorithm

        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')

        candidates = candidate_keys(jwks_cache.get_keys(), kid)
        if not candidates:
            raise ValueError(f"Key {kid} not found in JWKS")

        last_signature_error = None
        for key in candidates:
            public_key = RSAAlgorithm.from_jwk(key)
            try:
                return jwt.decode(
                    token,
                    public_key,
                    algorithms=[app.config['JWT_ALGORITHM']],
                    issuer=app.config['AUTH_JWT_ISSUER'],
                    options={'verify_exp': True}
                )
            except jwt.InvalidSignatureError as e:
                # Not this key; a token without a kid may match a later one.
                last_signature_error = e
        raise last_signature_error

    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError as e:
        raise ValueError(f"Invalid token: {e}")
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise ValueError(f"Token verification failed: {e}")


def require_auth(f):
    """Decorator to require valid Bearer token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization header'}), 401
        
        token = auth_header.split(' ')[1]
        try:
            decoded = verify_token(token)
            g.user = decoded

            user_id = decoded.get('sub')
            if isinstance(user_id, str):
                user_id = uuid.UUID(user_id)

            g.user_id = user_id
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function


# Who may read what. The auth service puts the account's role in the token's
# `roles` claim; registration only ever issues TRADER. An admin reads
# everything; an analyst reads the report runs and nothing else.
ADMIN_ROLE = 'ADMIN'
REPORT_READER_ROLES = ('ANALYST', ADMIN_ROLE)


def require_role(*allowed):
    """
    Decorator to require one of the given roles in the verified token's
    `roles` claim. Place it under @require_auth, which verifies the token and
    sets g.user. A valid token without any of them is 403, not 401: the caller
    is known, just not allowed.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            roles = g.user.get('roles')
            if not isinstance(roles, list) or not any(role in roles for role in allowed):
                return jsonify({'error': f'The {" or ".join(allowed)} role is required'}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator


# ============================================================================
# Health Check
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Service health check endpoint (public, no auth required)"""
    try:
        # Verify the read model can be brought up to date from the event files
        from read_model import read_model
        with read_model.lock:
            try:
                read_model.sync(db.session, app.config['REPORTING_FILES_DIR'])
            finally:
                db.session.rollback()

        return jsonify({
            'status': 'healthy',
            'service': 'reporting-service',
            'timestamp': datetime.now(UTC).isoformat(),
            'version': '0.1.0'
        }), 200
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'service': 'reporting-service',
            'error': str(e),
            'timestamp': datetime.now(UTC).isoformat()
        }), 503


@app.route('/openapi.yaml', methods=['GET'])
def openapi_spec():
    """Serve the static OpenAPI specification for this service."""
    return send_from_directory(APP_ROOT, 'openapi.yaml', mimetype='application/yaml')


@app.route('/docs', methods=['GET'])
def swagger_ui():
    """Serve Swagger UI for the reporting service."""
    return send_from_directory(APP_ROOT, 'swagger-ui.html')


# ============================================================================
# Root Endpoint
# ============================================================================

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with service metadata and documentation links."""
    return jsonify({
        'service': 'Trading Season Reporting Service',
        'status': 'initialized',
        'version': '0.1.0',
        'description': 'Report runs and the admin console, both built from Kafka topics',
        'documentation': '/docs',
        'openapi': '/openapi.yaml',
        'health': '/health',
        'api_endpoints': {
            'profile': 'GET /api/reporting/profile',
            'runs': 'GET /api/reporting/runs',
            'latest_report': 'GET /api/reporting/runs/latest',
            'run_file': 'GET /api/reporting/runs/{runId}/files/{name}',
            'scheduler_status': 'GET /api/reporting/scheduler/status',
            'activity': 'GET /api/reporting/activity',
            'orders': 'GET /api/reporting/orders',
            'order': 'GET /api/reporting/orders/{orderId}',
            'customers': 'GET /api/reporting/customers',
            'customer': 'GET /api/reporting/customers/{userId}'
        }
    }), 200


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Bad request', 'details': str(error)}), 400


@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized'}), 401


@app.errorhandler(403)
def forbidden(error):
    return jsonify({'error': 'Forbidden'}), 403


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500


# ============================================================================
# Context Processor for Database Session
# ============================================================================

@app.teardown_appcontext
def shutdown_session(exception=None):
    """Clean up database session after request"""
    db.session.remove()


# ============================================================================
# Register Routes
# ============================================================================

def register_routes():
    """Import and register API routes"""
    if 'api' not in app.blueprints:
        from routes import init_routes
        init_routes(app)


# ============================================================================
# Initialization
# ============================================================================

def init_app():
    """
    Initialize the application for the development server (python app.py).
    Registers the routes. There is no database to check: the read model is
    built from the event files on the first request that needs it. The
    report scheduler is not started here either: it runs in the consumer
    process (consumer.py).
    """
    logger.info(f"Initializing Reporting Service (env: {app.config['ENV']})")
    logger.info(f"Auth Service: {app.config['AUTH_SERVICE_URL']}")
    logger.info(f"Reporting files: {app.config['REPORTING_FILES_DIR']}")

    try:
        with app.app_context():
            register_routes()
            logger.info("Application initialized successfully")

    except Exception as e:
        logger.error(f"Failed to initialize application: {e}")
        raise


if __name__ == '__main__':
    init_app()
    app.run(
        host=app.config['REPORTING_SERVICE_HOST'],
        port=app.config['REPORTING_SERVICE_PORT'],
        debug=app.config['DEBUG']
    )
