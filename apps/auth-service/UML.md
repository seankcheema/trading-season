# Auth Service UML

## Business overview

The auth service controls who can use the platform. People create an account and
sign in. After that they stay signed in while they use the app, and they can
sign out when they're done. Other parts of the platform ask the auth service to
confirm who a person is before they show that person's data.

```mermaid
flowchart LR
    person(["Trader or Admin"])

    subgraph auth["Auth Service"]
        direction TB
        signup["Create account"]
        signin["Sign in"]
        check{"Correct password?"}
        lock["Lock the account for 15 minutes<br/>after 5 wrong attempts"]
        session["Start a session"]
        stay["Stay signed in<br/>(pass renewed every 15 minutes,<br/>session lasts up to 7 days)"]
        signout["Sign out"]
    end

    accounts[("User accounts")]
    apps["Other platform services<br/>(business app, reporting)"]

    person --> signup
    person --> signin
    signup --> accounts
    signup --> session
    signin --> check
    check -- "Yes" --> session
    check -- "No" --> lock
    lock -.-> accounts
    session --> stay
    stay --> signout
    session -- "Digital pass" --> apps
    apps -. "Confirm the pass is genuine" .-> auth
```

| What a user does | What happens |
| --- | --- |
| **Creates an account** | Enters a username, email, name and a password of at least 8 characters. Each username and email can only be used once. New accounts get the Trader role. |
| **Signs in** | Enters their email and password. If anything is wrong they see the same "Invalid credentials" message every time, so nobody can find out which emails have accounts. |
| **Enters the wrong password too many times** | After 5 wrong attempts in a row, the account is locked for 15 minutes. |
| **Keeps using the app** | They get a digital pass that lasts 15 minutes. The app renews it in the background, so they can stay signed in for up to 7 days without signing in again. |
| **Signs out** | Their session is ended. *(Known issue: this step doesn't end the session yet. See the technical notes below.)* |
| **Uses other parts of the platform** | Other services check the pass themselves, using a public key published by the auth service. The auth service never shares passwords with them. |

If someone steals a session and tries to reuse it, the service signs that user
out on every device.

## Technical class diagram

Class diagram of the NestJS auth service (`apps/auth-service/src`). Framework
wiring (`AppModule`, `AppController`, `HealthController`) is left out to keep the
focus on authentication.

```mermaid
classDiagram
    direction TB

    %% ───────────── HTTP layer ─────────────
    class AuthController {
        <<controller /auth>>
        -Logger logger
        -AuthService authService
        -JwtKeysService jwtKeysService
        +register(RegisterDto) Promise~AuthTokenDto~
        +login(LoginDto) Promise~AuthTokenDto~
        +refresh(req) Promise~AuthTokenDto~
        +verify(req) Promise~VerifyResult~
        +logout(req) Promise~Message~
        -extractToken(req) string
        -extractRefreshToken(req) string
    }

    class WellKnownController {
        <<controller /.well-known>>
        -JwtKeysService jwtKeysService
        +getJwks() Jwks
    }

    %% ───────────── Guards & Passport strategies ─────────────
    class LocalAuthGuard {
        <<guard>>
    }
    class JwtAuthGuard {
        <<guard>>
    }
    class LocalStrategy {
        <<passport local>>
        -AuthService authService
        +validate(email, password) Promise~User~
    }
    class JwtStrategy {
        <<passport jwt>>
        +validate(JwtPayload) JwtPayload
    }

    %% ───────────── Services ─────────────
    class AuthService {
        <<service>>
        -Logger logger
        -number ACCESS_TOKEN_EXPIRATION = 900
        -UsersService usersService
        -JwtService jwtService
        -RefreshTokensService refreshTokens
        +register(username, email, password, firstName, lastName) Promise~AuthTokenDto~
        +login(email, password) Promise~AuthTokenDto~
        +validateUser(email, password) Promise~User~
        +validateToken(token) Promise~JwtPayload~
        +refreshToken(refreshToken) Promise~AuthTokenDto~
        +logout(refreshToken) Promise~void~
        -issueTokens(userId, email, roles, refreshToken) AuthTokenDto
    }

    class UsersService {
        <<service>>
        -Repository~User~ usersRepository
        +create(CreateUserDto) Promise~UserDto~
        +findByEmail(email) Promise~User~
        +findById(id) Promise~UserDto~
        +validatePassword(plain, hashed) Promise~boolean~
        +incrementFailedAttempts(userId) Promise~void~
        +lockAccount(userId) Promise~void~
        +resetFailedAttempts(userId) Promise~void~
        +isAccountLocked(User) boolean
        -mapToDto(User) UserDto
    }

    class RefreshTokensService {
        <<service>>
        -Repository~RefreshToken~ repository
        +issue(userId) Promise~string~
        +findByToken(token) Promise~RefreshToken~
        +isUsable(RefreshToken) boolean
        +rotate(RefreshToken) Promise~string~
        +revoke(RefreshToken) Promise~void~
        +revokeAllForUser(userId) Promise~void~
        -hash(token) string
    }

    class JwtKeysService {
        <<service>>
        -string privateKeyPem
        -string publicKeyPem
        -KeyObject publicKeyObject
        +getPrivateKey() string
        +getPublicKeyObject() KeyObject
        +getPublicKeyPem() string
        +getJwks() Jwks
        -publicKeyToJwk() JwksKey
        -generateKeyId() string
        -normalizeKey(key) string
    }

    class JwtService {
        <<external @nestjs/jwt>>
        +sign(payload, options) string
        +verify(token) JwtPayload
    }

    %% ───────────── Entities (TypeORM / Postgres) ─────────────
    class User {
        <<entity users>>
        +uuid id
        +string username
        +string email
        +string password
        +Role role
        +number failedAttempts
        +Date lockedUntil
        +string firstName
        +string lastName
        +boolean isActive
        +boolean emailVerified
        +Date createdAt
        +Date updatedAt
    }

    class RefreshToken {
        <<entity refresh_tokens>>
        +uuid id
        +uuid userId
        +string tokenHash
        +Date issuedAt
        +Date expiresAt
        +Date revokedAt
        +uuid replacedBy
    }

    class Role {
        <<enumeration>>
        ADMIN
        TRADER
    }

    %% ───────────── DTOs ─────────────
    class RegisterDto {
        <<dto>>
        +string username
        +string email
        +string password
        +string firstName
        +string lastName
    }
    class LoginDto {
        <<dto>>
        +string email
        +string password
    }
    class CreateUserDto {
        <<dto>>
        +string username
        +string email
        +string password
        +string firstName
        +string lastName
    }
    class UserDto {
        <<dto>>
        +string id
        +string email
        +string firstName
        +string lastName
        +boolean isActive
        +boolean emailVerified
        +Role role
        +Date createdAt
        +Date updatedAt
    }
    class AuthTokenDto {
        <<dto>>
        +string accessToken
        +string refreshToken
        +number expiresIn
    }
    class JwtPayload {
        <<interface>>
        +string sub
        +string email
        +Role[] roles
        +string iss
        +number exp
        +number iat
    }
    class Jwks {
        <<interface>>
        +JwksKey[] keys
    }
    class JwksKey {
        <<interface>>
        +string kty
        +string use
        +string alg
        +string kid
        +string n
        +string e
    }

    %% ───────────── Relationships ─────────────
    AuthController --> AuthService : delegates
    AuthController --> JwtKeysService
    AuthController ..> LocalAuthGuard : login
    AuthController ..> JwtAuthGuard : verify, logout
    WellKnownController --> JwtKeysService

    LocalAuthGuard ..> LocalStrategy : 'local'
    JwtAuthGuard ..> JwtStrategy : 'jwt'
    LocalStrategy --> AuthService : validateUser
    JwtStrategy ..> JwtKeysService : public key

    AuthService --> UsersService
    AuthService --> RefreshTokensService
    AuthService --> JwtService : sign RS256

    UsersService --> User : Repository
    RefreshTokensService --> RefreshToken : Repository
    User "1" --> "0..*" RefreshToken : sessions

    User --> Role
    UserDto --> Role
    JwtPayload --> Role
    Jwks *-- JwksKey

    AuthController ..> RegisterDto
    AuthController ..> LoginDto
    AuthService ..> CreateUserDto
    AuthService ..> AuthTokenDto : returns
    AuthService ..> JwtPayload : claims
    UsersService ..> UserDto : returns
    JwtKeysService ..> Jwks : returns
```

## Notes

- **Access tokens** are RS256 JWTs valid for 15 minutes, signed with
  `JWT_PRIVATE_KEY`. Other services verify them using the public key published at
  `GET /.well-known/jwks.json`.
- **Refresh tokens** are opaque random strings valid for 7 days. Only their
  SHA-256 hash is stored. Each refresh rotates the token; presenting a revoked or
  expired token revokes every session for that user.
- **Lockout:** 5 failed logins lock the account for 15 minutes. Every failure path
  runs a bcrypt compare, so response timing doesn't reveal whether an account
  exists.
- **Known issue — logout:** `AuthController.logout` passes the *access* token
  from the `Authorization` header to `AuthService.logout`, which looks it up as a
  *refresh* token. It never matches, so no session is actually revoked.
- Nullable columns (`User.lockedUntil`, `RefreshToken.revokedAt`,
  `RefreshToken.replacedBy`) are shown without `| null`, because Mermaid can't
  render union types.
