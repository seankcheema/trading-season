# DuaLEAPa Sprint 1 - Monorepo AI Guidance

This document provides guidance for AI agents working within this monorepo structure.

## Monorepo Philosophy

This is a **multi-app monorepo** using a **clear separation of concerns** model:
- **`apps/`** — Independently deployable applications (Angular frontends, Spring Boot backends)
- **`packages/`** — Shared libraries consumed by multiple apps (UI components, API contracts)
- **`infrastructure/`** — DevOps configs & deployment tools (Docker, Jenkins, Nginx)
- **`scripts/`** — Utility scripts (Python analytics, backtesting)
- **`docs/`** — Centralized technical documentation
- **Root-level** — Workspace configuration (package.json, turbo.json)

## File Organization Rules

### Apps (`apps/*/`)
Each app is a self-contained project with its own:
- `README.md` — App-specific setup, features, development instructions
- `.agent.md` — App-specific AI guidance
- `package.json` (for Node apps) or `pom.xml` (for Maven apps)
- `src/` — Source code
- `Dockerfile` — Container image definition

**Examples:**
- `apps/business-logic-ui/` — Angular 22.1 frontend
- `apps/business-backend/` — Spring Boot 3.3.4 API server
- `apps/auth-service/` — NestJS authentication service (future)

### Packages (`packages/*/`)
Shared, reusable code installed as dependencies by apps:
- `shared-ui-components/` — SpartanNG component library (npm package)
- `api-contracts/` — OpenAPI schemas, TypeScript interfaces, Java DTOs

**Key rule:** Packages are published/referenced by other apps, so breaking changes require coordination.

### Infrastructure (`infrastructure/*/`)
Non-application code: deployment configs, CI/CD pipelines, secrets management.
- `docker/` — Docker build utilities
- `docker-compose/` — Compose files (local & production)
- `nginx/` — Reverse proxy configuration
- `jenkins/` — Jenkins CI/CD pipeline (Jenkinsfile + scripts)

### Scripts (`scripts/*/`)
Standalone utilities (Python backtesting, analytics, reporting).

### Docs (`docs/`)
Centralized, long-form documentation:
- `ARCHITECTURE.md` — System design overview
- `DATABASE.md` — Schema, migrations, entity relationships
- `APIREFERENCE.md` — REST API endpoints
- `DEVELOPMENTWORKFLOW.md` — Local development setup
- `DEPLOYMENT.md` — Production deployment
- `JAVA_DOCS.md` — Generated Javadoc reference

## When to Use Each App

| Task | Use This | Do NOT Use |
|------|----------|-----------|
| Add a frontend feature | `apps/business-logic-ui/` | Other frontend apps |
| Add a backend endpoint | `apps/business-backend/` | Other backend apps |
| Modify shared UI components | `packages/shared-ui-components/` | Copy-pasting into individual apps |
| Update database schema | `apps/business-backend/db/migrations/` | Direct SQL changes (use Flyway) |
| Modify Docker configs | `infrastructure/docker-compose/` | Individual app Dockerfiles |
| Write deployment docs | `docs/DEPLOYMENT.md` | Multiple scattered docs |

## Key Conventions

### Git History Preservation
All file moves use `git mv` (never copy-delete):
```bash
git mv old/path new/path
```
This preserves commit history across restructuring.

### Import Paths

#### Frontend (Angular)
Shared components imported as npm package:
```typescript
import { HlmButton } from '@packages/shared-ui-components';
```
**tsconfig.json path alias:**
```json
{
  "compilerOptions": {
    "paths": {
      "@packages/*": ["../../packages/*"]
    }
  }
}
```

#### Backend (Spring Boot)
No shared Java packages yet (monolithic backend). Future multi-module setup:
```xml
<dependency>
  <groupId>com.neueda.leap.packages</groupId>
  <artifactId>api-contracts</artifactId>
  <version>0.1.0</version>
</dependency>
```

### Database Migrations
Located in `apps/business-backend/db/migrations/`:
- Use Flyway naming: `V001__Initial_schema.sql`, `V002__Add_audit_table.sql`, etc.
- Never edit existing migrations — create new ones for changes
- Migrations are automatically applied on app startup

### Environment Configuration
- Local dev: `infrastructure/docker-compose/docker-compose.local.yml`
- Production: `infrastructure/docker-compose/docker-compose.prod.yml`
- Environment variables stored in `.env` (not version-controlled) or secrets manager

