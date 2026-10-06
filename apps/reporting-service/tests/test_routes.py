"""Profile endpoint and the authentication decorator."""


class TestProfileEndpoint:

    def test_requires_a_token(self, client):
        assert client.get('/api/reporting/profile').status_code == 401

    def test_returns_the_callers_profile(self, client, authenticated, test_user):
        response = client.get('/api/reporting/profile', headers=authenticated)

        assert response.status_code == 200
        data = response.get_json()
        assert data['user_id'] == str(test_user.user_id)
        assert data['first_name'] == 'Joanna'
        assert data['last_name'] == 'Trader'
        assert data['trader_level'] == 'INTERMEDIATE'
        assert data['available_funds'] == 50000.0
        assert 'email' not in data, 'the users table carries no email; credentials live in user_accounts'

    def test_unknown_user_is_not_found(self, client, db_session, mocker):
        mocker.patch('app.verify_token', return_value={'sub': '00000000-0000-0000-0000-000000000000'})

        response = client.get('/api/reporting/profile', headers={'Authorization': 'Bearer token'})

        assert response.status_code == 404


class TestAuthenticationDecorator:

    def test_missing_authorization_header(self, client):
        response = client.get('/api/reporting/profile')

        assert response.status_code == 401
        assert 'error' in response.get_json()

    def test_header_without_bearer_prefix(self, client):
        response = client.get('/api/reporting/profile', headers={'Authorization': 'Basic abc'})

        assert response.status_code == 401

    def test_rejected_token(self, client, mocker):
        mocker.patch('app.verify_token', side_effect=ValueError('Token has expired'))

        response = client.get('/api/reporting/profile', headers={'Authorization': 'Bearer expired'})

        assert response.status_code == 401
        assert response.get_json()['error'] == 'Token has expired'
