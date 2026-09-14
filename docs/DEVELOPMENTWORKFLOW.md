# Development Workflow Guide

## Prerequisites

### System Requirements
- **OS:** Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM:** 8GB minimum, 16GB recommended
- **Disk Space:** 20GB available for Docker images and databases

### Required Software
- **Git:** Latest version (for version control)
- **Node.js:** 22.x LTS (frontend builds)
- **npm:** 10.x (npm workspaces support)
- **Java:** JDK 21 (backend compilation)
- **Maven:** 3.9+ (build tool)
- **Docker:** 24.0+ with Docker Compose
- **Docker Compose:** Included with Docker Desktop

### Optional Tools
- **VS Code:** Latest version with extensions
  - ES7+ React/Redux/React-Native snippets
  - Prettier - Code formatter
  - ESLint
  - Java Extension Pack
  - Spring Boot Extension Pack
- **Postman or Insomnia:** REST API testing
- **DBeaver:** Database client for PostgreSQL
- **Git GUI:** SourceTree or GitHub Desktop

## Setup Instructions

### 1. Clone Repository

```bash
cd ~/projects
git clone https://github.com/your-org/dualeapa-sprint1-project.git
cd dualeapa-sprint1-project
```

### 2. Install Backend Dependencies

```bash
# Navigate to backend
cd apps/business-backend

# Install Maven dependencies
mvn clean install

# This will download all required Java libraries (may take 2-3 minutes first time)
```

### 3. Install Frontend Dependencies

```bash
# Install all npm dependencies across workspaces
npm install

# This installs:
# - apps/business-logic-ui dependencies
# - packages/shared-ui-components dependencies
# - root-level dev dependencies
```

### 4. Configure Environment Variables

Create `.env` file in project root:

```bash
# Backend Configuration
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/paysprint
SPRING_DATASOURCE_USERNAME=paysprint
SPRING_DATASOURCE_PASSWORD=changeme
JWT_SECRET=your-dev-secret-key-here
SPRING_PROFILES_ACTIVE=dev

# Frontend Configuration
API_URL=http://localhost:8080
API_TIMEOUT=30000

# Docker
DOCKER_BUILDKIT=1
COMPOSE_DOCKER_CLI_BUILD=1
```

### 5. Start Database

```bash
# Start PostgreSQL container only
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d postgres

# Verify database is running
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml exec postgres pg_isready

# Expected output: "accepting connections"
```

### 6. Run Database Migrations

```bash
# Option A: Using Spring Boot (automatic on startup)
# When you run the backend, Flyway migrations run automatically

# Option B: Manual migration
cd apps/business-backend
mvn flyway:migrate
```

## Running Services

### Option A: Full Stack with Docker Compose

Start all services (PostgreSQL, Spring Boot, Angular):

```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d

# View logs
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs -f

# Access:
# - Frontend: http://localhost:4200
# - Backend: http://localhost:8080
# - Database: localhost:5432
```

### Option B: Selective Service Startup

This approach provides better debugging and faster feedback loops.

#### Start Database Only

```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d postgres

# Verify connectivity
psql -h localhost -U paysprint -d paysprint -c "SELECT 1"
```

#### Run Backend (Spring Boot)

Terminal 1 - Backend:
```bash
cd apps/business-backend

# Run with Maven
mvn spring-boot:run

# Or run with IDE (VS Code - F5)
# Spring Boot Extension Pack provides debugging

# Output shows:
# - Flyway migrations running
# - Spring Boot startup messages
# - Listening on http://localhost:8080
```

#### Run Frontend (Angular)

Terminal 2 - Frontend:
```bash
cd apps/business-logic-ui

# Start development server
npm start

# Or with live reload
ng serve

# Output shows:
# - Development Server URL: http://localhost:4200
# - Listening for changes
# - Auto-recompile on file changes
```

### Option C: IDE Integration

#### VS Code Debugging

**Backend Debugging (Java):**
1. Open VS Code
2. Install Java Extension Pack
3. Open `apps/business-backend/`
4. Click Debug icon (Ctrl+Shift+D)
5. Select "Spring Boot App" from dropdown
6. Press F5 or click Run
7. Set breakpoints and step through code

