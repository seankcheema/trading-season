# User Login Sequence Diagram

This document illustrates the complete user authentication flow when logging into the trading application.

## Login Flow Overview

The login process involves the following sequence of interactions:

```mermaid
sequenceDiagram
    participant User as User Client
    participant Controller as AuthController
    participant Service as AuthService
    participant UserRepo as UserRepository
    participant PasswordEnc as PasswordEncoder
    participant SessionRepo as SessionRepository
    participant ExceptionHandler as GlobalExceptionHandler

    User->>Controller: POST /api/auth/login<br/>(LoginRequest)
    activate Controller
    
    Controller->>Service: login(request)
    activate Service
    
    Service->>UserRepo: findByUsername(username)
    activate UserRepo
    UserRepo-->>Service: Optional[User]
    deactivate UserRepo
    
    alt User Not Found
        Service->>ExceptionHandler: throw UnauthorizedException
        activate ExceptionHandler
        ExceptionHandler-->>User: 401 Unauthorized
        deactivate ExceptionHandler
    else User Found
        alt Account Status Not Active
            Service->>ExceptionHandler: throw UnauthorizedException
            activate ExceptionHandler
            ExceptionHandler-->>User: 401 Unauthorized
            deactivate ExceptionHandler
        else Account is Active
            alt Account is Locked
                Service->>ExceptionHandler: throw UnauthorizedException
                activate ExceptionHandler
                ExceptionHandler-->>User: 401 Unauthorized (locked)
                deactivate ExceptionHandler
            else Account Not Locked
                Service->>PasswordEnc: matches(password, hash)
                activate PasswordEnc
                PasswordEnc-->>Service: boolean
                deactivate PasswordEnc
                
                alt Password Invalid
                    Service->>Service: recordFailedAttempt(user)
                    activate Service
                    alt Failed Attempts >= MAX (5)
                        Service->>UserRepo: save(user with lockout)
                        activate UserRepo
                        UserRepo-->>Service: User
                        deactivate UserRepo
                    else
                        Service->>UserRepo: save(user with incremented attempts)
                        activate UserRepo
                        UserRepo-->>Service: User
                        deactivate UserRepo
                    end
                    deactivate Service
                    Service->>ExceptionHandler: throw UnauthorizedException
                    activate ExceptionHandler
                    ExceptionHandler-->>User: 401 Unauthorized
                    deactivate ExceptionHandler
                else Password Valid
                    Service->>UserRepo: save(user<br/>reset failures<br/>update lastLogin)
                    activate UserRepo
                    UserRepo-->>Service: User
                    deactivate UserRepo
                    
                    Service->>SessionRepo: save(new UserSession)
                    activate SessionRepo
                    SessionRepo-->>Service: UserSession
                    deactivate SessionRepo
                    
                    Service-->>Controller: UserSession
                    deactivate Service
                    
                    Controller-->>User: 200 OK<br/>(AuthResponse with<br/>sessionId & expiresAt)
                    deactivate Controller
                end
            end
        end
    end
```

## Key Components

### AuthController (`app.auth.AuthController`)
- **Responsibility**: HTTP endpoint handling
- **Method**: `login(LoginRequest)` → `AuthResponse`
- **Status Code**: 200 (success), 401 (authentication failure)

### AuthService (`app.auth.AuthService`)
- **Responsibility**: Authentication logic and session management
- **Key Behaviors**:
  - Username/password validation
  - Account status verification
  - Account lockout enforcement (5 failed attempts → 15-minute lockout)
  - Session token generation
  - Failed attempt tracking

### UserRepository (`app.user.UserRepository`)
- **Responsibility**: User entity persistence
- **Methods Used**:
  - `findByUsername(String)` - locate user by username
  - `save(User)` - persist user updates (login counts, lockout status)

### PasswordEncoder (Spring Security)
- **Responsibility**: Cryptographic password validation
- **Method**: `matches(rawPassword, encodedPassword)`

### SessionRepository (`app.user.SessionRepository`)
- **Responsibility**: User session persistence
- **Method**: `save(UserSession)` - create new session token

### GlobalExceptionHandler (`app.auth.GlobalExceptionHandler`)
- **Responsibility**: Convert exceptions to HTTP responses
- **Handles**:
  - `UnauthorizedException` → 401 Unauthorized
  - `ConflictException` → 409 Conflict
  - Other validation errors → appropriate HTTP status

## Security Features

| Feature | Implementation |
|---------|-----------------|
| **Password Hashing** | BCrypt via PasswordEncoder |
| **Account Lockout** | 5 failed attempts → 15-minute lockout |
| **Session Timeout** | Configurable per user (stored in User entity) |
| **Account Status** | Verified at login (must be "ACTIVE") |
| **Last Login Tracking** | Recorded on successful authentication |
| **Last Activity Tracking** | Updated on successful authentication |

## Error Scenarios

### 1. User Not Found
- **Exception**: `UnauthorizedException`
- **HTTP Status**: 401 Unauthorized
- **Message**: "Invalid username or password"

### 2. Account Inactive
- **Exception**: `UnauthorizedException`
- **HTTP Status**: 401 Unauthorized
- **Message**: "Account is not active"

### 3. Account Locked
- **Exception**: `UnauthorizedException`
- **HTTP Status**: 401 Unauthorized
- **Message**: "Account is temporarily locked due to failed login attempts"

### 4. Invalid Password
- **Exception**: `UnauthorizedException`
- **HTTP Status**: 401 Unauthorized
- **Message**: "Invalid username or password"
- **Side Effect**: Increments `failedLoginAttempts`; locks account if attempts ≥ 5

## Success Flow Summary

1. ✅ User found by username
2. ✅ Account status is "ACTIVE"
3. ✅ Account is not locked (or lockout expired)
4. ✅ Password hash matches supplied password
5. ✅ Failed attempt counter reset to 0
6. ✅ Lock status cleared
7. ✅ Last login timestamp updated
8. ✅ New `UserSession` created and persisted
9. ✅ `AuthResponse` returned with session ID and expiry time

## Related Flows

- **Registration Flow** - New user account creation
- **Token Refresh** - Extend active session
- **Logout** - Terminate user session

---

**Last Updated**: 2026-09-15  
**Package**: `app.auth`  
**Related Classes**: `AuthController`, `AuthService`, `UserSession`, `LoginRequest`, `AuthResponse`
