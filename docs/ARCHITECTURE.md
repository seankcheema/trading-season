# Architecture Overview

## System Design

This monorepo implements a modern web application architecture with a clear separation between frontend, backend, and shared components. The system is designed to support trading season management and order processing with real-time data analysis.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  apps/business-logic-ui (Angular 22.1)                       │  │
│  │  - Login/Register components                                 │  │
│  │  - Dashboard and trading interface                           │  │
│  │  - Real-time order management                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ REST API (JSON)
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend Layer                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  apps/business-backend (Spring Boot 3.3.4)                   │  │
│  │  - REST API Endpoints                                        │  │
│  │  - JWT Authentication & Security                            │  │
│  │  - Business Logic & Order Processing                         │  │
│  │  - Database Access Layer (JPA/Hibernate)                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ JDBC
                                 │
┌─────────────────────────────────────────────────────────────────────┐
│                      Data Layer                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL 16 Database                                      │  │
│  │  - 6 logical domains (~25 tables)                            │  │
│  │  - Audit trail on all transactions                           │  │
│  │  - Flyway migrations for schema versioning                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework:** Angular 22.1 (latest, TypeScript strict mode)
- **UI Components:** SpartanNG 1.3.4 (shared-ui-components)
- **Styling:** TailwindCSS 4.3.3
- **Testing:** Vitest + Jasmine + Karma
- **Package Manager:** npm with workspaces
- **Architecture:** Standalone components (no NgModules), reactive forms

### Backend
- **Framework:** Spring Boot 3.3.4
- **Language:** Java 21
- **Build Tool:** Maven 3.9+
- **Security:** Spring Security with JWT tokens
- **Data Access:** Spring Data JPA + Hibernate
- **Migrations:** Flyway for database versioning
- **Testing:** JUnit 5

### Database
- **System:** PostgreSQL 16
- **Driver:** PostgreSQL JDBC
- **Access Pattern:** Connection pooling via Spring
- **Versioning:** Flyway migrations (V001__, V002__, etc.)

### DevOps & Infrastructure
- **Containerization:** Docker with multi-stage builds
- **Orchestration:** docker-compose for local and production
- **CI/CD:** Jenkins with 9-stage pipeline
- **Task Runner:** Turborepo for monorepo coordination
- **Reverse Proxy:** Nginx for routing

## Application Domains

### 1. Business Logic UI (apps/business-logic-ui)
Angular application providing user interface for trading operations.

**Key Components:**
- `auth/` - Login, registration, session management
- `dashboard/` - Main trading interface
- `orders/` - Order management and tracking
- Shared UI components from `packages/shared-ui-components`

**Route Structure:**
- `/login` - Authentication
- `/register` - User registration
- `/dashboard` - Main trading interface
- Protected routes with JWT validation

### 2. Business Backend (apps/business-backend)
Spring Boot REST API serving all business logic and data operations.

**Package Structure:**
```
src/main/java/com/neueda/leap/
├── Main.java (Application entry point)
├── auth/
│   ├── AuthController.java
│   ├── AuthService.java
│   ├── SecurityConfig.java
│   └── JWT utilities
├── user/
│   ├── UserController.java
│   ├── UserService.java
│   ├── User (entity)
│   ├── UserRepository (JPA)
│   └── SessionRepository (JPA)
└── [domain-specific packages]
```

**API Endpoints:**
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/users/{id}` - Retrieve user profile
- `GET /api/orders` - List user orders
- Additional endpoints per business domain

### 3. Shared UI Components (packages/shared-ui-components)
Reusable Angular component library following standalone component pattern.

**Component Library:**
```
src/lib/
├── button/ - Styled button components
├── card/ - Card layouts and sections
├── field/ - Form field wrappers
├── input/ - Text input with validation
├── label/ - Form labels
├── select/ - Dropdown selectors
├── native-select/ - Native select elements
├── separator/ - Visual separators
└── utils/ - Utility functions
```

**Import Pattern:**
```typescript
import { HlmButtonDirective } from '@packages/shared-ui-components';
```

### 4. Future Services (Placeholder Structure)
- `apps/reporting-ui/` - Analytics dashboard
- `apps/reporting-service/` - Data aggregation and reporting
- `apps/auth-service/` - Authentication microservice (future)
- `packages/api-contracts/` - OpenAPI/AsyncAPI schemas

## Monorepo Structure

### Root Level Configuration
- `package.json` - npm workspaces and root scripts
- `turbo.json` - Turborepo task orchestration
- `.agent.md` - Monorepo-wide AI guidelines
- `README.md` - Navigation and quick start

### Directory Organization
```
c:/dualeapa-sprint1-project/
├── apps/
│   ├── business-backend/       (Spring Boot + Java)
│   ├── business-logic-ui/      (Angular + SpartanNG)
│   ├── reporting-ui/           (Future: Analytics UI)
│   ├── reporting-service/      (Future: Analytics Backend)
│   └── auth-service/           (Future: Auth Microservice)
├── packages/
│   ├── shared-ui-components/   (Reusable UI components)
│   └── api-contracts/          (OpenAPI/AsyncAPI schemas)
├── infrastructure/
│   ├── docker/                 (Docker images)
│   ├── docker-compose/         (Compose configurations)
│   ├── jenkins/                (Pipeline definitions)
│   └── nginx/                  (Reverse proxy config)
├── scripts/
│   ├── backtesting/            (Trading backtest scripts)
│   └── analytics/              (Analytics and metrics)
├── docs/                       (Centralized documentation)
└── .github/
    └── workflows/              (GitHub Actions)
