# Swagger UI Test Credentials

For development and testing, a default test user is automatically created when the auth service starts.

## Login Credentials

```
Email: admin@example.com
Password: admin123
```

## How to Use

### 1. Login via Auth Service

1. Go to http://localhost:3001/api/docs
2. Find the `POST /auth/login` endpoint
3. Click "Try it out"
4. Enter these credentials:
   ```json
   {
     "email": "admin@example.com",
     "password": "admin123"
   }
   ```
5. Click "Execute"
6. Copy the `access_token` from the response

### 2. Authorize in Java Service Swagger UIs

For **Holdings & Trade Service** (http://localhost:8082/swagger-ui.html) or **Order & Sell Service** (http://localhost:8081/swagger-ui.html):

1. Click the green **"Authorize"** button at the top
2. In the "Bearer" field, paste: `Bearer <your_access_token>`
3. Click "Authorize"
4. All protected endpoints will now work

### 3. Test Protected Endpoints

Now you can test endpoints like:
- `GET /api/users/me` - Get your profile
- `GET /api/me/accounts` - List your accounts
- `POST /api/me/accounts` - Create a new account
- `GET /api/orders` - List your orders
- etc.

## Notes

- The test user is only created in **development mode** (NODE_ENV ≠ 'production')
- The password is hashed with bcrypt and stored in the database
- It's safe to use for local development and testing
- Tokens expire after a certain period; you'll need to login again if expired
- In production, this seed service is disabled and no test user is created