**Frontend Debugging (Angular):**
1. Click Debug icon (Ctrl+Shift+D)
2. Select "ng serve" configuration
3. Opens Chrome DevTools
4. Set breakpoints in TypeScript code
5. View component state and props

## Testing

### Backend Unit Tests

```bash
cd apps/business-backend

# Run all tests
mvn test

# Run specific test class
mvn test -Dtest=AuthServiceTest

# Run with coverage
mvn clean test jacoco:report
# Coverage report: target/site/jacoco/index.html

# Run only integration tests
mvn verify -Pintegration-tests
```

### Backend Integration Tests

```bash
cd apps/business-backend

# Start test database
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d postgres

# Run integration tests (requires database)
mvn verify

# Test output shows:
# - Database initialization
# - Test execution
# - Coverage results
```

### Frontend Unit Tests

```bash
cd apps/business-logic-ui

# Run tests once
npm test

# Run tests in watch mode
npm run test -- --watch

# Generate coverage report
npm run test:coverage
# Report: coverage/index.html
```

### Frontend End-to-End Tests

```bash
cd apps/business-logic-ui

# Run e2e tests
npm run e2e

# Requires backend running on port 8080
# Tests actual user workflows
```

## Debugging

### Backend Debugging

#### Viewing Logs
```bash
# Stream logs from running container
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs -f backend

# Filter by logger
docker-compose logs backend | grep "AuthController"

# Last 100 lines
docker-compose logs backend --tail 100
```

#### Database Queries
```bash
# Connect to PostgreSQL
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml exec postgres psql -U paysprint -d paysprint

# Common queries
SELECT * FROM users;
SELECT * FROM orders WHERE user_id = '...';
SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 10;
```

#### Debug Endpoints
```bash
# Health check
curl http://localhost:8080/actuator/health

# Detailed metrics
curl http://localhost:8080/actuator/metrics

# Environment variables
curl http://localhost:8080/actuator/env

# Application properties
curl http://localhost:8080/actuator/configprops
```

### Frontend Debugging

#### Chrome DevTools
1. Open http://localhost:4200 in Chrome
2. Press F12 to open DevTools
3. View:
   - Network tab: HTTP requests/responses
   - Console: JavaScript errors and logs
   - Sources: Set breakpoints in TypeScript
   - Application: LocalStorage, SessionStorage
   - Performance: Profile load time

#### Angular DevTools Extension
1. Install Angular DevTools Chrome extension
2. Click extension icon when on Angular app
3. View component tree
4. Inspect component properties
5. View change detection cycles

#### VS Code Debugging
```typescript
// Add console logs
console.log('User data:', this.user);

// Add breakpoints
// Click line number in editor

// Debug browser processes
// Debug tab -> "ng serve" -> Set breakpoints
```

### Network Debugging

#### Proxy Network Requests
```bash
# Using Postman
1. Open Postman
2. Create GET request: http://localhost:8080/api/auth/login
3. View response headers and body
4. Save requests in collections

# Using curl
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

#### Monitor Database Queries
```bash
# Enable query logging in Spring Boot
# application.properties
spring.jpa.properties.hibernate.generate_statistics=true
logging.level.org.hibernate.stat=DEBUG
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE

# View slow queries
docker-compose exec postgres psql -U paysprint -d paysprint
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

## Common Development Tasks

### Adding New Dependencies

#### Backend (Java/Maven)
```bash
cd apps/business-backend

# Add dependency
mvn dependency:tree  # View current dependencies

# Edit pom.xml
# Add to <dependencies>:
# <dependency>
#     <groupId>org.springframework.boot</groupId>
#     <artifactId>spring-boot-starter-data-rest</artifactId>
# </dependency>

# Update dependencies
mvn dependency:resolve
```

#### Frontend (npm)
```bash
cd apps/business-logic-ui

# Add package
npm install @angular/animations

# Update packages
npm update

# Audit for vulnerabilities
npm audit
```

### Creating New Database Migration

