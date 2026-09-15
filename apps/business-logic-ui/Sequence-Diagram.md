# Business Logic UI (Middle Tier) - Sequence Diagrams

## 1. Login Flow Sequence Diagram

```mermaid
sequenceDiagram
    actor User
    participant LoginComponent
    participant AuthService
    participant Backend as "Auth Backend<br/>(Port 3001)"
    participant LocalStorage as "LocalStorage<br/>Adapter"
    participant Router as "Angular Router"

    User->>LoginComponent: Enter email & password
    User->>LoginComponent: Click Submit
    
    LoginComponent->>LoginComponent: Validate form
    LoginComponent->>AuthService: login(email, password)
    
    AuthService->>AuthService: Create LoginDto
    AuthService->>Backend: POST /auth/login (LoginDto)
    
    Backend->>Backend: Hash password & compare
    
    alt Authentication Successful
        Backend-->>AuthService: 200 OK + AuthTokenDto
        AuthService->>AuthService: Extract accessToken & refreshToken
        AuthService->>LocalStorage: saveToken('accessToken', token)
        AuthService->>LocalStorage: saveToken('refreshToken', token)
        AuthService->>AuthService: Update tokenSubject
        AuthService-->>LoginComponent: Observable<AuthTokenDto>
        LoginComponent->>LoginComponent: Close loading spinner
        LoginComponent->>Router: Navigate to dashboard
        Router-->>User: Display dashboard
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
    participant Backend as "Auth Backend<br/>(Port 3001)"
    participant LocalStorage as "LocalStorage<br/>Adapter"
    participant Router as "Angular Router"

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
        AuthService->>AuthService: Extract tokens
        AuthService->>LocalStorage: saveToken('accessToken', token)
        AuthService->>LocalStorage: saveToken('refreshToken', token)
        AuthService->>AuthService: Update tokenSubject
        AuthService-->>RegisterComponent: Observable<AuthTokenDto>
        RegisterComponent->>RegisterComponent: Close loading spinner
        RegisterComponent->>Router: Navigate to dashboard
        Router-->>User: Display dashboard
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
    participant LocalStorage as "LocalStorage<br/>Adapter"
    participant Backend as "Backend API"

    Component->>HttpClient: Make HTTP request
    HttpClient->>AuthInterceptor: intercept(request, next)
    
    AuthInterceptor->>AuthService: getToken()
    AuthService->>LocalStorage: getToken('accessToken')
    LocalStorage-->>AuthService: accessToken string
    AuthService-->>AuthInterceptor: accessToken
    
    alt Token exists
        AuthInterceptor->>AuthInterceptor: attachBearerToken(request)
        AuthInterceptor->>HttpClient: Add Authorization header
        HttpClient->>Backend: POST/GET/PUT/DELETE + Bearer token
        Backend->>Backend: Validate JWT signature
        Backend->>Backend: Decode JwtPayload
        Backend-->>HttpClient: 200 OK + Response data
        HttpClient-->>Component: Response Observable
        Component->>Component: Handle response
    else Token not found
        HttpClient->>Backend: Request without token
        Backend-->>HttpClient: 401 Unauthorized
        HttpClient-->>Component: Error Observable
        Component->>Component: Handle 401 error
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
    participant LocalStorage as "LocalStorage<br/>Adapter"
    participant ProtectedComponent as "Protected<br/>Component"
    participant LoginComponent

    User->>Router: Navigate to protected route
    Router->>AuthGuard: canActivate()?
    
    AuthGuard->>AuthService: isAuthenticated()
    AuthService->>LocalStorage: getToken('accessToken')
    LocalStorage-->>AuthService: token or null
    
    alt User is authenticated
        AuthService-->>AuthGuard: true
        AuthGuard->>AuthGuard: validateJwtClaims()
        AuthGuard->>AuthGuard: checkExpiration(JwtPayload)
        alt JWT valid & not expired
            AuthGuard-->>Router: true (allow access)
            Router->>ProtectedComponent: Load component
            ProtectedComponent-->>User: Display protected content
        else JWT expired
            AuthGuard->>AuthService: logout()
            AuthService->>LocalStorage: removeToken('accessToken')
            AuthService->>LocalStorage: removeToken('refreshToken')
            AuthGuard-->>Router: false (deny access)
            Router->>LoginComponent: Redirect to login
            LoginComponent-->>User: Show login form
        end
    else User not authenticated
        AuthService-->>AuthGuard: false
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
    participant LocalStorage as "LocalStorage<br/>Adapter"
    participant Router as "Angular Router"
    participant LoginComponent

    User->>Component: Click Logout button
    Component->>AuthService: logout()
    
    AuthService->>LocalStorage: removeToken('accessToken')
    AuthService->>LocalStorage: removeToken('refreshToken')
    AuthService->>AuthService: Update tokenSubject to null
    AuthService->>AuthService: Clear authentication state
    
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
5. AuthService stores tokens in LocalStorage
6. Component navigates to protected area

### **Token Usage Flow**
1. Component makes HTTP request
2. AuthInterceptor intercepts and attaches Bearer token
3. Backend receives and validates JWT
4. Response returned to component

### **Route Protection Flow**
1. Router triggers AuthGuard before navigation
2. AuthGuard checks token existence and expiration
3. If valid → allow navigation
4. If expired/missing → redirect to login

### **Logout Flow**
1. User initiates logout
2. AuthService clears all stored tokens
3. AuthService updates auth state
4. Router redirects to login page
5. Application returns to unauthenticated state
