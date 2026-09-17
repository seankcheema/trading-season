# Operations

## Configuration ownership

| Component | Configuration | Defaults |
| --- | --- | --- |
| Java backend | [application.properties](../../apps/business-backend/src/main/resources/application.properties) | HTTP 8080; PostgreSQL localhost:5432/trading_season |
| Auth service | [Auth setup](../../apps/auth-service/README.md) and [database configuration](../../apps/auth-service/src/config/database.config.ts) | HTTP 3001; PostgreSQL localhost:5433/auth_db |
| Local containers | [Local Compose](../../infrastructure/docker-compose/docker-compose.local.yml) | Business/auth database volumes and archive cache |
| Jenkins | [Pipeline](../../infrastructure/jenkins/Jenkinsfile), [Compose](../../infrastructure/docker-compose/docker-compose.jenkins.yml) | Jenkins UI on host port 8888 |

Java reads SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD, AUTH_JWK_SET_URI, AUTH_JWT_ISSUER, and CORS_ORIGINS. AUTH_JWT_ISSUER must equal the auth service's JWT_ISSUER or every token is rejected. Auth reads DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, PORT, JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, and JWT_ISSUER. Node startup loads .env from its working directory; Compose must receive the appropriate environment file explicitly.

In local Compose, DB_PASSWORD configures the business database and AUTH_DB_PASSWORD configures the auth database. Inside the auth container, the latter is assigned to DB_PASSWORD. Do not confuse those scopes. Defaults are for disposable local development; production credentials and signing keys must come from managed secrets.

## Local operation

Follow [development setup](development.md) for key generation and database startup. From repository root:

```sh
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml ps
docker compose --env-file apps/auth-service/.env -f infrastructure/docker-compose/docker-compose.local.yml logs --tail 100 db auth-db
```

The Java backend service in local Compose still uses build context '.' relative to the Compose directory and maps 8081, while the app defaults to 8080. Run Java through Maven until that configuration is corrected. The UI has no active Compose service. No production Compose file or Kubernetes deployment is supplied.

Auth GET /health reports process liveness, not database readiness. Check startup logs and database connectivity separately. Database volumes persist across ordinary container shutdown; removing volumes deletes their data. Back up retained data before schema or volume changes and verify restoration in a separate database.

Ordinary Compose startup neither initializes nor seeds. `db_data` remains the PostgreSQL store and `market_data_archive` caches generated files across container recreation. Run the `initialize` profile only for first-time disposable setup. Thereafter the opt-in `seed` profile waits for database readiness and runs numbered steps 0002 through 0004 without destructive initialization.

Because the seed container cannot inspect free space inside the separate PostgreSQL volume, set `MARKET_DATA_AVAILABLE_DISK_GB` to the volume's available capacity before starting the `seed` profile. The default `parquet` mode retains raw ticks in the archive volume and imports only candles into PostgreSQL. The importer commits and checkpoints one month at a time; a rerun verifies and skips completed months. Set tick storage to `postgres` only for an intentional high-capacity deployment.

## CI and artifacts

The Jenkins pipeline expects a native agent with Docker, the Maven tool named Maven3, and Java 21 at its configured JAVA_HOME. It runs Java, auth, Angular, script, and build-scoped two-day PostgreSQL integration checks. Full-year generation remains on demand.

| Suite | Outputs |
| --- | --- |
| Java | apps/business-backend/target/surefire-reports |
| Auth | apps/auth-service/coverage and reports/junit |
| UI | apps/business-logic-ui/coverage |

Auth CI runs npm ci then npm run test:ci. Frontend CI currently uses npm install --legacy-peer-deps followed by npm test -- --no-watch --coverage. This differs from the preferred root npm ci developer installation. Do not silently treat an absent test tool or empty required report as success.

The optional [Jenkins image](../../infrastructure/docker/Dockerfile.jenkins) installs Node 20, which does not meet the current Angular engine requirement. The Jenkins Compose example also mounts the host Docker socket and contains development credentials. Review toolchains, credentials, and access before deployment; it is not a production-ready configuration.

Javadoc generation is a required Java change check described in [development](development.md#javadocs); the current Jenkinsfile does not run or publish it automatically. Generate into the backend target directory, then refresh the checked-in docs/JAVA_DOCS copy after successful verification.

## Troubleshooting

- Connection refused: confirm database containers are healthy, published ports are free, and the app uses host names appropriate to its environment. Host auth connections use port 5433; containers use auth-db:5432.
- Missing business tables: apply the documented disposable bootstrap in the [database guide](../reference/database.md); Java does not run Flyway automatically.
- Auth startup fails on keys: generate an RSA pair, replace placeholder values, and preserve literal backslash-n escapes. Run from the auth directory so .env loads.
- JWT verification fails: check the signing/public key pair and expiry. The Java backend returns 401 when the JWKS at AUTH_JWK_SET_URI is unreachable, the signature does not match, the token has expired, iss differs from AUTH_JWT_ISSUER, or sub is not a UUID. Java caches the key set for five minutes and refetches early when a token carries an unknown kid; the auth service derives kid from the public key, so a key rotation is picked up on the first token signed with the new key. The auth service's own Passport strategy does not enforce issuer/audience; do not assume it does.
- Logout appears successful but refresh still works: see the documented [API limitation](../reference/api.md#current-logout-limitation).
- Jenkins fails before tests: verify the configured Java/Maven paths and Node version on the actual agent, not just the optional image.
- Synthetic market-data CI derives Docker resource names from a normalized hash of the Jenkins build tag, so encoded multibranch names such as `%2F` do not need special handling. The stage creates and removes build-scoped database and archive volumes; do not pre-seed PostgreSQL or generate a persistent archive on the Jenkins VM.
- UI renders but login does not reach an API: form submission is not yet wired to a service. See [architecture](../reference/architecture.md).
