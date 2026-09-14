# Business Backend - Spring Boot 3.3.4 API

The core REST API server, authentication system, and database management for the DuaLEAPa trading simulation platform.

## 📋 Overview

**Technology:** Spring Boot 3.3.4, Spring Security, JPA/Hibernate, PostgreSQL 16, Maven  
**Port:** http://localhost:8080  
**Java Version:** 21  
**Build Tool:** Maven 3.9+

## 🎯 Features

- **Authentication** — JWT-based login, registration, token refresh, verification
- **User Management** — User profiles, sessions, role-based access
- **Order Processing** — Trade order creation, execution, filling
- **Database** — PostgreSQL 16 with Flyway migrations
- **API Documentation** — Swagger/OpenAPI (future)

## 🚀 Quick Start

### Prerequisites
- Java 21
- Maven 3.9+
- PostgreSQL 16 (via Docker)
- Git

### Installation
```bash
cd apps/business-backend
mvn clean install
```

### Run Database
```bash
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up postgres
```

### Start Backend
```bash
mvn spring-boot:run
```
Runs on http://localhost:8080

### Run Tests
```bash
mvn clean test
```
Tests are split into unit (fast) and integration (with DB).

### Build JAR
```bash
mvn clean package
```
Output: `target/sprint1-greeter-app.jar`

---

## 📁 Project Structure

```
apps/business-backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/neueda/leap/
│   │   │       ├── Main.java                ← Spring Boot entry point
│   │   │       ├── auth/
│   │   │       │   ├── AuthController.java  ← REST endpoints
│   │   │       │   ├── AuthService.java     ← Business logic
│   │   │       │   ├── SecurityConfig.java  ← Spring Security config
│   │   │       │   └── *.java               ← Other auth classes
│   │   │       └── user/
│   │   │           ├── User.java            ← Entity
│   │   │           ├── UserRepository.java  ← Database access
│   │   │           └── *.java               ← Other user classes
│   │   └── resources/
│   │       └── application.properties       ← App config
│   ├── test/
│   │   ├── java/
│   │   │   └── com/neueda/leap/
│   │   │       └── auth/
│   │   │           └── *Test.java           ← Unit & integration tests
│   │   └── resources/
│   │       └── application-test.properties  ← Test config
│   └── db/
│       └── migrations/
│           ├── V001__Initial_schema.sql     ← Flyway migrations
│           └── V002_*.sql
├── pom.xml                                  ← Maven config
├── Dockerfile                               ← Container image
└── README.md                                ← This file
```

---

## 🗄️ Database Setup

### Migrations
Database migrations are in `src/db/migrations/` using Flyway.

**Naming convention:** `V###__Description.sql`
```
V001__Initial_schema.sql          ← Initial database setup
V002__Add_audit_table.sql         ← Schema changes
V003__Add_indexes.sql             ← Performance optimizations
```

**Automatic on startup:** Flyway applies pending migrations when app starts.

### PostgreSQL Connection
**Local connection string:**
```
jdbc:postgresql://localhost:5432/paysprint
Username: paysprint
Password: changeme (from docker-compose)
```

**Connection pool:** HikariCP (default, configured in `application.properties`)

### Viewing Database
```bash
# Connect with psql
psql -h localhost -U paysprint -d paysprint

# View tables
\dt

# View specific table
\d users
```

### Reset Database (Development)
```bash
# Stop containers
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml down

# Remove volume
docker volume rm dualeapa-sprint1-project_postgres_data

# Restart
docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up postgres
```

---

## 🔐 Authentication & Security

### Authentication Flow
1. **Register** → `POST /api/auth/register` → User created in DB
2. **Login** → `POST /api/auth/login` → Returns JWT token
3. **Use Token** → Include in `Authorization: Bearer <token>` header
4. **Refresh** → `POST /api/auth/refresh` → New token if expired
5. **Verify** → `POST /api/auth/verify` → Check token validity

### JWT Token Structure
```
Header.Payload.Signature
```
- **Header:** Algorithm & type
- **Payload:** User ID, roles, expiration time
- **Signature:** Cryptographic signature

### Spring Security Configuration
```java
// SecurityConfig.java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
  // Defines which endpoints require authentication
  // CORS settings
  // JWT filter configuration
}
```

### Password Encoding
Passwords hashed with BCrypt via Spring Security Crypto:
```java
PasswordEncoder encoder = new BCryptPasswordEncoder();
String encoded = encoder.encode("plaintext-password");
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/verify` | Verify token |

### User Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/users/{id}` | Get user profile |
| PUT | `/api/users/{id}` | Update user profile |
| DELETE | `/api/users/{id}` | Delete user |

