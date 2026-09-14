# Deployment Guide

## Overview

This guide covers deploying the Trading Season Application across local development, staging, and production environments. The deployment pipeline uses Jenkins for CI/CD orchestration and Docker for containerization.

## Deployment Architecture

### Environments

**Local Development**
- Docker Compose on developer machine
- All services co-located
- Hot-reload enabled
- Database: PostgreSQL container

**Staging**
- Docker Compose on staging server
- Mirror of production setup
- Performance and security testing
- Backup and restore testing

**Production**
- Containerized services with orchestration
- Nginx reverse proxy
- Database replication and backups
- Monitoring and alerting

## CI/CD Pipeline (Jenkins)

### Pipeline Stages

The Jenkins pipeline (`infrastructure/jenkins/Jenkinsfile`) executes 9 stages:

#### Stage 1: Checkout
```groovy
stage('Checkout') {
    steps {
        checkout scm
        script {
            echo "Checked out from ${env.GIT_BRANCH}"
        }
    }
}
```
- Clones source code from Git repository
- Uses configured credentials for private repos

#### Stage 2: Build Backend
```bash
# Maven build
mvn clean package -f apps/business-backend/pom.xml

# Artifacts created:
# - apps/business-backend/target/leap-application.jar
# - test results in target/surefire-reports/
```
- Compiles Java code
- Runs unit tests
- Creates JAR artifact
- Fails on test failures

#### Stage 3: Build Frontend
```bash
# Install dependencies
cd apps/business-logic-ui
npm ci  # Use package-lock.json for reproducible builds

# Build optimized package
npm run build

# Artifacts:
# - apps/business-logic-ui/dist/
```
- Installs npm dependencies from lock file
- Runs TypeScript compilation
- Executes Angular build with optimizations
- Fails on TypeScript errors

#### Stage 4: Run Tests
```bash
# Backend tests
mvn test -f apps/business-backend/pom.xml

# Frontend tests
cd apps/business-logic-ui
npm run test

# Coverage reports generated
```
- Executes full test suite
- Generates coverage reports
- Fails on test failures
- Publishes results to Jenkins

#### Stage 5: Build Docker Images

**Backend Image**
```dockerfile
# Dockerfile: apps/business-backend/Dockerfile
FROM maven:3.9-eclipse-temurin-21 as builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/leap-application.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Frontend Image**
```dockerfile
# Multi-stage build
FROM node:22-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 4200
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build commands in pipeline
docker build -t leap-backend:${BUILD_NUMBER} apps/business-backend/
docker build -t leap-frontend:${BUILD_NUMBER} apps/business-logic-ui/
```

#### Stage 6: Push Docker Images
```bash
# Tag with registry
docker tag leap-backend:${BUILD_NUMBER} registry.example.com/leap-backend:${BUILD_NUMBER}
docker tag leap-backend:${BUILD_NUMBER} registry.example.com/leap-backend:latest

# Push to registry
docker push registry.example.com/leap-backend:${BUILD_NUMBER}
docker push registry.example.com/leap-backend:latest
```
- Authenticates to Docker registry
- Pushes images with build number and latest tags
- Uses secrets for registry credentials

#### Stage 7: Deploy to Staging
```bash
# Pull new images
docker-compose -f infrastructure/docker-compose/docker-compose.staging.yml pull

# Perform migrations
docker-compose -f infrastructure/docker-compose/docker-compose.staging.yml run backend flyway migrate

# Deploy services
docker-compose -f infrastructure/docker-compose/docker-compose.staging.yml up -d
```
- Deploys to staging environment
- Runs database migrations
- Verifies deployment health

#### Stage 8: Run Integration Tests
```bash
# Test backend API
curl -X POST http://staging-api.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Test frontend
npm run e2e --prefix apps/business-logic-ui/
```
- Executes integration tests against staging
- Validates API endpoints
- Tests frontend functionality

#### Stage 9: Deploy to Production
```bash
# Manual approval required
when {
    branch 'main'
    input 'Deploy to Production?'
}

# Production deployment
docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml pull
docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml up -d
```
- Requires manual approval
- Only deploys from main branch
- Uses production compose configuration
- Performs blue-green or rolling deployment

### Pipeline Configuration

**Jenkinsfile Location:** `infrastructure/jenkins/Jenkinsfile`

**Environment Variables:**
```groovy
environment {
    DOCKER_REGISTRY = 'registry.example.com'
    BUILD_NUMBER = "${env.BUILD_NUMBER}"
    GIT_BRANCH = "${env.GIT_BRANCH}"
}
```

**Credentials:**
```groovy
// Docker registry credentials
withCredentials([usernamePassword(credentialsId: 'docker-registry', 
                                  usernameVariable: 'DOCKER_USER', 
                                  passwordVariable: 'DOCKER_PASS')]) {
    sh 'docker login -u $DOCKER_USER -p $DOCKER_PASS $DOCKER_REGISTRY'
}
```

## Docker Compose Deployment

### Local Development Environment

**File:** `infrastructure/docker-compose/docker-compose.local.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: paysprint
      POSTGRES_USER: paysprint
      POSTGRES_PASSWORD: changeme
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./apps/business-backend/db/migrations:/docker-entrypoint-initdb.d

  backend:
    build:
      context: ./apps/business-backend
      dockerfile: Dockerfile
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/paysprint
      SPRING_DATASOURCE_USERNAME: paysprint
      SPRING_DATASOURCE_PASSWORD: changeme
      JWT_SECRET: your-secret-key-change-in-production
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    volumes:
      - ./apps/business-backend:/app
    command: >
      sh -c 'gradle bootRun'

  frontend:
    build:
      context: ./apps/business-logic-ui
      dockerfile: Dockerfile
    ports:
      - "4200:4200"
    environment:
      API_URL: http://localhost:8080
    depends_on:
      - backend
    volumes:
      - ./apps/business-logic-ui/src:/app/src

