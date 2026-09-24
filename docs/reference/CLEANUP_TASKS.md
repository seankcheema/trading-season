# Order and Sell Service Cleanup Tasks

This document outlines code removal and refactoring tasks for the Order and Sell Service, which currently contains unused packages and duplicate endpoints.

## Context

The Order and Sell Service was designed to split order processing from user profile/market reads, but the split was never completed. Currently:
- Holdings and Trade Service handles all order processing AND user profiles
- Order and Sell Service provides only the same user profile and market data endpoints (duplicates)
- Order and Sell Service has unused packages for holdings and accounts that will never be called

The frontend UI routes all `/api` calls to Holdings and Trade Service exclusively.

---

## Phase 1: Remove Unused Code (Low Risk)

These packages contain no live code paths and can be safely deleted without affecting any running endpoint.

### Task 1.1: Delete unused account package
**Scope:** `apps/order-and-sell-service/src/main/java/app/account/`

**Files to remove:**
- Account entity class
- AccountRepository interface
- All related tests

**Rationale:** Order and Sell Service never instantiates or queries accounts. The holdings endpoints that would use this are not implemented.

**Verification:** 
```bash
cd apps/order-and-sell-service && grep -r "new Account\|accountRepository\|app\.account\." src/ --include="*.java" | grep -v "^Binary"
```
Should return no results (except test files you're deleting).

---

### Task 1.2: Delete unused holding package
**Scope:** `apps/order-and-sell-service/src/main/java/app/holding/`

**Files to remove:**
- Holding entity class
- HoldingRepository interface
- All related tests

**Rationale:** Order and Sell Service never instantiates or queries holdings. No controller uses this package.

**Verification:**
```bash
cd apps/order-and-sell-service && grep -r "new Holding\|holdingRepository\|app\.holding\." src/ --include="*.java" | grep -v "^Binary"
```
Should return no results.

---

### Task 1.3: Delete unused trading (order processing) package
**Scope:** `apps/order-and-sell-service/src/main/java/app/trading/` (if it exists)

**Files to remove:**
- Order service classes
- Order validation classes
- Order controller (if separate from auth)
- All related tests

**Rationale:** Order and Sell Service never processes orders. All order logic is in Holdings and Trade Service.

---

### Task 1.4: Delete unused cash transaction package
**Scope:** `apps/order-and-sell-service/src/main/java/app/cash/` (if it exists)

**Files to remove:**
- Cash transaction service classes
- Cash transaction controller (if separate from auth)
- All related tests

**Rationale:** Order and Sell Service never handles cash transactions.

---

## Phase 2: Identify Duplicate Code (Medium Effort)

These are code areas that are exact or near-exact duplicates between the two services.

### Task 2.1: Auth registration controllers
**Location:** 
- Holdings and Trade: `apps/holdings-and-trade-service/src/main/java/app/auth/AuthController.java`
- Order and Sell: `apps/order-and-sell-service/src/main/java/app/auth/AuthController.java`

**Duplicates:**
- POST /api/auth/register (identical implementation)
- GET /api/users/me (identical implementation)
- POST /api/auth/account-exists (identical implementation)

**Lines of code:** ~200 identical lines across both services

**Extraction option:** Create `apps/shared-java-lib/auth-registration` library

---

### Task 2.2: Market data controllers
**Location:**
- Holdings and Trade: `apps/holdings-and-trade-service/src/main/java/app/market/MarketController.java`
- Order and Sell: `apps/order-and-sell-service/src/main/java/app/market/MarketController.java`

**Duplicates:**
- GET /api/market/snapshot (identical implementation)
- GET /api/market/candles (identical implementation)
- GET /api/market/stream (identical implementation)
- PUT /api/market/clock (identical implementation)

**Lines of code:** ~400 identical lines across both services

**Extraction option:** Create `apps/shared-java-lib/market-data` library

---

### Task 2.3: JWT validation configuration
**Location:**
- Both services configure RS256 validation, JWKS caching, and token claims verification independently

**Shared logic:**
- JwtConfig or SecurityConfig bean
- JWKS fetch and cache logic
- Claims validator methods
- Exception mapping for auth failures

**Lines of code:** ~150 duplicated lines per service

**Extraction option:** Create `apps/shared-java-lib/jwt-validation` library

---

### Task 2.4: Entity model classes (shared tables)
**Location:**
- Both services define User, Stock, Instrument, MarketState, Quote, etc. as JPA entities

**Duplicates:**
- `app.entity.User` – Profile, funds, trading settings (exact duplicate)
- `app.entity.Stock` – Tradable instrument reference (exact duplicate)
- `app.entity.Instrument` – Asset class data (exact duplicate)
- `app.entity.MarketState`, `app.entity.Quote`, `app.entity.Candle` (all exact duplicates)

**Lines of code:** ~500 duplicated lines per service

**Extraction option:** Create `apps/shared-java-lib/trading-entities` library

---

### Task 2.5: Exception handlers and error formatting
**Location:**
- Both services define GlobalExceptionHandler and similar error response formatting

**Duplicates:**
- `{"error": "message"}` JSON response structure
- HTTP status code mapping
- Logging/auditing of errors
- CORS and validation error handling

**Lines of code:** ~100 duplicated lines per service

**Extraction option:** Create `apps/shared-java-lib/error-handling` library

---

## Phase 3: Consolidation Strategies (High Effort)

Choose one long-term approach.

### Option A: Extract Shared Libraries (Recommended for incremental work)
**Timeline:** 2–3 sprints of incremental refactoring

**Steps:**
1. Create gradle multi-module project under `apps/shared-java-lib/`
2. Extract auth-registration library first (Phase 2.1)
3. Extract market-data library (Phase 2.2)
4. Extract jwt-validation library (Phase 2.3)
5. Extract trading-entities library (Phase 2.4)
6. Extract error-handling library (Phase 2.5)
7. Update both services to depend on libraries instead of duplicating code
8. Remove unused packages from Order and Sell Service (Phase 1)

**Pros:** Works with existing deployment; doesn't break service independence
**Cons:** Requires dependency coordination; need to maintain version alignment

### Option B: Consolidate to Holdings and Trade Service (Simplest)
**Timeline:** 1 sprint

**Steps:**
1. Delete Order and Sell Service entirely (or keep as skeleton for future)
2. Holdings and Trade Service becomes the only backend for trading logic
3. Run all market data and auth endpoints from port 8081
4. Redirect or deprecate port 8082

**Pros:** Eliminates duplication immediately; simpler deployment
**Cons:** Loses intended separation; may need refactoring later when Order and Sell Service is truly implemented

### Option C: Proper Service Split (Architectural correctness)
**Timeline:** 2–4 sprints

**Steps:**
1. Move auth registration to shared Auth Service (NestJS extension or separate Java service)
2. Move market data endpoints to dedicated Market Data Service
3. Holdings and Trade Service → only order processing and accounting
4. Order and Sell Service → user profiles and holdings queries (complete the split)
5. Implement missing endpoints in Order and Sell Service

**Pros:** Clean architecture; each service has single responsibility
**Cons:** Most effort; requires frontend routing changes

---

## Priority Ranking

**Do immediately (Phase 1):**
- Remove unused account/holding/trading packages (~1 hour)
- Reduces cognitive load when reading the codebase
- Zero risk to running services

**Do next (Phase 2 documentation):**
- Document exact duplicate locations and line counts (~2 hours)
- Create shared library plans for future sprints
- Establish refactoring playbook

**Do later (Phase 3):**
- Choose consolidation strategy based on product roadmap
- Execute library extraction incrementally (Option A recommended)
- Update tests and deployment to use consolidated code

---

## Testing Strategy

After each cleanup or refactoring:

1. **Unit tests**
   ```bash
   mvn -B -f apps/order-and-sell-service/pom.xml test
   mvn -B -f apps/holdings-and-trade-service/pom.xml test
   ```

2. **Integration tests** (if they exist)
   - Run E2E tests against both services

3. **Verify no regressions**
   - Both services still handle auth registration
   - Both services still expose market data endpoints
   - Requests still route correctly through dev proxy

---

## Documentation Updates

Keep this document updated as work progresses:
- Mark completed tasks with ✅
- Record lines of code removed/refactored
- Link to PR/commits that implement each phase
- Update service READMEs as code is removed

## See Also

- [Order and Sell Service Documentation](order-and-sell-service.md)
- [Holdings and Trade Service Documentation](holdings-and-trade-service.md)
- [Architecture Reference](../architecture.md)
