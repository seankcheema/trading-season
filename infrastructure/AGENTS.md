# Infrastructure - AI Agent Guidance

Guidance for AI agents working with DevOps infrastructure.

## Directory Purpose

**Deployment & operations** for all environments (development, staging, production).

**Contains:**
- Docker configurations
- docker-compose files (local & production)
- Nginx reverse proxy setup
- Jenkins CI/CD pipeline
- Deployment automation scripts

---

## When to Modify This Directory

✅ **Modify here:**
- Update docker-compose configurations
- Modify Nginx routing/SSL
- Update Jenkins pipeline stages
- Add new deployment scripts
- Update environment variables
- Configure secrets management
- Change resource limits/scaling

❌ **Do NOT modify:**
- Application code (see `apps/`)
- Database migrations (see `apps/business-backend/db/migrations/`)
- Shared libraries (see `packages/`)
- Documentation (see `docs/`)

---

## File Organization

```
infrastructure/
├── docker/
│   ├── build.sh              ← Build all images
│   └── push.sh               ← Push to registry
├── docker-compose/
│   ├── docker-compose.local.yml    ← Dev environment
│   └── docker-compose.prod.yml     ← Prod environment
├── nginx/
│   ├── nginx.conf            ← Reverse proxy config
│   └── ssl/                  ← SSL certificates (prod)
├── jenkins/
│   ├── Jenkinsfile           ← CI/CD pipeline
│   └── pipeline-scripts/
│       ├── build.sh
│       ├── test.sh
│       └── deploy.sh
├── README.md
└── .agent.md
```

---

## Common Tasks

### Run Local Environment
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up
# Services available:
# - Frontend: localhost:4200
# - Backend: localhost:8080
# - Database: localhost:5432
```

### View Logs
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs -f backend
# Follow backend logs
```

### Stop Services
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down
# Also: add -v to remove volumes (careful with production!)
```

### Update docker-compose
Edit `docker-compose.local.yml` or `docker-compose.prod.yml`:

```yaml
services:
  backend:
    image: dualeapa-backend:latest
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
      DB_PASSWORD: changeme
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

### Build Docker Images
```bash
# Single image
docker build -t dualeapa-backend:latest apps/business-backend/

# All images (via script)
./infrastructure/docker/build.sh
```

### Push to Registry
```bash
./infrastructure/docker/push.sh

# Or manually:
docker tag dualeapa-backend:latest my-registry.com/dualeapa-backend:latest
docker push my-registry.com/dualeapa-backend:latest
```

### Configure Nginx
Edit `infrastructure/nginx/nginx.conf`:

```nginx
server {
  listen 80;
  
  # Route to frontend
  location / {
    proxy_pass http://frontend:4200;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
  
  # Route to backend
  location /api/ {
    proxy_pass http://backend:8080;
    proxy_set_header Authorization $http_authorization;
  }
}
```

### Update Jenkins Pipeline
Edit `infrastructure/jenkins/Jenkinsfile`:

```groovy
pipeline {
  agent any

  stages {
    stage('Build') {
      steps {
        sh 'cd apps/business-backend && mvn clean package'
      }
    }

    stage('Test') {
      steps {
        sh 'cd apps/business-backend && mvn test'
      }
    }

    stage('Deploy') {
      steps {
        sh 'docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml up -d'
      }
    }
  }
}
```

---

## Environment Variables

### Local Development (`.env`)
```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=paysprint
DB_USERNAME=paysprint
DB_PASSWORD=changeme

# Backend
SERVER_PORT=8080
JAVA_OPTS=-Xmx512m

# Frontend
ANGULAR_APP_API_URL=http://localhost:8080
```

### Production
Store in secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.):
- Never commit `.env` to version control
- Never print secrets in logs
- Rotate secrets regularly

---

## Docker Compose Essentials

### Services
```yaml
services:
  postgres:              # Database
  backend:               # Spring Boot API
  frontend:              # Angular app
  nginx:                 # Reverse proxy
```

### Networks
```yaml
networks:
  local-network:
    driver: bridge
```

### Volumes
```yaml
volumes:
  postgres_data:         # Database persistence
    driver: local
```

### Environment Variables
```yaml
environment:
  DB_PASSWORD: ${DB_PASSWORD}  # From .env file
  API_URL: http://backend:8080
```

### Dependencies
```yaml
depends_on:
  - postgres             # Wait for postgres to start
```

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

## Docker Multi-Stage Builds

### Backend Build
```dockerfile
FROM maven:3.9-eclipse-temurin-21 as builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:resolve
COPY src src
RUN mvn clean package

FROM eclipse-temurin:21-jre
COPY --from=builder /app/target/*.jar app.jar
ENTRYPOINT ["java","-jar","app.jar"]
```

### Frontend Build
```dockerfile
FROM node:22-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js .
CMD ["node","server.js"]
```

---

## Networking

### Port Mapping
```yaml
ports:
  - "8080:8080"  # Host:Container
  - "5432:5432"  # Database (don't expose in production!)
```

### Internal Communication
Containers communicate via service name:
```
backend → postgres://postgres:5432/paysprint
frontend → http://backend:8080/api
```

### External Access
Via Nginx reverse proxy:
```
User → Nginx (port 80) → Backend (port 8080)
User → Nginx (port 80) → Frontend (port 4200)
```

---

## Security Considerations

### Secrets
❌ Don't commit:
- `.env` files
- Database passwords
- API keys
- SSH keys
- SSL certificates (dev OK, prod NO)

✅ Use:
- Environment variables
- Secrets manager (AWS, Azure, GCP)
- Docker secrets (Swarm mode)
- Kubernetes secrets (K8s)

### SSL/TLS (Production)
```nginx
server {
  listen 443 ssl;
  ssl_certificate /etc/nginx/ssl/cert.pem;
  ssl_certificate_key /etc/nginx/ssl/key.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### Database Security
```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${SECURE_PASSWORD}
    ports:
      - "5432:5432"  # Only expose internally!
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Connection refused" | Service not running | `docker-compose up` again |
| "Port already in use" | Port conflict | Change port in compose or kill process |
| "Database won't start" | Volume permission issue | `docker-compose down -v` (careful!) |
| "Nginx routing fails" | Service name mismatch | Verify service name in `depends_on` |
| "Secrets not loading" | .env file missing | Create .env with required variables |

---

## Monitoring

### Check Container Status
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml ps
```

### View Logs
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs -f
```

### Resource Usage
```bash
docker stats
```

### Health Checks
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml ps
# STATUS column shows healthy/unhealthy
```

---

## Quick Links

- **Root README:** [README.md](../../README.md)
- **Deployment Guide:** [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)
- **Development Workflow:** [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md)
- **Root Monorepo Guidance:** [.agent.md](../../.agent.md)

---

**Last Updated:** 2026-09-09
