# Shared Code Refactoring Guide

This document maps duplicated code areas between Holdings and Trade Service and Order and Sell Service, with specific file paths, line ranges, and refactoring playbooks.

## Overview

| Area | Duplication | Lines | Extraction Candidate |
| --- | --- | --- | --- |
| Auth registration | Controllers + DTOs | ~250 | `shared-java-lib/auth-registration` |
| Market data | Controllers + services | ~400 | `shared-java-lib/market-data` |
| JWT validation | Security config | ~150 | `shared-java-lib/jwt-validation` |
| Entity models | JPA entities | ~500 | `shared-java-lib/trading-entities` |
| Error handling | Exception handlers | ~100 | `shared-java-lib/error-handling` |
| **Total estimated duplication** | | **~1,400 lines** | |

---

## 1. Authentication Registration (250 lines)

### Controllers
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/auth/AuthController.java
  - POST /api/auth/account-exists (lines ~20–40)
  - POST /api/auth/register (lines ~41–85)
  - GET /api/users/me (lines ~86–100)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/auth/AuthController.java
  - POST /api/auth/account-exists (lines ~20–40)
  - POST /api/auth/register (lines ~41–85)
  - GET /api/users/me (lines ~86–100)
```

**Status:** Exact duplicate (can verify with `diff`)

### Data Transfer Objects
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/auth/
  - RegisterRequest.java (~30 lines, includes validation annotations)
  - UserProfileResponse.java (~25 lines)
  - AccountExistsRequest.java (~10 lines)
  - AccountExistsResponse.java (~8 lines)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/auth/
  - RegisterRequest.java (identical)
  - UserProfileResponse.java (identical)
  - AccountExistsRequest.java (identical)
  - AccountExistsResponse.java (identical)
```

**Status:** Exact duplicate

### Services
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/auth/AuthService.java
  - register() method (~50 lines, handles email validation, profile storage, audit)
  - getUserProfile() method (~15 lines, joins user + account data)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/auth/AuthService.java
  - register() method (identical ~50 lines)
  - getUserProfile() method (identical ~15 lines)
```

**Status:** Exact duplicate (minor differences only in audit event names)

### Refactoring Playbook: Extract `shared-java-lib/auth-registration`

**Step 1: Create library module**
```bash
cd apps
mkdir -p shared-java-lib/auth-registration/src/main/java/com/trading/auth
cd shared-java-lib/auth-registration
cat > pom.xml << 'EOF'
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.trading</groupId>
  <artifactId>auth-registration</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>
EOF
```

**Step 2: Move shared classes**
```bash
# Copy DTOs
cp ../holdings-and-trade-service/src/main/java/app/auth/RegisterRequest.java \
   shared-java-lib/auth-registration/src/main/java/com/trading/auth/

# Copy AuthService (shared logic only)
cp ../holdings-and-trade-service/src/main/java/app/auth/AuthService.java \
   shared-java-lib/auth-registration/src/main/java/com/trading/auth/
```

**Step 3: Create abstract base controller**
```java
// Location: shared-java-lib/auth-registration/src/main/java/com/trading/auth/BaseAuthController.java

@RestController
@RequestMapping("/api/auth")
public abstract class BaseAuthController {
  protected final AuthService authService;
  
  @PostMapping("/account-exists")
  public ResponseEntity<?> accountExists(@RequestBody AccountExistsRequest request) {
    // Shared implementation
  }
  
  @PostMapping("/register")
  public ResponseEntity<?> register(
      @RequestHeader("Authorization") String bearerToken,
      @RequestBody RegisterRequest request) {
    // Shared implementation
  }
  
  @GetMapping("/users/me")
  public ResponseEntity<?> getUserProfile(@RequestHeader("Authorization") String token) {
    // Shared implementation
  }
}
```

**Step 4: Update consuming services**
```java
// In both services, replace AuthController

// Before:
@RestController
@RequestMapping("/api/auth")
public class AuthController { ... }

// After:
@RestController
@RequestMapping("/api/auth")
public class AuthController extends BaseAuthController { }
```

**Step 5: Update pom.xml in both services**
```xml
<dependency>
  <groupId>com.trading</groupId>
  <artifactId>auth-registration</artifactId>
  <version>1.0.0</version>