**See [docs/APIREFERENCE.md](../../docs/APIREFERENCE.md) for full API documentation.**

---

## 📦 Dependencies

### Core
- `spring-boot-starter-web` — REST API
- `spring-boot-starter-security` — Authentication & authorization
- `spring-boot-starter-data-jpa` — Database ORM
- `spring-boot-starter-validation` — Bean validation

### Database
- `org.postgresql:postgresql` — PostgreSQL driver
- `org.flywaydb:flyway-core` — Database migrations

### Testing
- `spring-boot-starter-test` — Test framework
- `junit-jupiter-api` — JUnit 5

### Other
- `io.jsonwebtoken:jjwt` — JWT tokens (if added)

---

## 🧪 Testing

### Test Structure
```
src/test/java/com/neueda/leap/
├── auth/
│   ├── AuthServiceTest.java        ← Unit tests (no DB)
│   ├── AuthControllerTest.java     ← Integration tests (with DB)
│   └── SecurityConfigTest.java
└── user/
    ├── UserRepositoryTest.java
    └── UserServiceTest.java
```

### Unit Tests (Fast, No Database)
```bash
mvn test -Dgroups=unit
```

### Integration Tests (With Database)
```bash
mvn test -Dgroups=integration
```

### All Tests
```bash
mvn test
```

### Coverage Report
```bash
mvn clean test jacoco:report
```
Report in `target/site/jacoco/index.html`

---

## 🚢 Building & Deployment

### Build JAR
```bash
mvn clean package
```
Output: `target/sprint1-greeter-app-0.1.0.jar`

### Run JAR Locally
```bash
java -jar target/sprint1-greeter-app-0.1.0.jar
```

### Docker
```bash
docker build -t dualeapa-business-backend:latest .
docker run -p 8080:8080 \
  -e DB_HOST=postgres \
  -e DB_PASSWORD=changeme \
  dualeapa-business-backend:latest
```

### Environment Variables
```bash
DB_HOST=localhost          # Database host
DB_PORT=5432               # Database port
DB_NAME=paysprint          # Database name
DB_USERNAME=paysprint      # Database user
DB_PASSWORD=changeme       # Database password
SERVER_PORT=8080           # Server port
```

---

## ⚙️ Configuration

### application.properties
```properties
# Server
server.port=8080
server.servlet.context-path=/

# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/paysprint
spring.datasource.username=paysprint
spring.datasource.password=${DB_PASSWORD:changeme}

# JPA/Hibernate
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQL16Dialect
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=false

# Flyway
spring.flyway.baselineOnMigrate=true

# Logging
logging.level.root=INFO
logging.level.com.neueda.leap=DEBUG
```

---

## 🐛 Troubleshooting

### "Connection refused" to database
- Ensure PostgreSQL is running: `docker ps | grep postgres`
- Check DB host/port in `application.properties`
- Try: `docker-compose -f infrastructure/docker-compose/docker-compose.local.yml up postgres`

### "Flyway migration failed"
- Migrations must be in `src/db/migrations/`
- Naming must follow `V###__Description.sql`
- Check migration file for SQL syntax errors
- Cannot modify existing migrations (create new one instead)

### "Port 8080 already in use"
- Find process: `lsof -i :8080` (macOS/Linux)
- Kill process: `kill -9 <PID>`
- Or change port in `application.properties`: `server.port=8081`

### "Authentication failed"
- Check JWT token is in request: `Authorization: Bearer <token>`
- Verify token hasn't expired
- Check user has required roles

---

## 📚 Documentation

For full details, see:
- [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md) — Local setup
- [docs/DATABASE.md](../../docs/DATABASE.md) — Database schema
- [docs/APIREFERENCE.md](../../docs/APIREFERENCE.md) — API endpoints
- [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md) — Production deployment

---

## ✅ Checklist for New Contributors

- [ ] Java 21 installed: `java -version`
- [ ] Maven installed: `mvn -v`
- [ ] PostgreSQL 16 running in Docker
- [ ] Run `mvn clean install` successfully
- [ ] Run `mvn spring-boot:run` (starts on localhost:8080)
- [ ] Run `mvn test` (all tests pass)
- [ ] Explore database: `psql -h localhost -U paysprint -d paysprint`
- [ ] Review [docs/DATABASE.md](../../docs/DATABASE.md)
- [ ] Review [docs/APIREFERENCE.md](../../docs/APIREFERENCE.md)

---

**Last Updated:** 2026-09-09  
**Maintained By:** DuaLEAPa Backend Team