volumes:
  postgres_data:
```

**Startup Commands:**
```bash
# Navigate to project root
cd dualeapa-sprint1-project

# Start all services
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up -d

# View logs
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs -f

# Stop services
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down

# Remove volumes (reset database)
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down -v
```

### Production Environment

**File:** `infrastructure/docker-compose/docker-compose.prod.yml`

Key differences from local:
- No volume mounts (read-only containers)
- Environment variables from .env.prod (not in version control)
- Production database credentials
- Container resource limits
- Health checks enabled
- Logging configuration
- SSL/TLS termination

```yaml
services:
  backend:
    image: leap-backend:latest
    restart: always
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres-prod:5432/paysprint
      SPRING_DATASOURCE_USERNAME: ${DB_USER}
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    resources:
      limits:
        cpus: '1'
        memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

## Environment Variables

### Backend (.env)
```bash
# Database
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/paysprint
SPRING_DATASOURCE_USERNAME=paysprint
SPRING_DATASOURCE_PASSWORD=changeme

# Security
JWT_SECRET=change-this-in-production-use-strong-secret
JWT_EXPIRATION=86400000

# Application
SPRING_PROFILES_ACTIVE=dev
SERVER_PORT=8080

# Logging
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_COM_NEUEDA=DEBUG
```

### Frontend (.env)
```bash
# API Configuration
API_URL=http://localhost:8080
API_TIMEOUT=30000

# Feature Flags
FEATURE_REPORTING=false
FEATURE_BACKTESTING=false

# Analytics
ANALYTICS_ENABLED=false
```

## Secrets Management

### Jenkins Secrets
Store sensitive values in Jenkins Credentials Store:
- Docker registry credentials
- SSH keys for deployment servers
- Database passwords
- API tokens

**Usage in Jenkinsfile:**
```groovy
withCredentials([
    file(credentialsId: 'kube-config', variable: 'KUBECONFIG'),
    usernamePassword(credentialsId: 'db-password', 
                    usernameVariable: 'DB_USER', 
                    passwordVariable: 'DB_PASS')
]) {
    sh 'kubectl apply -f deployment.yaml'
}
```

### Environment Secrets
Production secrets stored in environment-specific files:
- `.env.prod` (not in version control)
- Encrypted secrets management (Vault, AWS Secrets Manager)
- Rotation policies for credentials

## Database Migrations

### Flyway Migration Process

1. Developer creates migration in `apps/business-backend/db/migrations/`
   ```sql
   -- V003__Add_new_feature_table.sql
   CREATE TABLE new_feature (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       ...
   );
   ```

2. Migration included in build artifact

3. On deployment:
   ```bash
   # Spring Boot automatically runs on startup
   # OR manual execution
   docker-compose exec backend java -cp app.jar org.flywaydb.core.Flyway migrate
   ```

4. Flyway records migration in `flyway_schema_history`

### Rollback Strategy
- Flyway supports undo migrations (Flyway Pro)
- Alternative: Create compensating migrations (V004__Undo_V003.sql)
- Manual restoration from backup for critical failures

## Health Checks and Monitoring

### Backend Health Check
```bash
# Liveness probe (service running)
curl http://localhost:8080/actuator/health

# Readiness probe (ready for traffic)
curl http://localhost:8080/actuator/health/readiness

# Detailed metrics
curl http://localhost:8080/actuator/metrics
```

### Docker Compose Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 30s
```

### Monitoring Metrics
- Application metrics via Spring Actuator
- Container metrics via docker stats
- Database query performance
- Error rates and logs

## Backup and Recovery

### Database Backups
```bash
# Full backup
docker-compose exec postgres pg_dump -U paysprint paysprint > backup.sql

# Compressed backup
docker-compose exec postgres pg_dump -U paysprint paysprint | gzip > backup.sql.gz

# Scheduled backup (cron)
0 2 * * * docker-compose -f /path/docker-compose.prod.yml exec -T postgres pg_dump -U paysprint paysprint | gzip > /backups/paysprint-$(date +\%Y\%m\%d).sql.gz
```

### Restore from Backup
```bash
# From backup file
docker-compose exec -T postgres psql -U paysprint paysprint < backup.sql

# From compressed backup
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U paysprint paysprint
```

### Backup Retention
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 1 year

## Scaling Considerations

### Horizontal Scaling Backend
```yaml
# Multiple backend instances
backend-1:
  image: leap-backend:latest
  environment:
    INSTANCE_ID: 1

backend-2:
  image: leap-backend:latest
  environment:
    INSTANCE_ID: 2

# Load balancer
nginx:
  upstream backend {
    server backend-1:8080;
    server backend-2:8080;
  }
```

### Database Replication
- Read replicas for reporting queries
- Primary for transactional writes
- Automated failover via Patroni

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs backend

# Inspect configuration
docker-compose config

# Rebuild image
docker-compose build --no-cache backend
```

### Database connection failures
```bash
# Verify database is running
docker-compose exec postgres pg_isready

# Check credentials
docker-compose exec postgres psql -U paysprint -d paysprint -c "SELECT 1"

# Check network connectivity
docker-compose exec backend curl postgres:5432
```

### Port conflicts
```bash
# Find process using port
lsof -i :8080

# Change port in docker-compose.yml
ports:
  - "8081:8080"  # Changed from 8080
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design
- [DATABASE.md](./DATABASE.md) - Database schema and management
- [DEVELOPMENTWORKFLOW.md](./DEVELOPMENTWORKFLOW.md) - Local development setup
