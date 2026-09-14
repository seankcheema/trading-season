# API Reference

## Overview

The Trading Season Application provides a RESTful API for all client-server communication. All endpoints require authentication via JWT tokens (except for login/register endpoints).

**Base URL:** http://localhost:8080 (development) or https://api.example.com (production)

**Content-Type:** All requests and responses use `application/json`

## Authentication

### Token-Based Authentication (JWT)

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Getting a Token

1. Call POST /api/auth/login with credentials
2. Response includes token and expiration time
3. Include token in all subsequent requests
4. Token expires after configured duration (default: 24 hours)

## Error Handling

### Standard Error Response

All errors follow this format:

```json
{
    "timestamp": "2026-09-09T10:30:00Z",
    "status": 400,
    "error": "Bad Request",
    "message": "Invalid request parameters",
    "path": "/api/users/123"
}
```

### Error Status Codes

| Status | Meaning |
|--------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Duplicate resource |
| 500 | Internal Server Error - Server error |

## Authentication Endpoints

### POST /api/auth/login

User login and token generation.

**Request:**
```json
{
    "username": "john_doe",
    "password": "secure_password"
}
```

**Response (200 OK):**
```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "username": "john_doe",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe"
    },
    "expiresIn": 86400
}
```

**Error Response (401):**
```json
{
    "status": 401,
    "error": "Unauthorized",
    "message": "Invalid username or password"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "password": "secure_password"
  }'
```

### POST /api/auth/register

New user registration.

**Request:**
```json
{
    "username": "jane_doe",
    "email": "jane@example.com",
    "password": "secure_password",
    "firstName": "Jane",
    "lastName": "Doe",
    "address": "123 Main St, City, State 12345"
}
```

**Response (201 Created):**
```json
{
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "username": "jane_doe",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "createdAt": "2026-09-09T10:30:00Z"
}
```

**Error Response (409 Conflict):**
```json
{
    "status": 409,
    "error": "Conflict",
    "message": "Username already exists"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jane_doe",
    "email": "jane@example.com",
    "password": "secure_password",
    "firstName": "Jane",
    "lastName": "Doe",
    "address": "123 Main St"
  }'
```

### POST /api/auth/logout

User logout and token invalidation.

**Request:**
```
Header: Authorization: Bearer [token]
```

**Response (200 OK):**
```json
{
    "message": "Logged out successfully"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## User Endpoints

### GET /api/users/{userId}

Retrieve user profile information.

**Parameters:**
- `userId` (path, required): UUID of the user

**Response (200 OK):**
```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main St, City, State 12345",
    "createdAt": "2026-01-15T09:30:00Z",
    "updatedAt": "2026-09-09T10:30:00Z",
    "isActive": true
}
```

**Error Response (404 Not Found):**
```json
{
    "status": 404,
    "error": "Not Found",
    "message": "User not found"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer [token]"
```

### PUT /api/users/{userId}

Update user profile information.

**Parameters:**
- `userId` (path, required): UUID of the user

**Request:**
```json
{
    "email": "newemail@example.com",
    "firstName": "Jonathan",
    "address": "456 Oak Ave, City, State 54321"
}
```

**Response (200 OK):**
```json
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john_doe",
    "email": "newemail@example.com",
    "firstName": "Jonathan",
    "updatedAt": "2026-09-09T11:00:00Z"
}
```

**cURL Example:**
```bash
curl -X PUT http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "firstName": "Jonathan"
  }'
```

## Trading Season Endpoints

### POST /api/seasons

Create a new trading season.

**Request:**
```json
{
    "name": "Q3 2026 Strategy",
    "description": "Testing new momentum strategy",
    "startDate": "2026-09-01",
    "endDate": "2026-09-30",
    "initialCapital": 50000.00
}
```

**Response (201 Created):**
```json
{
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "name": "Q3 2026 Strategy",
    "description": "Testing new momentum strategy",
    "startDate": "2026-09-01",
    "endDate": "2026-09-30",
    "initialCapital": 50000.00,
    "status": "DRAFT",
    "createdAt": "2026-09-09T10:30:00Z"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/api/seasons \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q3 2026 Strategy",
    "startDate": "2026-09-01",
    "endDate": "2026-09-30",
    "initialCapital": 50000
  }'
