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
