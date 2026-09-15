# Auth service

NestJS authentication service with PostgreSQL, RS256 access tokens, opaque refresh-token rotation, JWKS, and a liveness endpoint. See the [API reference](../../docs/reference/api.md) for contracts and the existing logout limitation.

## Local setup

Install dependencies from repository root with npm --prefix apps/auth-service ci. From this directory, create a new .env using these steps; do not overwrite an existing environment file:

1. Copy .env.example to .env.
2. Delete its placeholder JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, and JWT_ISSUER lines.
3. Append one generated development key pair:

```sh
node scripts/generate-dev-keys.mjs >> .env
```

The generator writes PKCS8/SPKI RSA keys with literal backslash-n escapes. The application normalizes them on load. Do not commit or print the resulting private key. Use managed secrets for deployment.

Keep DB_HOST=localhost, DB_PORT=5433, DB_USER=authuser, DB_NAME=auth_db, and the matching local DB_PASSWORD. PORT defaults to 3001. Startup requires JWT_PRIVATE_KEY and JWT_PUBLIC_KEY; set JWT_ISSUER consistently. The .env.example CORS_ORIGIN entry is not wired into bootstrap.

Follow [development setup](../../docs/guides/development.md#run-locally) to start the auth database, then run npm run start:dev from this directory. Startup loads .env and applies the registered TypeORM migrations with synchronize disabled. The application does not automatically load .env.local.

## Commands

Run in this directory:

| Purpose | Command |
| --- | --- |
| Watch mode | npm run start:dev |
| Compile | npm run build |
| Tests | npm test |
| CI coverage/reports | npm run test:ci |
| Lint | npm run lint |
| Inspect migrations | npm run migration:show |

The migration CLI requires database environment variables exported in the shell; see [database guidance](../../docs/reference/database.md#auth-migrations). Tests generate ephemeral keys rather than using deployment credentials. GET /health checks liveness only.

The Java backend maintains a separate authentication implementation; see [architecture](../../docs/reference/architecture.md) before integrating clients.
