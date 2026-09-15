# Business Logic UI (Middle Tier) - Sequence Diagrams

## 1. Login Flow Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant LoginComponent
    participant AuthService
    participant Backend as "Backend<br/>(Auth DB)"

    User->>LoginComponent: Enter email & password
    User->>LoginComponent: Click Submit
    
    LoginComponent->>LoginComponent: Validate form
    LoginComponent->>AuthService: login(email, password)
    
    AuthService->>AuthService: Create LoginDto
    AuthService->>Backend: POST /auth/login (LoginDto)
    
    Backend->>Backend: Hash password & compare
    
    alt Authentication Successful
        Backend-->>AuthService: 200 OK + AuthTokenDto
        AuthService->>AuthService: Extract & cache tokens
        AuthService->>AuthService: Update tokenSubject
        AuthService-->>LoginComponent: Observable<AuthTokenDto>
        LoginComponent->>LoginComponent: Close loading spinner
        LoginComponent->>Backend: Navigate to dashboard
        Backend-->>User: Display dashboard
    else Authentication Failed
        Backend-->>AuthService: 401 Unauthorized
        AuthService-->>LoginComponent: Error Observable
        LoginComponent->>LoginComponent: Display error message
        LoginComponent-->>User: Show "Invalid credentials"
    end
```

---

## 2. Registration Flow Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant RegisterComponent
    participant AuthService
    participant Backend as "Backend<br/>(Auth DB)"

    User->>RegisterComponent: Enter email & password
    User->>RegisterComponent: Enter confirm password
    User->>RegisterComponent: Click Register
    
    RegisterComponent->>RegisterComponent: Validate form
    RegisterComponent->>RegisterComponent: Check password match
    RegisterComponent->>AuthService: register(email, password)
    
    AuthService->>AuthService: Create RegisterDto
    AuthService->>Backend: POST /auth/register (RegisterDto)
    
    Backend->>Backend: Validate email (unique)
    Backend->>Backend: Hash password with bcrypt
    Backend->>Backend: Create user account
    
    alt Registration Successful
        Backend-->>AuthService: 200 OK + AuthTokenDto
        AuthService->>AuthService: Extract & cache tokens
        AuthService->>AuthService: Update tokenSubject
        AuthService-->>RegisterComponent: Observable<AuthTokenDto>
        RegisterComponent->>RegisterComponent: Close loading spinner
        RegisterComponent->>Backend: Navigate to dashboard
        Backend-->>User: Display dashboard
    else Email Already Exists
        Backend-->>AuthService: 409 Conflict
        AuthService-->>RegisterComponent: Error Observable
        RegisterComponent-->>User: Show "Email already registered"
    else Invalid Input
        Backend-->>AuthService: 400 Bad Request
        AuthService-->>RegisterComponent: Error Observable
        RegisterComponent-->>User: Show validation error
    end
```

---

## 3. Token Retrieval & HTTP Request Interception

```mermaid
sequenceDiagram
    participant Component as "App Component"
    participant HttpClient as "HttpClient"
    participant AuthInterceptor
    participant AuthService
    participant Backend as "Backend<br/>(Auth DB)"

    Component->>HttpClient: Make HTTP request
    HttpClient->>AuthInterceptor: intercept(request, next)
    
    AuthInterceptor->>AuthService: getToken()
    AuthService-->>AuthInterceptor: cached accessToken
    
    alt Token exists
        AuthInterceptor->>AuthInterceptor: attachBearerToken(request)
        AuthInterceptor->>HttpClient: Add Authorization header
        HttpClient->>Backend: POST/GET/PUT/DELETE + Bearer token
        Backend->>Backend: Validate JWT signature with public key
        Backend->>Backend: Decode JwtPayload + check expiration
        Backend-->>HttpClient: 200 OK + Response data
        HttpClient-->>Component: Response Observable
        Component->>Component: Handle response
    else Token not found/expired
        HttpClient->>Backend: Request without token or expired token
        Backend-->>HttpClient: 401 Unauthorized
        HttpClient->>AuthInterceptor: Error 401 response
        AuthInterceptor->>AuthService: Attempt refresh with refresh token
        AuthService->>Backend: POST /auth/refresh + refresh token
        Backend-->>AuthService: New AccessToken or 401
        alt Refresh successful
            AuthService->>AuthService: Update cached accessToken
            AuthInterceptor->>HttpClient: Retry original request with new token
            HttpClient-->>Component: Response Observable
        else Refresh failed
            AuthService->>AuthService: Clear tokens
            HttpClient-->>Component: 401 Error Observable
            Component->>Component: Redirect to login
        end
    end
```

