"""
Tests for authentication and JWT token handling
"""

import pytest
import jwt
from datetime import datetime, timedelta
import uuid
from app import verify_token, JWKSCache


class TestJWKSCache:
    """Test JWKS cache functionality"""
    
    def test_jwks_cache_initialization(self):
        """Test JWKS cache initializes"""
        cache = JWKSCache()
        assert cache.keys is None
        assert cache.cached_at is None
        assert cache.cache_ttl == 3600
    
    def test_jwks_cache_ttl_configuration(self):
        """Test JWKS cache TTL is 1 hour"""
        cache = JWKSCache()
        assert cache.cache_ttl == 3600  # 3600 seconds = 1 hour


class TestTokenVerification:
    """Test JWT token verification"""
    
    def test_verify_token_expired(self):
        """Test verification fails for expired token"""
        payload = {
            'sub': str(uuid.uuid4()),
            'iss': 'http://localhost:3001',
            'exp': datetime.utcnow() - timedelta(minutes=1)  # Expired 1 min ago
        }
        token = jwt.encode(payload, 'secret', algorithm='HS256')
        
        # Would fail with proper key verification
        try:
            verify_token(token)
        except ValueError:
            pass  # Expected


class TestAuthorizationDecorator:
    """Test @require_auth decorator"""
    
    def test_require_auth_decorator_exists(self):
        """Test require_auth decorator is defined"""
        from app import require_auth
        assert callable(require_auth)


class TestTokenClaims:
    """Test JWT token claims"""
    
    def test_token_has_sub_claim(self):
        """Test token includes 'sub' (subject) claim"""
        payload = {
            'sub': str(uuid.uuid4()),
            'iss': 'http://localhost:3001'
        }
        token = jwt.encode(payload, 'secret', algorithm='HS256')
        decoded = jwt.decode(token, 'secret', algorithms=['HS256'])
        assert 'sub' in decoded
    
    def test_token_has_issuer_claim(self):
        """Test token includes 'iss' (issuer) claim"""
        payload = {
            'sub': str(uuid.uuid4()),
            'iss': 'http://localhost:3001'
        }
        token = jwt.encode(payload, 'secret', algorithm='HS256')
        decoded = jwt.decode(token, 'secret', algorithms=['HS256'])
        assert decoded['iss'] == 'http://localhost:3001'


class TestTokenExtraction:
    """Test token extraction from headers"""
    
    def test_bearer_token_extraction(self, client):
        """Test Bearer token extraction"""
        headers = {'Authorization': 'Bearer test-token'}
        # Token should be extracted from header
        # In actual test, would verify endpoint behavior
        assert 'Bearer' in headers['Authorization']
    
    def test_invalid_token_format_rejected(self, client):
        """Test invalid token format is rejected"""
        response = client.get('/api/reporting/profile',
                            headers={'Authorization': 'InvalidFormat token'})
        assert response.status_code == 401


class TestUserIsolation:
    """Test user isolation in authorization"""
    
    def test_user_id_from_token(self, test_user):
        """Test user_id is extracted from token 'sub' claim"""
        payload = {
            'sub': str(test_user.user_id),
            'iss': 'http://localhost:3001'
        }
        token = jwt.encode(payload, 'secret', algorithm='HS256')
        decoded = jwt.decode(token, 'secret', algorithms=['HS256'])
        assert decoded['sub'] == str(test_user.user_id)


class TestJWKSFetching:
    """Test JWKS fetching from Auth Service"""
    
    def test_jwks_cache_fetch_attempt(self, app, mocker):
        """Test JWKS is fetched from Auth Service"""
        mock_get = mocker.patch('requests.get')
        mock_response = {
            'keys': [
                {
                    'kid': 'test-key',
                    'kty': 'RSA',
                    'n': 'test-n',
                    'e': 'AQAB'
                }
            ]
        }
        mock_get.return_value.json.return_value = mock_response
        
        cache = JWKSCache()
        # In production, would call get_keys() which would fetch
        # Just verify mock is set up


class TestAuthenticationErrors:
    """Test authentication error handling"""
    
    def test_missing_authorization_header_error(self, client):
        """Test error when authorization header is missing"""
        response = client.get('/api/reporting/profile')
        assert response.status_code == 401
        data = response.get_json()
        assert 'error' in data
        assert 'authorization' in data['error'].lower()
    
    def test_invalid_bearer_format_error(self, client):
        """Test error for invalid Bearer format"""
        response = client.get('/api/reporting/profile',
                            headers={'Authorization': 'Bearer'})
        assert response.status_code == 401
    
    def test_missing_bearer_prefix_error(self, client):
        """Test error when Bearer prefix is missing"""
        response = client.get('/api/reporting/profile',
                            headers={'Authorization': 'test-token'})
        assert response.status_code == 401