</dependency>
```

**Step 6: Verify and test**
```bash
mvn clean install -f apps/shared-java-lib/auth-registration/pom.xml
mvn -B -f apps/holdings-and-trade-service/pom.xml test
mvn -B -f apps/order-and-sell-service/pom.xml test
```

---

## 2. Market Data Endpoints (400 lines)

### Controllers
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/market/MarketController.java
  - GET /api/market/snapshot (lines ~30–60)
  - GET /api/market/candles (lines ~61–100)
  - GET /api/market/stream (lines ~101–140)
  - PUT /api/market/clock (lines ~141–180)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/market/MarketController.java
  - GET /api/market/snapshot (lines ~30–60, IDENTICAL)
  - GET /api/market/candles (lines ~61–100, IDENTICAL)
  - GET /api/market/stream (lines ~101–140, IDENTICAL)
  - PUT /api/market/clock (lines ~141–180, IDENTICAL)
```

**Status:** Exact duplicate

### Services and helpers
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/market/
  - MarketDataService.java (~100 lines, snapshot/candles query logic)
  - StreamingService.java (~80 lines, SSE event streaming)
  - CandleAggregator.java (~50 lines, timeframe aggregation)
  - ReplayService.java (~60 lines, simulation replay cursor)
  - MarketDataValidator.java (~30 lines, request validation)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/market/
  - MarketDataService.java (IDENTICAL ~100 lines)
  - StreamingService.java (IDENTICAL ~80 lines)
  - CandleAggregator.java (IDENTICAL ~50 lines)
  - ReplayService.java (IDENTICAL ~60 lines)
  - MarketDataValidator.java (IDENTICAL ~30 lines)
