# Architecture

## Implemented boundaries

| Area | Current responsibility | Source |
| --- | --- | --- |
| Angular UI | Login and registration forms, local validation, mock portfolio dashboard, and live simulated stock tickers | [Routes](../../apps/business-logic-ui/src/app/app.routes.ts) |
| Spring Boot backend | Registration with profile data, username/password sessions, and public simulated stock snapshot/candle/SSE reads | [Java controllers](../../apps/business-backend/src/main/java/com/neueda/leap) |
| NestJS auth service | Email/password login, RS256 access tokens, opaque refresh tokens, JWKS, liveness | [Auth controller](../../apps/auth-service/src/auth/auth.controller.ts) |
| Shared UI | Angular components consumed through @shared/ui-components subpath exports | [Package manifest](../../packages/shared-ui-components/package.json) |
| Reporting | Placeholder directories only | [Reporting proposal](reporting.md) |

The frontend calls only the Java public stock-data API; it does not yet call either authentication API. Java and NestJS currently own separate user models and databases; there is no implemented token-validation bridge in the Java backend. Do not describe centralized authentication as a completed integration.

## Data flows

Java requests pass through validation, AuthService, JPA repositories, and the business PostgreSQL database. Registration hashes passwords; login creates a session identifier and expiry. See the [API contract](api.md).

NestJS requests pass through controllers/Passport strategies, AuthService, and TypeORM repositories in a separate auth database. Registration/login issue an RS256 access token and a random refresh token. Only the refresh token hash is stored. Refresh rotates it; reuse of an unusable token revokes the user's live refresh sessions. Access tokens expire after 15 minutes and remain stateless.

The trading schema defines simulation, execution, and accounting structures, but their presence does not imply implemented trading endpoints. Its constraints and ERD are described in the [database guide](database.md).

## Integration limitations

- UI submission handlers are placeholders; end-to-end authentication remains to be wired.
- NestJS logout is guarded by an access JWT and forwards that JWT to a service method expecting an opaque refresh token. Do not rely on this endpoint to revoke a refresh session until the mismatch is fixed.
- NestJS bootstrap does not install a global validation pipe, cookie parser, or CORS configuration. DTO fields alone do not imply runtime validation; use JSON body refresh tokens.
- The Passport JWT strategy restricts RS256 and checks expiry but does not configure issuer/audience enforcement.
- Local Compose has an outdated Java backend context and port mapping. See [operations](../guides/operations.md).

These are current limitations, not changes made by documentation consolidation.

## Change boundaries

Put reusable presentation components in the shared package and application behavior in its owning app. Keep business and auth database changes separate. Changes to authentication integration must reconcile identity ownership and session/token contracts explicitly. Consult [development](../guides/development.md) for verification commands and [operations](../guides/operations.md) for configuration ownership.