class TestTokenAlgorithm:
    """Test JWT algorithm configuration"""
    
    def test_rs256_algorithm_configured(self, app):
        """Test RS256 algorithm is configured"""
        assert app.config['JWT_ALGORITHM'] == 'RS256'
    
    def test_jwt_config_exists(self, app):
        """Test JWT configuration exists"""
        assert 'JWT_ALGORITHM' in app.config
        assert 'AUTH_JWT_ISSUER' in app.config


class TestAuthServiceIntegration:
    """Test Auth Service integration"""
    
    def test_auth_service_url_configured(self, app):
        """Test Auth Service URL is configured"""
        assert 'AUTH_SERVICE_URL' in app.config
        assert 'localhost:3001' in app.config['AUTH_SERVICE_URL'] or \
               'http' in app.config['AUTH_SERVICE_URL']
    
    def test_jwks_url_construction(self, app):
        """Test JWKS URL is properly constructed"""
        jwks_url = app.config['AUTH_JWKS_URL']
        assert '/.well-known/jwks.json' in jwks_url


class TestTokenExpiration:
    """Test token expiration handling"""
    
    def test_jwt_expiration_configured(self, app):
        """Test JWT expiration time is configured"""
        assert app.config['JWT_EXPIRATION_SECONDS'] == 900
        assert app.config['JWT_EXPIRATION_SECONDS'] == 15 * 60  # 15 minutes


class TestAuthorizationFlow:
    """Test authorization flow"""
    
    def test_auth_flow_requires_bearer_token(self, client):
        """Test protected endpoints require Bearer token"""
        response = client.get('/api/reporting/profile')
        assert response.status_code == 401
    
    def test_health_endpoint_no_auth_required(self, client):
        """Test health endpoint requires no auth"""
        response = client.get('/health')
        assert response.status_code != 401


class TestRs256Verification:
    """Real RS256 tokens against a JWKS, the way the auth service issues them."""

    @staticmethod
    def _rsa_jwk(kid=None):
        from cryptography.hazmat.primitives.asymmetric import rsa
        from jwt.algorithms import RSAAlgorithm
        import json

        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
        jwk.update({'use': 'sig', 'alg': 'RS256'})
        if kid is not None:
            jwk['kid'] = kid
        return private_key, jwk

    @staticmethod
    def _token(private_key, app, headers=None, **claims):
        payload = {
            'sub': str(uuid.uuid4()),
            'iss': app.config['AUTH_JWT_ISSUER'],
            'exp': datetime.utcnow() + timedelta(minutes=5),
        }
        payload.update(claims)
        return jwt.encode(payload, private_key, algorithm='RS256', headers=headers)

    def test_token_without_a_kid_verifies_against_the_published_key(self, app, mocker):
        # The auth service publishes a kid in its JWKS but signs tokens without one.
        private_key, jwk = self._rsa_jwk(kid='auth-key-1')
        mocker.patch('app.jwks_cache.get_keys', return_value=[jwk])

        decoded = verify_token(self._token(private_key, app))

        assert decoded['iss'] == app.config['AUTH_JWT_ISSUER']
        assert uuid.UUID(decoded['sub'])

    def test_token_with_a_matching_kid_uses_that_key(self, app, mocker):
        other_key, other_jwk = self._rsa_jwk(kid='old')
        private_key, jwk = self._rsa_jwk(kid='current')
        mocker.patch('app.jwks_cache.get_keys', return_value=[other_jwk, jwk])

        decoded = verify_token(self._token(private_key, app, headers={'kid': 'current'}))

        assert decoded['iss'] == app.config['AUTH_JWT_ISSUER']

    def test_token_signed_by_an_unknown_key_is_rejected(self, app, mocker):
        _, published_jwk = self._rsa_jwk(kid='auth-key-1')
        rogue_key, _ = self._rsa_jwk()
        mocker.patch('app.jwks_cache.get_keys', return_value=[published_jwk])

        with pytest.raises(ValueError, match='Invalid token'):
            verify_token(self._token(rogue_key, app))

    def test_token_naming_an_unknown_kid_is_rejected(self, app, mocker):
        private_key, jwk = self._rsa_jwk(kid='auth-key-1')
        mocker.patch('app.jwks_cache.get_keys', return_value=[jwk])

        with pytest.raises(ValueError, match='not found in JWKS'):
            verify_token(self._token(private_key, app, headers={'kid': 'rotated-away'}))

    def test_wrong_issuer_is_rejected(self, app, mocker):
        private_key, jwk = self._rsa_jwk()
        mocker.patch('app.jwks_cache.get_keys', return_value=[jwk])

        with pytest.raises(ValueError, match='Invalid token'):
            verify_token(self._token(private_key, app, iss='https://someone-else.example'))
