# JWT RS256 Setup Guide

## Quick Start

### 1. Generate RSA Keys

Run this **once** to generate your RSA key pair:

**On macOS/Linux:**
```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Display keys in single-line format for .env
# Private key (replace newlines with \n):
cat private.pem | sed ':a;N;$!ba;s/\n/\\n/g' | tr -d '\n'

# Public key:
cat public.pem | sed ':a;N;$!ba;s/\n/\\n/g' | tr -d '\n'
```

**On Windows (PowerShell):**
```powershell
# Generate private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Display keys for .env
# Private key:
(Get-Content private.pem) -join '\\n'

# Public key:
(Get-Content public.pem) -join '\\n'
```

### 2. Configure Environment Variables

Update your `.env` file in `apps/auth-service/`:

```env
# JWT Configuration
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA2xJK7t...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEF...\n-----END PUBLIC KEY-----"
JWT_ISSUER="https://auth.dualeapa.com"

# Database (existing)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=dualeapa_auth
```

### 3. Install Dependencies

```bash
cd apps/auth-service
npm install
```

### 4. Test the Implementation

```bash
# Start the auth service
npm run start:dev

# In another terminal, test the endpoints:

# Register
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# This returns:
# {
#   "accessToken": "eyJhbGc...",
#   "refreshToken": "eyJhbGc...",
#   "expiresIn": 900
# }

# Get JWKS (public key)
curl http://localhost:3001/auth/.well-known/jwks.json

# Verify token (replace with actual token)
curl -H "Authorization: Bearer eyJhbGc..." \
  http://localhost:3001/auth/verify

# Refresh token
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJhbGc..."}'

# Logout
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer eyJhbGc..."
```

## Token Details

### Access Token
- **Algorithm**: RS256 (RSA-signed)
- **Expiration**: 15 minutes (900 seconds)
- **Claims**:
  - `sub`: User ID
  - `email`: User email
  - `roles`: Array of roles (ADMIN or TRADER)
  - `iss`: Issuer (JWT_ISSUER env var)
  - `iat`: Issued at timestamp
  - `exp`: Expiration timestamp

### Refresh Token
- **Algorithm**: RS256
- **Expiration**: 7 days
- **Claims**: Same as access token
- **Purpose**: Used to obtain new access tokens without requiring password re-entry

### Example Decoded Access Token
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "email": "trader@example.com",
  "roles": ["TRADER"],
  "iss": "https://auth.dualeapa.com",
  "iat": 1725960000,
  "exp": 1725960900,
  "aud": undefined,
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  }
}
```

## Endpoints

| Method | Endpoint | Protected | Purpose |
|--------|----------|-----------|---------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/refresh` | Get new access token |
| POST | `/auth/logout` | Invalidate tokens |
| GET | `/auth/verify` | Verify token validity |
| GET | `/auth/.well-known/jwks.json` | Get public key (JWKS format) |

## How Other Services Verify Tokens

Other services can verify tokens using the public key from the JWKS endpoint:

```typescript
// In business-backend or other services
import axios from 'axios';
import jwt from 'jsonwebtoken';

async function verifyToken(token: string) {
  // Fetch JWKS from auth service
  const response = await axios.get('http://localhost:3001/auth/.well-known/jwks.json');
  const jwks = response.data;
  
  // Get the public key (first key in the set)
  const publicKey = jwks.keys[0];
  
  // Convert JWK to PEM (using a library like 'jwk-to-pem')
  const pem = jwkToPem(publicKey);
  
  // Verify the token
  const decoded = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: 'https://auth.dualeapa.com'
  });
  
  return decoded;
}
``` 

## Production Recommendations

1. **Use Redis** for token blacklist instead of in-memory Set
   ```bash
   npm install redis ioredis
   ```

2. **Implement key rotation** with multiple keys and `kid` (key ID)

3. **Add rate limiting** to prevent brute force attacks
   ```bash
   npm install @nestjs/throttler
   ```

4. **Use HTTPS only** in production

5. **Monitor token usage** and log authentication events

6. **Set strong password policies** and implement 2FA

7. **Use secure cookies** for refresh tokens (HttpOnly, Secure, SameSite)

## Troubleshooting

### "JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables must be set"

**Solution**: Make sure the environment variables are properly set in your `.env` file and the service is restarted.

### "Invalid token"

**Possible causes**:
- Token has expired (access token expires after 15 minutes)
- Token was tampered with
- Token was signed with wrong key
- Using wrong public key to verify

**Solution**: Generate a new token by logging in or refreshing.

### "Refresh token has been invalidated"

**Possible cause**: User called logout and the refresh token was blacklisted

**Solution**: User needs to log in again

### "Account is deactivated"

**Possible cause**: User was deactivated in the system

**Solution**: Admin needs to reactivate the user

### "Account is temporarily locked"

**Possible cause**: 5 failed login attempts

**Solution**: Wait for 15 minutes or have admin unlock the account
