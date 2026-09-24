# Auth Service

**Folder:** `apps/auth-service` | **Port:** 3001 | **Framework:** NestJS

Owns user credentials and identity for the entire platform. Neither Java service receives passwords; both verify bearer tokens independently without per-request calls, caching the auth service's JWKS.

## Implemented capabilities

- Email/password registration and login
- RS256 access tokens (15-minute expiry)
- Refresh token rotation with session revocation
- Public JWKS endpoint for token verification
- Health check endpoint

## API endpoints

| Endpoint | Method | Authentication | Purpose |
| --- | --- | --- | --- |
| `/auth/register` | POST | None | Create user account and issue tokens |
| `/auth/login` | POST | None | Authenticate user and issue tokens |
| `/auth/refresh` | POST | Refresh token | Rotate refresh token and reissue access token |
| `/auth/logout` | POST | None | Revoke refresh token (guard-optional by design) |
| `/.well-known/jwks.json` | GET | None | Public key set for token verification |
| `/health` | GET | None | Liveness check |

## Data ownership

**Database:** `auth_db` on port 5433 (separate from business database)

**Schema:** Managed by TypeORM migrations with `synchronize=false`

**Entities:**
- `User` – email, password hash, account status, lockout tracking
- `RefreshToken` – token value, expiration, session tracking

See [Database Reference](../database.md) for full schema details.

## Token flow

1. Client calls `POST /auth/register` or `POST /auth/login` with email and password
2. Auth service validates credentials and issues an RS256 access token (15 min) and refresh token
3. Client includes access token in `Authorization: Bearer` header for API requests
4. Java backend services fetch and cache the public key from `/.well-known/jwks.json` and verify token signatures independently
5. On access token expiry, client calls `POST /auth/refresh` with refresh token to obtain new access token
6. Reusing an already-rotated refresh token revokes all user sessions

## Integration notes

- No global validation pipe, cookie parser, or CORS configuration at bootstrap
- Refresh tokens are sent as JSON body, not cookies
- JWT strategy checks RS256 signature and expiry but does not enforce issuer/audience claims

## Known gaps in this service's own README

The `apps/auth-service/README.md` contains an "UML Diagram" section with Angular components (`LoginComponent`, `RegisterComponent`, `AuthService`). This is NestJS code and should not include frontend internals; the diagram should be removed or moved to [Client UI documentation](client-ui.md).

## See also

- [API Reference](../api.md) for complete request/response contracts
- [Architecture Reference](../architecture.md) for system integration
- [Database Reference](../database.md) for schema details