```bash
# 1. Create migration file in apps/business-backend/db/migrations/
touch apps/business-backend/db/migrations/V003__Add_new_feature_table.sql

# 2. Add SQL statements
cat > apps/business-backend/db/migrations/V003__Add_new_feature_table.sql << 'EOF'
CREATE TABLE new_feature (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
EOF

# 3. Restart backend (Flyway runs automatically)
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml restart backend

# Or run manually
cd apps/business-backend
mvn flyway:migrate
```

### Creating New Angular Component

```bash
cd apps/business-logic-ui

# Generate component using CLI
ng generate component features/new-feature

# Structure created:
# src/app/features/new-feature/
# ├── new-feature.component.ts
# ├── new-feature.component.html
# ├── new-feature.component.css
# └── new-feature.component.spec.ts
```

### Creating New Spring Boot Endpoint

```bash
cd apps/business-backend

# 1. Create controller
cat > src/main/java/com/neueda/leap/feature/FeatureController.java << 'EOF'
@RestController
@RequestMapping("/api/feature")
public class FeatureController {
    @GetMapping("/{id}")
    public FeatureDto getFeature(@PathVariable Long id) {
        // implementation
    }
}
EOF

# 2. Create service
cat > src/main/java/com/neueda/leap/feature/FeatureService.java << 'EOF'
@Service
public class FeatureService {
    public FeatureDto getFeature(Long id) {
        // business logic
    }
}
EOF

# 3. Test endpoint
curl http://localhost:8080/api/feature/123
```

## Performance Optimization

### Frontend Optimization

#### Bundle Analysis
```bash
cd apps/business-logic-ui

# Generate bundle analysis
npm run build -- --stats-json

# Analyze bundles
npm install -g webpack-bundle-analyzer
webpack-bundle-analyzer dist/*/stats.json
```

#### Enable Production Mode
```bash
# Smaller bundles, faster execution
ng serve --prod

# Or in browser - check Network tab for file sizes
```

### Backend Optimization

#### Database Query Performance
```sql
-- Explain plan for slow queries
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = '...' AND created_at > NOW() - INTERVAL '30 days';

-- Add indexes if needed
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);
```

#### Enable Caching
```java
// In Spring Boot
@Cacheable("users")
public User getUser(UUID id) {
    return userRepository.findById(id).orElse(null);
}
```

## Cleanup

### Remove Containers and Data

```bash
# Stop all services
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down

# Remove volumes (database data)
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down -v

# Remove images
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down --rmi all
```

### Clean Build Artifacts

```bash
# Backend
cd apps/business-backend
mvn clean

# Frontend
cd apps/business-logic-ui
rm -rf node_modules dist

# All
npm run clean  # Uses turbo if configured
```

## Git Workflow

### Feature Branch Development

```bash
# 1. Create feature branch
git checkout -b feature/user-auth-improvements

# 2. Make changes
# Edit files, test locally

# 3. Commit changes
git add .
git commit -m "feat: improve user authentication flow"

# 4. Push to remote
git push origin feature/user-auth-improvements

# 5. Create Pull Request
# Go to GitHub and open PR for review

# 6. After approval, merge to main
git checkout main
git pull origin main
git merge feature/user-auth-improvements
git push origin main
```

### Useful Git Commands

```bash
# View changed files
git status

# View detailed changes
git diff

# Stage specific files
git add apps/business-backend/src/

# Commit with message
git commit -m "type: message"

# View commit history
git log --oneline -20

# Revert last commit (before push)
git reset --soft HEAD~1
```

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 8080
lsof -i :8080
kill -9 <PID>

# Or change port in docker-compose
ports:
  - "8081:8080"
```

### Database Connection Failed
```bash
# Check if database container is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

### npm Install Issues
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Java Compilation Issues
```bash
# Clean build
mvn clean compile

# Check Java version
java -version  # Should be 21

# Reimport in IDE
# VS Code: Ctrl+Shift+P -> "Java: Clean Language Server"
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [DATABASE.md](./DATABASE.md) - Database setup and schema
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [APIREFERENCE.md](./APIREFERENCE.md) - API documentation