```

### GET /api/seasons

List all trading seasons for authenticated user.

**Query Parameters:**
- `status` (optional): Filter by status (DRAFT, ACTIVE, COMPLETED)
- `page` (optional): Page number (default: 0)
- `size` (optional): Items per page (default: 20)

**Response (200 OK):**
```json
{
    "content": [
        {
            "id": "660e8400-e29b-41d4-a716-446655440002",
            "name": "Q3 2026 Strategy",
            "status": "ACTIVE",
            "startDate": "2026-09-01",
            "endDate": "2026-09-30",
            "initialCapital": 50000.00,
            "createdAt": "2026-09-09T10:30:00Z"
        }
    ],
    "totalElements": 5,
    "totalPages": 1,
    "currentPage": 0
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:8080/api/seasons?status=ACTIVE" \
  -H "Authorization: Bearer [token]"
```

### GET /api/seasons/{seasonId}

Retrieve specific trading season details.

**Parameters:**
- `seasonId` (path, required): UUID of the season

**Response (200 OK):**
```json
{
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "name": "Q3 2026 Strategy",
    "description": "Testing new momentum strategy",
    "status": "ACTIVE",
    "startDate": "2026-09-01",
    "endDate": "2026-09-30",
    "initialCapital": 50000.00,
    "currentValue": 52300.50,
    "performanceMetrics": {
        "totalReturn": 4.6,
        "winRate": 58.5,
        "maxDrawdown": -8.2
    },
    "createdAt": "2026-09-09T10:30:00Z",
    "updatedAt": "2026-09-09T15:45:00Z"
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8080/api/seasons/660e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer [token]"
```

### PUT /api/seasons/{seasonId}

Update trading season configuration.

**Parameters:**
- `seasonId` (path, required): UUID of the season

**Request:**
```json
{
    "name": "Updated Q3 Strategy",
    "description": "Fine-tuned parameters"
}
```

**Response (200 OK):**
```json
{
    "id": "660e8400-e29b-41d4-a716-446655440002",
    "name": "Updated Q3 Strategy",
    "description": "Fine-tuned parameters",
    "updatedAt": "2026-09-09T16:00:00Z"
}
```

### DELETE /api/seasons/{seasonId}

Delete a trading season (only DRAFT status).

**Parameters:**
- `seasonId` (path, required): UUID of the season

**Response (204 No Content):**
Empty response body

**Error Response (409 Conflict):**
```json
{
    "status": 409,
    "error": "Conflict",
    "message": "Cannot delete active season"
}
```

## Order Endpoints

### POST /api/orders

Create a new trade order.

**Request:**
```json
{
    "seasonId": "660e8400-e29b-41d4-a716-446655440002",
    "symbol": "AAPL",
    "orderType": "BUY",
    "quantity": 100,
    "price": 150.25
}
```

**Response (201 Created):**
```json
{
    "id": "770e8400-e29b-41d4-a716-446655440003",
    "seasonId": "660e8400-e29b-41d4-a716-446655440002",
    "symbol": "AAPL",
    "orderType": "BUY",
    "quantity": 100,
    "price": 150.25,
    "totalAmount": 15025.00,
    "orderStatus": "PENDING",
    "createdAt": "2026-09-09T14:20:00Z"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{
    "seasonId": "660e8400-e29b-41d4-a716-446655440002",
    "symbol": "AAPL",
    "orderType": "BUY",
    "quantity": 100,
    "price": 150.25
  }'
```

### GET /api/orders

List all orders for authenticated user.

**Query Parameters:**
- `seasonId` (optional): Filter by season
- `symbol` (optional): Filter by stock symbol
- `status` (optional): Filter by order status
- `page` (optional): Page number
- `size` (optional): Items per page

**Response (200 OK):**
```json
{
    "content": [
        {
            "id": "770e8400-e29b-41d4-a716-446655440003",
            "seasonId": "660e8400-e29b-41d4-a716-446655440002",
            "symbol": "AAPL",
            "orderType": "BUY",
            "quantity": 100,
            "orderStatus": "FILLED",
            "createdAt": "2026-09-09T14:20:00Z"
        }
    ],
    "totalElements": 42,
    "totalPages": 3,
    "currentPage": 0
}
```

### GET /api/orders/{orderId}

Retrieve specific order details.

**Parameters:**
- `orderId` (path, required): UUID of the order

**Response (200 OK):**
```json
{
    "id": "770e8400-e29b-41d4-a716-446655440003",
    "seasonId": "660e8400-e29b-41d4-a716-446655440002",
    "symbol": "AAPL",
    "orderType": "BUY",
    "quantity": 100,
    "price": 150.25,
    "totalAmount": 15025.00,
    "commission": 10.00,
    "orderStatus": "FILLED",
    "executions": [
        {
            "id": "880e8400-e29b-41d4-a716-446655440004",
            "executedQuantity": 100,
            "executedPrice": 150.25,
            "executionTime": "2026-09-09T14:20:15Z"
        }
    ],
    "createdAt": "2026-09-09T14:20:00Z",
    "executedAt": "2026-09-09T14:20:15Z"
}
```

### PUT /api/orders/{orderId}

Update order (only PENDING status).

**Parameters:**
- `orderId` (path, required): UUID of the order

**Request:**
```json
{
    "quantity": 150,
    "price": 149.50
}
```

**Response (200 OK):**
```json
{
    "id": "770e8400-e29b-41d4-a716-446655440003",
    "quantity": 150,
    "price": 149.50,
    "updatedAt": "2026-09-09T14:25:00Z"
}
```

### DELETE /api/orders/{orderId}

Cancel order (only PENDING status).

**Parameters:**
- `orderId` (path, required): UUID of the order

**Response (204 No Content):**
Empty response body

## Health & Status Endpoints

### GET /actuator/health

Health check endpoint for monitoring.

**Response (200 OK):**
```json
{
    "status": "UP",
    "components": {
        "db": {
            "status": "UP",
            "details": {
                "database": "PostgreSQL"
            }
        },
        "diskSpace": {
            "status": "UP"
        }
    }
}
```

### GET /actuator/metrics

Application metrics.

**Response (200 OK):**
```json
{
    "names": [
        "http.server.requests",
        "jvm.memory.used",
        "jvm.threads.live",
        "system.cpu.usage"
    ]
}
```

## Rate Limiting

Currently, no rate limiting is enforced. Future implementations will include:
- 1000 requests per hour per user
- 10,000 requests per hour per API key
- 429 Too Many Requests response

## Pagination

Endpoints supporting pagination include:
- `page`: 0-based page number (default: 0)
- `size`: Number of items per page (default: 20, max: 100)
- `sort`: Sort by field (e.g., `createdAt,desc`)

**Example:**
```
GET /api/orders?page=1&size=50&sort=createdAt,desc
```

## Response Format

All successful responses include appropriate HTTP status codes and JSON body:

```json
{
    "data": {},
    "message": "Operation successful",
    "timestamp": "2026-09-09T10:30:00Z"
}
```

## Testing with Postman

1. Import collection from `infrastructure/postman/collection.json`
2. Set environment variables:
   - `base_url`: http://localhost:8080
   - `token`: <paste token from login response>
3. Run requests with pre-configured headers and authentication

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [DEVELOPMENTWORKFLOW.md](./DEVELOPMENTWORKFLOW.md) - Testing endpoints locally