---

## 4. Authentication Guard Check Flow

```mermaid
sequenceDiagram
    actor User
    participant Router as "Angular Router"
    participant AuthGuard
    participant AuthService
    participant Backend as "Backend<br/>(Auth DB)"
    participant ProtectedComponent as "Protected<br/>Component"
    participant LoginComponent

    User->>Router: Navigate to protected route
    Router->>AuthGuard: canActivate()?
    
    AuthGuard->>AuthService: isAuthenticated()
    AuthService->>AuthService: Check cached token
    AuthService->>Backend: verifyToken(token)
    
    alt Backend verifies token valid
        Backend-->>AuthService: true + JwtPayload
        AuthService-->>AuthGuard: true
        AuthGuard->>AuthGuard: validateJwtClaims()
        AuthGuard->>AuthGuard: checkExpiration(JwtPayload)
        alt JWT valid & not expired
            AuthGuard-->>Router: true (allow access)
            Router->>ProtectedComponent: Load component
            ProtectedComponent-->>User: Display protected content
        else JWT expired
            AuthGuard->>AuthService: logout()
            AuthService->>AuthService: Clear cached tokens
            AuthGuard-->>Router: false (deny access)
            Router->>LoginComponent: Redirect to login
            LoginComponent-->>User: Show login form
        end
    else Backend rejects token (401)
        Backend-->>AuthService: false (invalid/expired)
        AuthService-->>AuthGuard: false
        AuthGuard->>AuthService: logout()
        AuthGuard-->>Router: false (deny access)
        Router->>LoginComponent: Redirect to login
        LoginComponent-->>User: Show login form
    end
```

---

## 5. Logout Flow Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant Component as "App Component"
    participant AuthService
    participant Backend as "Backend<br/>(Auth DB)"
    participant Router as "Angular Router"
    participant LoginComponent

    User->>Component: Click Logout button
    Component->>AuthService: logout()
    
    AuthService->>Backend: POST /auth/logout (optional)
    Backend->>Backend: Invalidate session/refresh token
    Backend-->>AuthService: Logout confirmed
    AuthService->>AuthService: Clear cached tokens
    AuthService->>AuthService: Update tokenSubject to null
    
    AuthService-->>Component: Logout complete
    Component->>Router: Navigate to login
    Router->>LoginComponent: Load login form
    LoginComponent-->>User: Display login page
```

---

## Key Flow Insights

### **Login/Register Flow**
1. User submits credentials via form
2. Component validates and sends to AuthService
3. AuthService creates DTO and sends to backend
4. Backend authenticates/registers and returns tokens
5. AuthService caches tokens in memory and BehaviorSubject
6. Component navigates to protected area

### **Token Usage Flow**
1. Component makes HTTP request
2. AuthInterceptor intercepts and retrieves cached token
3. AuthInterceptor attaches Bearer token to Authorization header
4. Backend receives and validates JWT (signature + expiration)
5. Backend can verify token with server-side session store
6. Response returned to component
7. On 401: AuthInterceptor attempts refresh with BackendAuthService

### **Route Protection Flow**
1. Router triggers AuthGuard before navigation
2. AuthGuard calls AuthService to verify token with backend
3. Backend validates token (BackendAuthService.verifyToken)
4. If valid → allow navigation to protected component
5. If invalid/expired → AuthGuard redirects to login
6. Backend is source of truth for token validity

### **Logout Flow**
1. User initiates logout
2. AuthService clears cached tokens from memory
3. AuthService optionally calls backend to invalidate server-side session
4. Backend invalidates refresh token and session
5. Router redirects to login page
6. Application returns to unauthenticated state
