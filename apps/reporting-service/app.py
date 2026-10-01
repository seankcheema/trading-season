"""
Trading Season Reporting Service
Python Flask microservice for portfolio performance, trade history, and risk summaries.
"""

import os
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from datetime import datetime
import jwt
import requests
from functools import wraps
from config import config
import logging

# Import database models and services
from models import db
from db_service import (
    UserRepository, AccountRepository, HoldingRepository,
    OrderRepository, TradeRepository, CashTransactionRepository,
    AuditRepository, MetadataRepository
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Load configuration
config_name = os.getenv('FLASK_ENV', 'development')
app.config.from_object(config[config_name])

# Configure SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = app.config['DATABASE_URL']
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,
    'pool_recycle': 3600,
    'pool_pre_ping': True,
}

# Initialize database
db.init_app(app)

# Enable CORS
CORS(app, origins=app.config['CORS_ORIGINS'])


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


def verify_token(token):
    """Verify JWT token and return decoded payload"""
    try:
        # Get the kid from the token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')
        
        # Get the public key from JWKS
        keys = jwks_cache.get_keys()
        key = None
        for k in keys:
            if k.get('kid') == kid:
                key = k
                break
        
        if not key:
            raise ValueError(f"Key {kid} not found in JWKS")
        
        # Build the public key
        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(key)
        
        # Verify and decode the token
        decoded = jwt.decode(
            token,
            public_key,
            algorithms=[app.config['JWT_ALGORITHM']],
            issuer=app.config['AUTH_JWT_ISSUER'],
            options={'verify_exp': True}
        )
        
        return decoded
    
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
            g.user_id = decoded.get('sub')  # UUID from token
        except ValueError as e:
            return jsonify({'error': str(e)}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function


# ============================================================================
# Health Check
# ============================================================================

@app.route('/health', methods=['GET'])
def health():
    """Service health check endpoint (public, no auth required)"""
    try:
        # Verify database connectivity
        db.session.execute('SELECT 1')
        
        return jsonify({
            'status': 'healthy',
            'service': 'reporting-service',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '0.1.0'
        }), 200
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'service': 'reporting-service',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 503


# ============================================================================
# Root Endpoint
# ============================================================================

@app.route('/', methods=['GET'])
def root():
    """Root endpoint - identifies this as a placeholder"""
    return jsonify({
        'service': 'Trading Season Reporting Service',
        'status': 'initialized',
        'version': '0.1.0',
        'description': 'Portfolio performance, trade history, and risk summaries',
        'documentation': '/docs',
        'health': '/health',
        'api_endpoints': {
            'portfolio': 'GET /api/reporting/portfolio',
            'account_portfolio': 'GET /api/reporting/portfolio/{accountId}',
            'trades': 'GET /api/reporting/trades',
            'profile': 'GET /api/reporting/profile'
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
    from routes import init_routes
    init_routes(app)


# ============================================================================
# Initialization
# ============================================================================

def init_app():
    """Initialize the application"""
    logger.info(f"Initializing Reporting Service (env: {app.config['ENV']})")
    logger.info(f"Database: {app.config['DATABASE_URL']}")
    logger.info(f"Auth Service: {app.config['AUTH_SERVICE_URL']}")
    
    # Verify database connectivity
    try:
        with app.app_context():
            db.session.execute('SELECT version()')
            version = db.session.execute('SELECT version()').scalar()
            logger.info(f"Database connected: {version}")
            
            # Register API routes
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