### Build Orchestration
Root `turbo.json` defines build tasks:
```bash
turbo run build      # Build all packages
turbo run test       # Test all packages
turbo run lint       # Lint all packages
```

## When to Modify Documentation

### Update README.md if:
- Adding a new app/package
- Changing development workflow
- Adding major features
- Updating technology versions

### Update ARCHITECTURE.md if:
- Changing system design
- Adding new services/components
- Modifying data flow

### Update DATABASE.md if:
- Adding/changing database tables
- Modifying schema structure
- Adding new migrations

### Update APIREFERENCE.md if:
- Adding new endpoints
- Changing authentication model
- Modifying request/response formats

### Update DEVELOPMENTWORKFLOW.md if:
- Changing local setup steps
- Updating prerequisites (Java version, Node version, etc.)
- Adding new debugging techniques

### Update DEPLOYMENT.md if:
- Changing CI/CD pipeline
- Updating deployment steps
- Modifying secrets management

## Common AI Tasks

### "Add a new feature to the business logic UI"
1. Navigate to `apps/business-logic-ui/src/app/`
2. Follow Angular 22.1 standalone component patterns
3. Import shared components from `packages/shared-ui-components`
4. Update `apps/business-logic-ui/README.md` if adding new feature section
5. Test: `npm run test` in `apps/business-logic-ui/`

### "Add a new API endpoint"
1. Navigate to `apps/business-backend/src/main/java/com/neueda/leap/`
2. Create controller or extend existing one
3. Update `docs/APIREFERENCE.md` with new endpoint
4. Test: `mvn test` in `apps/business-backend/`

### "Add a new database table"
1. Create migration file in `apps/business-backend/db/migrations/V###__*.sql`
2. Update `docs/DATABASE.md` with schema documentation
3. Update entity/repository classes in backend
4. Test migrations locally: `docker-compose up` in `infrastructure/docker-compose/`

### "Update shared UI components"
1. Navigate to `packages/shared-ui-components/`
2. Modify component or add new one
3. Update `packages/shared-ui-components/README.md`
4. Test: `npm run test` in packages
5. Apps automatically pick up changes via npm link/workspace

### "Fix a deployment issue"
1. Check logs: `docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs`
2. Review `docs/DEPLOYMENT.md` for configuration
3. Update `infrastructure/docker-compose/*.yml` if needed
4. Update `infrastructure/jenkins/Jenkinsfile` if changing CI/CD

## Restricted Operations

❌ **Do NOT:**
- Create duplicate apps at root level
- Store configuration in individual app Dockerfiles (use docker-compose)
- Mix infrastructure code into app directories
- Store secrets in version control (use .env or secrets manager)
- Edit existing database migrations (create new ones instead)
- Use copy-paste for shared code (create package instead)

✅ **Do:**
- Use `git mv` for all file movements
- Keep documentation in `docs/`
- Keep configs in `infrastructure/`
- Keep shared code in `packages/`
- Link to docs from app READMEs
- Update docs when changing code structure

## Tech Stack Reference

| Component | Tech | Version | Key Files |
|-----------|------|---------|-----------|
| Business UI | Angular | 22.1 | `apps/business-logic-ui/angular.json` |
| Shared UI | SpartanNG | 1.3.4 | `packages/shared-ui-components/` |
| Business Backend | Spring Boot | 3.3.4 | `apps/business-backend/pom.xml` |
| Database | PostgreSQL | 16 | `apps/business-backend/db/migrations/` |
| Container | Docker | Latest | `infrastructure/docker-compose/` |
| CI/CD | Jenkins | TBD | `infrastructure/jenkins/Jenkinsfile` |
| Task Runner | Turborepo | Latest | `turbo.json` |

## Quick Links

- **Monorepo Root:** [README.md](README.md)
- **Architecture Overview:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Development Setup:** [docs/DEVELOPMENTWORKFLOW.md](docs/DEVELOPMENTWORKFLOW.md)
- **Deployment Guide:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Business Logic UI:** [apps/business-logic-ui/.agent.md](apps/business-logic-ui/.agent.md)
- **Business Backend:** [apps/business-backend/.agent.md](apps/business-backend/.agent.md)
- **Shared UI Components:** [packages/shared-ui-components/.agent.md](packages/shared-ui-components/.agent.md)
- **Infrastructure:** [infrastructure/.agent.md](infrastructure/.agent.md)

---

**Last Updated:** 2026-09-09  
**Version:** Sprint 1 (v0.1.0)