```

## Data Flow

### Authentication Flow
1. User submits login/registration via Angular form
2. Frontend sends credentials to `POST /api/auth/login|register`
3. Backend validates and generates JWT token
4. Frontend stores token in session/localStorage
5. Subsequent requests include token in Authorization header
6. Backend validates token via SecurityConfig interceptor

### Order Processing Flow
1. User submits order via trading interface
2. Frontend sends request with JWT token
3. Backend AuthController validates token
4. OrderService processes business logic
5. JPA persists to PostgreSQL
6. Flyway migrations ensure schema compatibility
7. Audit trail logged for compliance

### Database Migration Flow
1. Developer creates migration: `V002__Add_new_table.sql`
2. Migration placed in `apps/business-backend/db/migrations/`
3. Spring Boot startup triggers Flyway
4. Migrations applied in version order
5. Schema version tracked in `flyway_schema_history` table

## Security Architecture

### Authentication
- JWT tokens (Bearer tokens in Authorization header)
- Token expiration and refresh mechanisms
- Spring Security filter chain

### Authorization
- Role-based access control (RBAC)
- Method-level security annotations
- Route guards in Angular

### Data Protection
- HTTPS for all communication
- Encrypted database passwords in environment variables
- SQL injection prevention via parameterized queries
- CORS configuration for frontend origin

## Deployment Architecture

### Local Development
- Docker Compose runs: PostgreSQL, Spring Boot, Angular app
- Services communicate via container networking
- Hot-reload enabled for both frontend and backend

### Production
- Containerized services in Kubernetes/Docker Swarm
- Nginx reverse proxy for routing
- Jenkins CI/CD pipeline orchestrates deployments
- Environment-specific configurations

## Performance Considerations

### Frontend
- Lazy loading of Angular routes
- OnPush change detection strategy
- Async pipes for reactive data
- Tree-shaking optimizations in production builds

### Backend
- Connection pooling for database access
- JPA entity caching strategies
- Index optimization for frequently queried tables
- Pagination for large result sets

### Database
- Strategic indexing on foreign keys and frequently searched columns
- Partitioning for audit tables (time-based)
- Regular vacuum and analyze operations

## Scalability Strategy

### Horizontal Scaling
- Stateless backend allows multiple instances
- Load balancing via Nginx
- Session state stored in PostgreSQL

### Vertical Scaling
- Database query optimization
- Caching layer (Redis - future consideration)
- Increased server resources

### Database Scaling
- Read replicas for reporting queries
- Partitioning of large tables
- Separate read-only database access tier

## Future Architecture Enhancements

1. **Microservices Migration** - Split into independent services (auth, reporting, analytics)
2. **Event-Driven Architecture** - Message queue (RabbitMQ/Kafka) for async processing
3. **Caching Layer** - Redis for session and data caching
4. **Real-time Updates** - WebSockets for live data feeds
5. **Analytics Platform** - Time-series database for metrics and reporting
6. **API Gateway** - Kong or Spring Cloud Gateway for API management

## Related Documentation

- [DATABASE.md](./DATABASE.md) - Schema design and entity relationships
- [DEPLOYMENT.md](./DEPLOYMENT.md) - CI/CD pipeline and deployment procedures
- [DEVELOPMENTWORKFLOW.md](./DEVELOPMENTWORKFLOW.md) - Local development setup
- [APIREFERENCE.md](./APIREFERENCE.md) - REST API endpoint documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
