# Swagger/OpenAPI Documentation

This document lists all available Swagger UI endpoints for the API services in the DuaLEAPa platform.

## Overview

The Java services expose SpringDoc OpenAPI directly, the NestJS auth service exposes Swagger from decorators, and the reporting service serves a checked-in OpenAPI document with Swagger UI. Interactive documentation is available at the endpoints below, and machine-readable specs are also provided.

## Service URLs

### Auth Service (NestJS)

- **Swagger UI**: http://localhost:3001/api/docs
- **OpenAPI Spec**: http://localhost:3001/api-json (or Swagger JSON endpoint)

### Holdings and Trade Service (Java/Spring Boot)

- **Server Port**: 8082
- **Swagger UI**: http://localhost:8082/swagger-ui.html
- **OpenAPI Spec (JSON)**: http://localhost:8082/v3/api-docs
- **OpenAPI Spec (YAML)**: http://localhost:8082/v3/api-docs.yaml

**API Tags/Endpoints**:
- **Authentication** - Account registration and verification
  - `POST /api/auth/register` - Register business account
  - `POST /api/auth/account-exists` - Check if account exists
- **Users** - User profile information
  - `GET /api/users/me` - Get authenticated user profile
- **Accounts** - Account and holdings management
  - `GET /api/me/accounts` - List user accounts
  - `GET /api/accounts/{accountId}` - Get account details
  - `GET /api/accounts/{accountId}/holdings` - List account holdings
  - `POST /api/me/accounts` - Create new account
  - `PUT /api/me/accounts/{accountId}` - Update account name
- **Cash Transactions** - User cash deposit and withdrawal
  - `GET /api/me/cash-transactions` - List cash transactions
  - `POST /api/me/cash-transactions` - Deposit or withdraw cash
- **Market Data** - Market data and trading simulation
  - `GET /api/market/snapshot` - Get current market snapshot
  - `GET /api/market/candles` - Get OHLCV candle data
  - `PUT /api/market/clock` - Set market clock
  - `GET /api/market/stream` - Subscribe to market data stream (Server-Sent Events)

### Order and Sell Service (Java/Spring Boot)

- **Server Port**: 8081
- **Swagger UI**: http://localhost:8081/swagger-ui.html
- **OpenAPI Spec (JSON)**: http://localhost:8081/v3/api-docs
- **OpenAPI Spec (YAML)**: http://localhost:8081/v3/api-docs.yaml

**API Tags/Endpoints**:
- **Authentication** - Account registration and verification
  - `POST /api/auth/register` - Register business account
  - `POST /api/auth/account-exists` - Check if account exists
- **Users** - User profile information
  - `GET /api/users/me` - Get authenticated user profile
- **Orders** - Order submission and retrieval
  - `POST /api/orders` - Submit an order
  - `GET /api/orders` - List user orders
- **Market Data** - Market data and trading simulation
  - `GET /api/market/snapshot` - Get current market snapshot
  - `GET /api/market/candles` - Get OHLCV candle data
  - `PUT /api/market/clock` - Set market clock
  - `GET /api/market/stream` - Subscribe to market data stream (Server-Sent Events)

### Reporting Service (Flask)

- **Server Port**: 8083
- **Swagger UI**: http://localhost:8083/docs
- **OpenAPI Spec (YAML)**: http://localhost:8083/openapi.yaml

**API Tags/Endpoints**:
- **Service**
  - `GET /` - Service metadata and documentation links
  - `GET /health` - Liveness and database connectivity check
- **Portfolio**
  - `GET /api/reporting/portfolio` - Caller portfolio summary across accounts
  - `GET /api/reporting/portfolio/{accountId}` - Single-account portfolio view
  - `GET /api/reporting/portfolio/{accountId}/performance` - Single-account performance metrics
  - `GET /api/reporting/portfolio/performance` - Aggregate portfolio performance
- **Trades**
  - `GET /api/reporting/trades` - Trade history with filtering and pagination
  - `GET /api/reporting/trades/{orderId}` - Trade or order detail
  - `GET /api/reporting/trades/statistics` - Aggregate trade statistics
  - `GET /api/reporting/trades/drill-down` - Grouped trade analytics
- **Profile**
  - `GET /api/reporting/profile` - Caller profile summary
- **Scheduler**
  - `GET /api/reporting/scheduler/status` - Refresh scheduler status

## Configuration

- **Auth Service**: Swagger UI at `/api/docs`, spec at `/api-json`
- **Java Services**: OpenAPI at `/v3/api-docs` and Swagger UI at `/swagger-ui.html`
- **Reporting Service**: OpenAPI at `/openapi.yaml` and Swagger UI at `/docs`
- **Bearer Authentication**: All protected services document JWT bearer token requirements

## Security

All endpoints requiring authentication are marked with "Authenticate using JWT Bearer Token" in the Swagger documentation. The JWT token is obtained from the Auth Service at `http://localhost:3001`.

## Accessing Swagger Documentation

1. **Start the services** using the standard dev server startup command
2. **Open your browser** to the appropriate Swagger UI URL above
3. **Authenticate** (if needed) by clicking "Authorize" and entering your JWT token
4. **Explore endpoints** with request/response schemas and example values

## Updating Documentation

To update Swagger documentation:

1. **For NestJS (Auth Service)**: Update `@ApiOperation`, `@ApiResponse` decorators in controllers
2. **For Java services**: Update `@Operation`, `@ApiResponse` annotations in controllers and add `@Schema` to DTOs
3. **For Reporting Service**: Update `apps/reporting-service/openapi.yaml` and keep `apps/reporting-service/app.py` docs routes (`/docs`, `/openapi.yaml`) intact
4. **Controller Documentation**: Use `@Tag` on controller classes to group endpoints
5. **Endpoint Documentation**: Use `@Operation` on controller methods with descriptions

Java and NestJS documentation is regenerated automatically when those services start. Reporting Service documentation is served from the checked-in OpenAPI file.
