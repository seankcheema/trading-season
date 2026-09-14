# API Contracts - OpenAPI Schemas & Data Transfer Objects

Single source of truth for API schemas, TypeScript interfaces, and Java DTOs shared between frontend and backend.

## 📋 Overview

**Purpose:** Eliminate frontend/backend API mismatch by defining contracts once, used everywhere.

**Contains:**
- OpenAPI 3.0 schema (`openapi.yaml`)
- Generated TypeScript interfaces
- Generated Java DTOs (Data Transfer Objects)
- Request/response models
- Error definitions

**Benefits:**
- ✅ Contracts defined once, used by frontend & backend
- ✅ Frontend can generate TypeScript interfaces automatically
- ✅ Backend can generate Java DTOs automatically
- ✅ Single source of truth prevents mismatch
- ✅ API documentation always in sync

---

## 📁 Project Structure

```
packages/api-contracts/
├── src/
│   ├── openapi.yaml                 ← OpenAPI 3.0 schema (main file)
│   ├── typescript/
│   │   ├── generated/
│   │   │   ├── models/
│   │   │   │   ├── user.ts
│   │   │   │   ├── order.ts
│   │   │   │   └── ...
│   │   │   └── api-client.ts        ← Generated API client
│   │   └── index.ts                 ← Export all
│   └── java/
│       ├── generated/
│       │   ├── UserDTO.java
│       │   ├── OrderDTO.java
│       │   └── ...
│       └── pom.xml                  ← Maven config (future)
├── package.json
├── README.md                        ← This file
└── .agent.md                        ← AI guidance
```

---

## 🔄 API Contract Workflow

### 1. Define Schema
Edit `src/openapi.yaml` with all endpoints:

```yaml
openapi: 3.0.0
info:
  title: DuaLEAPa Trading API
  version: 1.0.0

paths:
  /api/auth/login:
    post:
      summary: User login
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'

components:
  schemas:
    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string

    LoginResponse:
      type: object
      properties:
        token:
          type: string
          description: JWT token
        userId:
          type: integer
```

### 2. Generate TypeScript Interfaces
```bash
npm run generate:typescript
```

**Generated file:** `src/typescript/generated/models/auth.ts`
```typescript
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
}
```

### 3. Generate Java DTOs
```bash
mvn generate-sources
```

**Generated file:** `src/java/generated/LoginRequest.java`
```java
@Data
@Builder
public class LoginRequest {
    @NotBlank
    private String email;
    
    @NotBlank
    private String password;
}
```

### 4. Use in Frontend
```typescript
import { LoginRequest, LoginResponse } from '@packages/api-contracts';

@Injectable()
export class AuthService {
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>('/api/auth/login', credentials);
  }
}
```

### 5. Use in Backend
```java
@RestController
@RequestMapping("/api/auth")
public class AuthController {
  
  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    // Implementation
  }
}
```

---

## 📝 OpenAPI 3.0 Schema Structure

### Basic Template

```yaml
openapi: 3.0.0
info:
  title: DuaLEAPa Trading API
  description: Trading simulation platform API
  version: 1.0.0
  contact:
    name: API Support
    email: support@example.com

servers:
  - url: http://localhost:8080
    description: Development server
  - url: https://api.example.com
    description: Production server

paths:
  /api/endpoint:
    get:
      summary: Endpoint summary
      operationId: operationId
      parameters:
        - name: param
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Response'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    Response:
      type: object
      properties:
        data:
          type: object
        status:
          type: string
          enum: [success, error]

    Error:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
```

---

## 🔐 Authentication

### JWT Bearer Token
```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

### Usage in Endpoints
```yaml
paths:
  /api/users/profile:
    get:
      summary: Get user profile
      security:
        - bearerAuth: []
      responses:
        '200':
          description: User profile
        '401':
          description: Unauthorized
```

---

## 📦 Common Schemas

### User Schema
```yaml
User:
  type: object
  properties:
    id:
      type: integer
      format: int64
    email:
      type: string
      format: email
    firstName:
      type: string
    lastName:
      type: string
    role:
      type: string
      enum: [trader, admin]
    createdAt:
      type: string
      format: date-time
```

### Paginated Response
```yaml
PaginatedResponse:
  type: object
  properties:
    data:
      type: array
      items:
        type: object
    pagination:
      type: object
      properties:
        page:
          type: integer
        pageSize:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer
```

### Error Response
```yaml
Error:
  type: object
  required: [code, message]
  properties:
    code:
      type: integer
      description: HTTP status code
    message:
      type: string
      description: Error message
    details:
      type: array
      items:
        type: object
        properties:
          field:
            type: string
          issue:
            type: string
```

---

## 🛠️ Tools & Generators

### Generate TypeScript Client
```bash
npm run generate:typescript
# Outputs: src/typescript/generated/
```

### Generate Java DTOs
```bash
mvn generate-sources
# Outputs: src/java/generated/
```

### Generate SDK Documentation
```bash
npm run generate:docs
# Outputs: docs/api-reference.html
```

### Preview OpenAPI Schema
```bash
npm run swagger-ui
# Opens: http://localhost:8000
```

---

## 📋 Endpoints to Define

### Authentication
- `POST /api/auth/register` — User registration
- `POST /api/auth/login` — User login
- `POST /api/auth/refresh` — Refresh JWT token
- `POST /api/auth/verify` — Verify token validity
- `POST /api/auth/logout` — User logout

### Users
- `GET /api/users/{id}` — Get user profile
- `PUT /api/users/{id}` — Update user profile
- `DELETE /api/users/{id}` — Delete user

### Orders (Future)
- `POST /api/orders` — Create order
- `GET /api/orders/{id}` — Get order
- `GET /api/orders` — List user orders
- `PUT /api/orders/{id}` — Update order
- `DELETE /api/orders/{id}` — Cancel order

### Holdings (Future)
- `GET /api/holdings` — Get user holdings
- `GET /api/holdings/{symbol}` — Get specific holding

---

## 🚀 Quick Start

### View/Edit Schema
```bash
# Edit main schema
nano src/openapi.yaml
```

### Test Schema Validity
```bash
npm run validate
# Outputs: Schema validation results
```

### Generate All Artifacts
```bash
npm run generate
# Generates TypeScript + Java + Docs
```

### Publish Changes
```bash
# 1. Update openapi.yaml
# 2. Commit changes
# 3. Run generators in CI/CD
# 4. Frontend & backend auto-update
```

---

## 📚 Documentation

- **OpenAPI 3.0 Spec:** [https://spec.openapis.org/oas/v3.0.3](https://spec.openapis.org/oas/v3.0.3)
- **API Reference:** See [docs/APIREFERENCE.md](../../docs/APIREFERENCE.md)
- **Swagger UI:** View rendered API docs in browser

---

## ✅ Checklist for Updates

- [ ] Endpoint added to `openapi.yaml`
- [ ] Request/response schemas defined
- [ ] Authentication configured (if needed)
- [ ] Error responses documented
- [ ] TypeScript types generated
- [ ] Java DTOs generated
- [ ] Frontend service updated to use new interface
- [ ] Backend controller updated to accept new DTO
- [ ] Tests written for new endpoint
- [ ] Documentation updated in `docs/APIREFERENCE.md`

---

**Last Updated:** 2026-09-09  
**Maintained By:** DuaLEAPa API Team
