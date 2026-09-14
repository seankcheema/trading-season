Initialize production-ready auth service with complete JWT authentication flow.

Features:
- User registration & login with bcrypt password hashing
- JWT token generation (1h access, 7d refresh)
- Email/password authentication via Passport Local strategy
- JWT Bearer token validation via Passport JWT strategy
- Route protection with AuthGuards
- 5 REST endpoints: register, login, refresh, verify, logout
- PostgreSQL User entity with TypeORM
- Full error handling and input validation

Stack:
- NestJS 12, TypeScript 5, ESM modules
- Passport.js (JWT + Local strategies)
- PostgreSQL + TypeORM
- Vitest for testing

File structure:
- src/auth/ (controller, service, strategies, guards, DTOs)
- src/users/ (entity, service, DTOs)
- src/config/ (database configuration)

Configuration:
- .env for database & JWT secrets
- Automatic schema sync in development mode

Ready to start:
npm run start:dev  # Runs on localhost:3001
# Auth Service - NestJS (Work in Progress)

Centralized authentication and authorization service for the DuaLEAPa platform.

## 📋 Status

**Current Status:** 🚧 Work in Progress (Not yet implemented)

This service is planned for a future sprint. It will provide OAuth2/OIDC-based authentication, session management, and multi-factor authentication.

## 🎯 Planned Features

- OAuth2/OIDC authentication
- JWT token management
- Multi-factor authentication (MFA)
- Session management
- API key management
- User onboarding flows

## 📁 Planned API Endpoints

```
POST   /api/auth/login      — User login
POST   /api/auth/register   — User registration
POST   /api/auth/refresh    — Refresh JWT token
POST   /api/auth/verify     — Verify token
POST   /api/auth/logout     — Logout user
POST   /api/auth/mfa        — MFA challenge
```

## 🛠️ Tech Stack

- NestJS 11+
- TypeScript
- Node.js 22+
- PostgreSQL 16 (shared)
- JWT authentication

## 📚 Documentation

For now, refer to:
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — System architecture
- [docs/APIREFERENCE.md](../../docs/APIREFERENCE.md) — API endpoints
- [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md) — Development setup

---

**Last Updated:** 2026-09-09
