# Authentication Documentation

This directory contains comprehensive documentation about the authentication and authorization flows in the trading application.

## Login Sequence Diagram

The user login flow is documented with both interactive and static diagrams:

### 📊 View the Diagram

- **[Interactive HTML Version](login-sequence.html)** - Best for viewing in a browser with interactive Mermaid rendering
- **[Static SVG Version](login-sequence.svg)** - For embedding in documents or viewing without JavaScript
- **[Markdown Version](LOGIN_SEQUENCE.md)** - Detailed text-based documentation with explanation

### 📋 Quick Reference

The login flow includes these key steps:

1. **Username Lookup** - User found by username in database
2. **Status Verification** - Account must be "ACTIVE"
3. **Lockout Check** - Account lockout expires after 15 minutes
4. **Password Validation** - BCrypt password matching
5. **Session Creation** - Generate new session token with expiry
6. **Audit Trail** - Record login timestamp and activity

### 🔒 Security Features

| Feature | Details |
|---------|---------|
| **Password Hashing** | BCrypt via Spring Security PasswordEncoder |
| **Account Lockout** | 5 failed attempts trigger 15-minute lockout |
| **Session Timeout** | Configurable per user (stored in User entity) |
| **Account Status** | Verified at every login (must be "ACTIVE") |
| **Activity Tracking** | Last login and last activity timestamps recorded |

### 🚨 Error Handling

| Scenario | HTTP Status | Exception |
|----------|------------|-----------|
| User not found | 401 | UnauthorizedException |
| Account inactive | 401 | UnauthorizedException |
| Account locked | 401 | UnauthorizedException |
| Invalid password | 401 | UnauthorizedException |

### 📦 Related Classes

- `app.auth.AuthController` - REST endpoint for login
- `app.auth.AuthService` - Authentication business logic
- `app.user.UserRepository` - User data access
- `app.user.SessionRepository` - Session data access
- `app.auth.GlobalExceptionHandler` - Exception to HTTP response conversion

### 🔗 Package Information

**Package**: `app.auth`  
**Module**: Authentication and Authorization  
**Last Updated**: 2026-09-15

---

For detailed flow analysis and component breakdown, see the [LOGIN_SEQUENCE.md](LOGIN_SEQUENCE.md) document.
