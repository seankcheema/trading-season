# Business Backend - AI Agent Guidance

Guidance for AI agents working with the Spring Boot 3.3.4 backend API.

## Directory Purpose

**Spring Boot 3.3.4** REST API server with authentication, user management, and order processing.

**Tech Stack:**
- Java 21
- Spring Boot 3.3.4
- Spring Security (JWT authentication)
- Spring Data JPA (Hibernate)
- PostgreSQL 16
- Flyway (database migrations)
- Maven (build tool)

**Runs on:** http://localhost:8080  
**Database:** postgresql://localhost:5432/paysprint

---

## When to Modify This App

✅ **Modify here:**
- Add new REST API endpoints
- Implement business logic (services, repositories)
- Modify database schema (via Flyway migrations)
- Update authentication/security
- Fix backend bugs
- Add unit/integration tests
- Update Maven dependencies

❌ **Do NOT modify:**
- Frontend UI (see `apps/business-logic-ui/`)
- Shared libraries (see `packages/`)
- API contracts (see `packages/api-contracts/`)
- Docker infrastructure (see `infrastructure/`)

---

## File Organization

```
apps/business-backend/
├── src/
│   ├── main/
│   │   ├── java/com/neueda/leap/
│   │   │   ├── Main.java                  ← @SpringBootApplication entry
│   │   │   ├── auth/                      ← Authentication module
│   │   │   │   ├── AuthController.java    ← REST endpoints
│   │   │   │   ├── AuthService.java       ← Business logic
│   │   │   │   ├── SecurityConfig.java    ← Spring Security config
│   │   │   │   ├── JwtTokenProvider.java  ← JWT handling (future)
│   │   │   │   └── ...
│   │   │   └── user/                      ← User management
│   │   │       ├── User.java              ← JPA entity
│   │   │       ├── UserController.java
│   │   │       ├── UserService.java
│   │   │       ├── UserRepository.java    ← Data access
│   │   │       └── ...
│   │   └── resources/
│   │       ├── application.properties     ← App config
│   │       ├── application-test.properties← Test config
│   │       └── logback-spring.xml         ← Logging config
│   ├── test/
│   │   ├── java/com/neueda/leap/
│   │   │   ├── auth/
│   │   │   │   ├── AuthServiceTest.java
│   │   │   │   ├── AuthControllerTest.java
│   │   │   │   └── ...
│   │   │   └── user/
│   │   │       └── ...
│   │   └── resources/
│   │       └── application-test.properties
│   └── db/
│       └── migrations/
│           ├── V001__Initial_schema.sql
│           ├── V002__Add_audit_table.sql
│           └── ...
├── pom.xml                               ← Maven config
├── Dockerfile                            ← Container image
└── README.md                             ← User guide
```

---

## Common Tasks

### Add a New REST Endpoint

**1. Create Controller**
```java
// src/main/java/com/neueda/leap/order/OrderController.java
@RestController
@RequestMapping("/api/orders")
public class OrderController {
  
  @PostMapping
  public ResponseEntity<?> createOrder(@RequestBody OrderRequest req) {
    // Handle order creation
  }
  
  @GetMapping("/{id}")
  public ResponseEntity<?> getOrder(@PathVariable Long id) {
    // Handle get order
  }
}
```

**2. Create Service**
```java
// src/main/java/com/neueda/leap/order/OrderService.java
@Service
public class OrderService {
  
  @Autowired
  private OrderRepository repository;
  
  public Order createOrder(OrderRequest request) {
    // Business logic
  }
}
```

**3. Create Repository**
```java
// src/main/java/com/neueda/leap/order/OrderRepository.java
public interface OrderRepository extends JpaRepository<Order, Long> {
  List<Order> findByAccountId(Long accountId);
}
```

**4. Create Entity**
```java
// src/main/java/com/neueda/leap/order/Order.java
@Entity
@Table(name = "orders")
public class Order {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  
  @Column(nullable = false)
  private Long accountId;
  
  // ... other fields
}
```

### Add a Database Migration

**1. Create migration file:**
```
src/db/migrations/V003__Add_orders_table.sql
```

**2. Write SQL:**
```sql
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  symbol VARCHAR(10) NOT NULL,
  quantity DECIMAL(18,2) NOT NULL,
  price DECIMAL(18,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX idx_orders_account_id ON orders(account_id);
```

**3. Restart app** — Flyway applies automatically on startup.

### Add Unit Test

```java
// src/test/java/com/neueda/leap/auth/AuthServiceTest.java
@SpringBootTest
class AuthServiceTest {
  
  @Autowired
  private AuthService authService;
  
  @Test
  void testLoginSuccess() {
    // Test logic
    assertNotNull(result);
  }
}
```