```

**Status:** Exact duplicate

### Refactoring Playbook: Extract `shared-java-lib/market-data`

**Step 1: Create library (same structure as above)**

**Step 2: Move all market-related classes**
```bash
# Move entire market package
cp -r apps/holdings-and-trade-service/src/main/java/app/market/* \
      apps/shared-java-lib/market-data/src/main/java/com/trading/market/
```

**Step 3: Create abstract market controller**
```java
@RestController
@RequestMapping("/api/market")
public abstract class BaseMarketController {
  protected final MarketDataService marketDataService;
  protected final StreamingService streamingService;
  
  @GetMapping("/snapshot")
  public ResponseEntity<?> getSnapshot(...) { }
  
  @GetMapping("/candles")
  public ResponseEntity<?> getCandles(...) { }
  
  @GetMapping("/stream")
  public SseEmitter getStream(...) { }
  
  @PutMapping("/clock")
  public ResponseEntity<?> setClock(...) { }
}
```

**Step 4: Update both services**
```java
@RestController
public class MarketController extends BaseMarketController { }
```

**Step 5: Verify**
```bash
mvn clean install -f apps/shared-java-lib/market-data/pom.xml
mvn -B -f apps/holdings-and-trade-service/pom.xml test
mvn -B -f apps/order-and-sell-service/pom.xml test
```

---

## 3. JWT Validation Configuration (150 lines)

### Security Configuration
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/config/SecurityConfig.java
  - JWT bean configuration (~40 lines)
  - JWKS fetching and caching (~50 lines)
  - Token validation filter (~30 lines)
  - Bearer token extraction (~15 lines)
  - Claims validation (~15 lines)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/config/SecurityConfig.java
  - JWT bean configuration (IDENTICAL ~40 lines)
  - JWKS fetching and caching (IDENTICAL ~50 lines)
  - Token validation filter (IDENTICAL ~30 lines)
  - Bearer token extraction (IDENTICAL ~15 lines)
  - Claims validation (IDENTICAL ~15 lines)
```

**Status:** Exact duplicate (even config property names are identical)

### Refactoring Playbook: Extract `shared-java-lib/jwt-validation`

**Recommended to extract AFTER auth-registration and market-data**, since JWT is a cross-cutting concern.

**Key components to extract:**
```java
// JwtConfig.java – configures JWT properties and JwtDecoder bean
@Configuration
public class JwtConfig {
  @Bean
  public JwtDecoder jwtDecoder(JwtProperties props) { }
  
  @Bean
  public JwksClient jwksClient(JwtProperties props) { }
}

// JwtProperties.java – holds issuer, audience, key set URI
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties { }

// JwtValidator.java – claims and signature validation
public class JwtValidator { }

// TokenExtractor.java – bearer token extraction from headers
public class TokenExtractor { }
```

---

## 4. Entity Models (500 lines)

### Shared Table Entities
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/entity/
  - User.java (~40 lines, profile + funds)
  - Stock.java (~30 lines, tradable symbols)
  - Instrument.java (~35 lines, asset class)
  - MarketState.java (~25 lines, session state)
  - Quote.java (~20 lines, latest price)
  - Candle.java (~25 lines, OHLCV bar)
  - SimulationSession.java (~30 lines, run metadata)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/entity/
  - User.java (IDENTICAL)
  - Stock.java (IDENTICAL)
  - Instrument.java (IDENTICAL)
  - MarketState.java (IDENTICAL)
  - Quote.java (IDENTICAL)
  - Candle.java (IDENTICAL)
  - SimulationSession.java (IDENTICAL)
```

**Status:** Exact duplicate JPA entity definitions

### Refactoring Playbook: Extract `shared-java-lib/trading-entities`

**This is a dependency for market-data and auth-registration libraries.**

**Step 1: Create library with JPA entities**

**Step 2: Make both services import from library**
```xml
<dependency>
  <groupId>com.trading</groupId>
  <artifactId>trading-entities</artifactId>
  <version>1.0.0</version>
</dependency>
```

**Step 3: Remove duplicate entity definitions from both services**

**Step 4: Update repository interfaces to extend JpaRepository<SharedEntity, ID>**

---

## 5. Error Handling (100 lines)

### Exception Handlers
**Holdings and Trade Service:**
```
apps/holdings-and-trade-service/src/main/java/app/auth/GlobalExceptionHandler.java
  - @ExceptionHandler(ValidationException.class) (~15 lines)
  - @ExceptionHandler(AuthenticationException.class) (~15 lines)
  - @ExceptionHandler(ResourceNotFoundException.class) (~10 lines)
  - buildErrorResponse() (~10 lines)
  - errorToHttpStatus() (~15 lines)
```

**Order and Sell Service:**
```
apps/order-and-sell-service/src/main/java/app/auth/GlobalExceptionHandler.java
  - Identical handlers and mappings
```

**Status:** Exact duplicate (same error codes, same response format)

### Refactoring Playbook: Extract `shared-java-lib/error-handling`

**Step 1: Create library with shared exception types**
```java
public class ValidationException extends RuntimeException { }
public class AuthenticationException extends RuntimeException { }
public class ResourceNotFoundException extends RuntimeException { }
```

**Step 2: Create shared error response DTO**
```java
@Data
public class ErrorResponse {
  private String error;
  private int status;
  private long timestamp;
}
```

**Step 3: Create shareable exception handler base**
```java
public class SharedExceptionHandler {
  public ErrorResponse handleValidationException(ValidationException e) { }
  public ErrorResponse handleAuthenticationException(AuthenticationException e) { }
  // ...
}
```

**Step 4: Both services extend it**
```java
@ControllerAdvice
public class GlobalExceptionHandler extends SharedExceptionHandler { }
```

---

## Extraction Dependency Order

**Must follow this sequence to avoid circular dependencies:**

```
1. trading-entities (no dependencies on other shared libs)
   ↓
2. error-handling (depends on trading-entities)
   ↓
3. jwt-validation (depends on trading-entities, error-handling)
   ↓
4. auth-registration (depends on trading-entities, error-handling, jwt-validation)
   ↓
5. market-data (depends on trading-entities, error-handling, jwt-validation)
```

---

## Verification Checklist

After each extraction:

- [ ] All tests pass in library (`mvn clean test`)
- [ ] Library can be packaged as JAR (`mvn clean package`)
- [ ] Both consuming services can build (`mvn clean install`)
- [ ] Both services pass their test suites
- [ ] No compilation warnings or errors
- [ ] No unused imports in extracted code
- [ ] Javadoc is updated for public APIs
- [ ] Shared Javadocs in library reference both consuming services

---

## Metrics Tracking

**After each phase, record:**

```markdown
### Phase 1.X Completion
- Date: YYYY-MM-DD
- Library: [name]
- Lines removed from Holdings and Trade Service: N
- Lines removed from Order and Sell Service: N
- Tests added to library: N
- Commits: [PR link]
```

---

## See Also

- [Cleanup Tasks](CLEANUP_TASKS.md) for removing unused code
- [Order and Sell Service Documentation](services/order-and-sell-service.md)
- [Holdings and Trade Service Documentation](services/holdings-and-trade-service.md)
