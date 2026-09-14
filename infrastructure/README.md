# Infrastructure - DevOps & Deployment

All deployment configurations, CI/CD pipelines, containerization, and orchestration for the DuaLEAPa platform.

## 📋 Overview

**Purpose:** Centralized DevOps infrastructure for local development, testing, and production deployment.

**Includes:**
- Docker configuration & build scripts
- Docker Compose (local & production)
- Nginx reverse proxy setup
- Jenkins CI/CD pipeline
- Deployment documentation

---

## 📁 Project Structure

```
infrastructure/
├── docker/                          ← Docker utilities & build scripts
│   ├── build.sh                     ← Multi-image build script
│   └── push.sh                      ← Push to registry
├── docker-compose/
│   ├── docker-compose.local.yml     ← Development environment
│   └── docker-compose.prod.yml      ← Production environment
├── nginx/
│   ├── nginx.conf                   ← Reverse proxy config
│   └── ssl/                         ← SSL certificates (production)
├── jenkins/
│   ├── Jenkinsfile                  ← CI/CD pipeline definition
│   └── pipeline-scripts/            ← Helper scripts
│       ├── build.sh
│       ├── test.sh
│       └── deploy.sh
├── README.md                        ← This file
└── .agent.md                        ← AI guidance
```

---

## 🐳 Docker Compose

### Local Development

**File:** `docker-compose.local.yml`

```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up
```

**Services:**
- **postgres** — PostgreSQL 16 database
- **backend** — Spring Boot API (port 8080)
- **frontend** — Angular app (port 4200) — commented out
- **nginx** — Reverse proxy (port 80)

**Network:** `local-network` (custom bridge)

**Volumes:** Named volume for PostgreSQL data persistence

### Production

**File:** `docker-compose.prod.yml`

```bash
docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml up -d
```

**Differences from local:**
- Uses `restart: always` for reliability
- Environment variables from `.env` (secrets)
- Healthchecks enabled
- Resource limits set
- Logging configured for ELK stack
- SSL termination in Nginx

---

## 🌐 Nginx Reverse Proxy

**File:** `infrastructure/nginx/nginx.conf`

Routes traffic to backend & frontend:
```nginx
server {
  listen 80;
  server_name localhost;

  # Frontend (Angular)
  location / {
    proxy_pass http://frontend:4200;
  }

  # Backend API
  location /api/ {
    proxy_pass http://backend:8080;
  }
}
```

**Production (SSL):**
```nginx
server {
  listen 443 ssl;
  ssl_certificate /etc/nginx/ssl/cert.pem;
  ssl_certificate_key /etc/nginx/ssl/key.pem;
  # ... rest of config
}
```

---

## 🔄 Jenkins CI/CD Pipeline

**File:** `infrastructure/jenkins/Jenkinsfile`

### Pipeline Stages

1. **Checkout** — Clone repository
2. **Build Backend** — Maven: `mvn clean package`
3. **Test Backend** — Run unit & integration tests
4. **Build Frontend** — npm: `npm run build`
5. **Test Frontend** — npm: `npm run test`
6. **Build Docker Images** — Create container images
7. **Push to Registry** — Push to Docker Hub/ECR
8. **Deploy** — Deploy using docker-compose
9. **Smoke Tests** — Verify deployment

## Trouble Shoot Maven 21:
cd /home/ec2-user/dualeapa-sprint1-project/apps/business-backend

**Clear Maven cache**
rm -rf ~/.m2/repository

**Export JAVA_HOME to be sure**
export JAVA_HOME=/usr/lib/jvm/java-21-amazon-corretto
export PATH=$JAVA_HOME/bin:$PATH

**Verify Maven sees Java 21**
mvn -version

**Try the build again**
mvn clean package

---

### Running Pipeline

```groovy
pipeline {
  agent any

  environment {
    DOCKER_REGISTRY = 'docker.io'
    DOCKER_CREDENTIALS = credentials('docker-hub-credentials')
  }

  stages {
    stage('Checkout') {
      steps {
        git branch: 'main', url: 'https://github.com/yourusername/dualeapa.git'
      }
    }

    stage('Build Backend') {
      steps {
        sh 'cd apps/business-backend && mvn clean package'
      }
    }

    stage('Build Frontend') {
      steps {
        sh 'cd apps/business-logic-ui && npm install && npm run build'
      }
    }

    stage('Build Docker Images') {
      steps {
        sh '''
          docker build -t $DOCKER_REGISTRY/dualeapa-backend:latest apps/business-backend/
          docker build -t $DOCKER_REGISTRY/dualeapa-frontend:latest apps/business-logic-ui/
        '''
      }
    }

    stage('Push to Registry') {
      steps {
        sh '''
          docker push $DOCKER_REGISTRY/dualeapa-backend:latest
          docker push $DOCKER_REGISTRY/dualeapa-frontend:latest
        '''
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

## 🚀 Deployment Workflows

### Local Development
```bash
cd dualeapa-sprint1-project
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up
```

**Available on:**
- Frontend: http://localhost:4200
- Backend: http://localhost:8080
- Nginx: http://localhost:80
- Database: localhost:5432

### Production Deployment
```bash
# 1. Pull latest code
git pull origin main

# 2. Set environment variables
export DOCKER_REGISTRY=my-registry.com
export DB_PASSWORD=<secret>

# 3. Deploy
docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml up -d

# 4. Verify
curl https://api.example.com/health
```

### Rollback
```bash
# Use previous image tag
docker-compose -f infrastructure/docker-compose/docker-compose.prod.yml up -d --pull=never
```

---

## 🔐 Secrets Management

### Local Development
Secrets stored in `.env` (not version-controlled):
```bash
DB_PASSWORD=changeme
API_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

### Production
Use environment manager:
- **AWS:** Secrets Manager or Parameter Store
- **GCP:** Secret Manager
- **Azure:** Key Vault
- **Docker Swarm:** `docker secret`
- **Kubernetes:** `kubectl create secret`

---

## 🔍 Monitoring & Logging

### Docker Logs
```bash
# All services
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs

# Specific service
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs backend

# Follow logs
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs -f
```

### Application Logs
- **Backend:** `/var/log/spring-boot/app.log` (in container)
- **Frontend:** Browser console (development)

### Health Checks
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

## 🏗️ Scaling & Performance

### Horizontal Scaling (Multiple Instances)
```yaml
services:
  backend:
    deploy:
      replicas: 3    # Run 3 instances
    ports:
      - "8080:8080"  # Load balanced via Nginx
```

### Resource Limits
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## 🐛 Troubleshooting

### Container Won't Start
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml logs backend
# Check for error messages
```

### Port Already in Use
```bash
# Find process using port 8080
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Database Connection Error
```bash
# Ensure postgres container is running
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml ps

# Check network
docker network ls
docker network inspect dualeapa-sprint1-project_local-network
```

---

## 📚 Documentation

For detailed guides, see:
- [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) — Production deployment
- [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md) — Local setup
- [ROOT README.md](../../README.md) — Quick start

---

**Last Updated:** 2026-09-09  
**Maintained By:** DuaLEAPa DevOps Team