### Run Application

```bash
# Development
mvn spring-boot:run

# With specific profile
mvn spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=dev"

# With system properties
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xmx512m"
```

### Run Tests

```bash
mvn clean test                    # All tests
mvn test -Dgroups=unit           # Unit tests only
mvn test -Dgroups=integration    # Integration tests only
mvn test -Dtest=AuthServiceTest  # Specific test
```

### Build JAR

```bash
mvn clean package
# Output: target/sprint1-greeter-app-0.1.0.jar
java -jar target/sprint1-greeter-app-0.1.0.jar
```

---

## Important Files to Know

| File | Purpose |
|------|---------|
| `pom.xml` | Maven build config, dependencies, plugins |
| `src/main/java/com/neueda/leap/Main.java` | Spring Boot entry point (@SpringBootApplication) |
| `src/main/resources/application.properties` | Runtime configuration (DB, logging, etc.) |
| `src/test/resources/application-test.properties` | Test configuration |
| `src/db/migrations/` | Flyway SQL migrations (VXX__*.sql) |

---

## Maven Commands

| Command | Purpose |
|---------|---------|
| `mvn clean install` | Clean & install dependencies |
| `mvn clean package` | Build JAR artifact |
| `mvn spring-boot:run` | Run app directly |
| `mvn test` | Run all tests |
| `mvn verify` | Run tests & build checks |
| `mvn compile` | Compile source code only |
| `mvn dependency:tree` | Show dependency tree |

---

## Spring Boot Basics

### @Controller vs @RestController
- `@RestController` — Returns JSON (REST API) — use this!
- `@Controller` — Returns view/HTML

### Dependency Injection
```java
@Service
public class MyService {
  @Autowired  // Spring injects dependency
  private UserRepository repo;
}
```

### Request Mapping
```java
@PostMapping("/api/users")        // POST /api/users
@GetMapping("/api/users/{id}")    // GET /api/users/{id}
@PutMapping("/api/users/{id}")    // PUT /api/users/{id}
@DeleteMapping("/api/users/{id}") // DELETE /api/users/{id}
```

### Request/Response
```java
@PostMapping
public ResponseEntity<User> create(@RequestBody UserRequest req) {
  User user = service.createUser(req);
  return ResponseEntity.ok(user);
}
```

---

## Database / Flyway

### Naming Convention
- `V001__Initial_schema.sql` — First migration
- `V002__Add_users_table.sql` — Second migration
- `V003__Add_indexes.sql` — Third migration

**Format:** `V[version]__[description].sql`

### Never Edit Existing Migrations
❌ Wrong:
```sql
-- Don't modify V001__Initial.sql
```

✅ Correct:
```sql
-- Create new migration: V002__Add_column.sql
ALTER TABLE users ADD COLUMN role VARCHAR(50);
```

### Check Migrations
```bash
# Migrations auto-applied on startup
# View in database:
SELECT * FROM flyway_schema_history;
```

---

## Authentication (Spring Security + JWT)

### Flow
1. User submits credentials → `POST /api/auth/login`
2. Backend verifies password (BCrypt)
3. Backend generates JWT token
4. Frontend stores token in localStorage
5. Frontend sends token in `Authorization: Bearer <token>` header
6. Backend validates token in SecurityFilter

### JWT Token Components
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
│ HEADER                          │ PAYLOAD                        │ SIGNATURE           │
```

### Spring Security Configuration
Located in `src/main/java/.../SecurityConfig.java`:
- Defines which endpoints require authentication
- Configures JWT filter
- Sets up CORS
- Defines password encoder (BCrypt)

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Connection refused" | DB not running | `docker-compose up postgres` |
| "Flyway error" | Migration SQL syntax error | Check migration file in `src/db/migrations/` |
| "Port 8080 in use" | Another process using port | Change `server.port` in `application.properties` |
| "Dependency not found" | Maven cache stale | `mvn clean install` |
| "Entity not found" | Wrong table/column name | Check migration & entity mapping |
| "401 Unauthorized" | No token or invalid token | Send `Authorization: Bearer <token>` header |

---

## Quick Links

- **Root README:** [README.md](../../README.md)
- **Database Schema:** [docs/DATABASE.md](../../docs/DATABASE.md)
- **API Reference:** [docs/APIREFERENCE.md](../../docs/APIREFERENCE.md)
- **Development Setup:** [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md)
- **Deployment:** [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)

---

**Last Updated:** 2026-09-09
