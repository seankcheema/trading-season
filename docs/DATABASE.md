# Database Design

## Overview

The Trading Season Application database is built on PostgreSQL 16 and organized into 6 logical domains representing different business functions. The design emphasizes data integrity, audit trails, and query performance.

**Connection Details:**
- Host: localhost:5432
- Database: paysprint
- User: paysprint
- Password: changeme (dev only - use environment variables in production)

## Database Domains

### 1. Identity & Access Management
Tables for user authentication and session management.

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    address VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);
```
- Stores user account information
- Supports authentication via username or email
- Password stored as bcrypt hash (never plaintext)
- Active flag allows soft-deletes

#### Sessions Table
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_valid BOOLEAN DEFAULT true,
    user_agent VARCHAR(500),
    ip_address INET
);
```
- Tracks active sessions and JWT tokens
- Enables multi-device login tracking
- Token hash prevents exposure of full tokens
- IP and user-agent for security analysis

### 2. Simulation Setup
Configuration and parameters for trading simulations.

#### Trading Seasons Table
```sql
CREATE TABLE trading_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, ACTIVE, COMPLETED, CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT date_range CHECK (start_date < end_date),
    CONSTRAINT positive_capital CHECK (initial_capital > 0)
);
```
- Represents a trading simulation period
- User can have multiple active seasons
- Tracks simulation lifecycle

#### Strategy Parameters Table
```sql
CREATE TABLE strategy_parameters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES trading_seasons(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255) NOT NULL,
    parameter_value VARCHAR(500) NOT NULL,
    parameter_type VARCHAR(50), -- STRING, NUMBER, BOOLEAN
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
- Stores configurable strategy parameters
- Allows different strategies per season

### 3. Market Behavior
Historical and real-time market data.

#### Market Data Table
```sql
CREATE TABLE market_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES trading_seasons(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open_price DECIMAL(12, 2),
    high_price DECIMAL(12, 2),
    low_price DECIMAL(12, 2),
    close_price DECIMAL(12, 2),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, symbol, date),
    INDEX market_data_season_idx (season_id),
    INDEX market_data_symbol_idx (symbol)
);
```
- OHLCV (Open, High, Low, Close, Volume) data
- Per-symbol, per-season organization
- Indexed for query performance

### 4. Generated Data
Simulated and calculated data points.

#### Simulation Results Table
```sql
CREATE TABLE simulation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES trading_seasons(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    portfolio_value DECIMAL(15, 2),
    cash_available DECIMAL(15, 2),
    total_trades INT,
    winning_trades INT,
    losing_trades INT,
    max_drawdown DECIMAL(6, 2), -- Percentage
    win_rate DECIMAL(5, 2), -- Percentage
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(season_id, date)
);
```
- Stores daily simulation performance metrics
- Calculated from orders and market data

#### Position Tracking Table
```sql
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES trading_seasons(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    quantity INT NOT NULL,
    average_cost DECIMAL(12, 2),
    current_market_price DECIMAL(12, 2),
    status VARCHAR(50), -- OPEN, CLOSED, PARTIAL
    opened_at TIMESTAMP,
    closed_at TIMESTAMP,
    CONSTRAINT positive_quantity CHECK (quantity > 0)
);
```
- Tracks open and closed positions
- Supports position averaging

### 5. Orders & Execution
Order records and execution history.

#### Orders Table
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES trading_seasons(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    order_type VARCHAR(50) NOT NULL, -- BUY, SELL
    order_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, FILLED, CANCELLED, REJECTED
    quantity INT NOT NULL,
    price DECIMAL(12, 2),
    total_amount DECIMAL(15, 2),
    commission DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP,
    CONSTRAINT positive_quantity CHECK (quantity > 0),
    CONSTRAINT positive_price CHECK (price > 0),
    INDEX orders_season_idx (season_id),
    INDEX orders_user_idx (user_id),
    INDEX orders_status_idx (order_status)
);
```
- Core order records
- Tracks full order lifecycle
- Supports querying by user, season, status

#### Execution History Table
```sql
CREATE TABLE order_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    executed_quantity INT NOT NULL,
    executed_price DECIMAL(12, 2) NOT NULL,
    execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    broker_reference VARCHAR(255),
    CONSTRAINT positive_executed_qty CHECK (executed_quantity > 0)
);
```
- Partial fill support
- Execution-level details for compliance

### 6. Audit & Compliance
Comprehensive audit trail for all changes.

#### Audit Log Table
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL, -- TABLE NAME
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    INDEX audit_user_idx (user_id),
    INDEX audit_entity_idx (entity_type, entity_id),
    INDEX audit_time_idx (changed_at)
);
```
- Complete change history
- JSONB for flexible value tracking
- Enables compliance reporting and rollback

#### System Events Table
```sql
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20), -- INFO, WARNING, ERROR, CRITICAL
    message TEXT,
    details JSONB,
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    INDEX events_type_idx (event_type),
    INDEX events_severity_idx (severity),
    INDEX events_time_idx (occurred_at)
);
```
- Operational event tracking
- Supports monitoring and alerting

## Entity Relationships

### User-Centric Relationships
```
users
├── has many user_sessions
├── has many trading_seasons
├── has many orders
└── has many audit_log entries
```

### Trading Season Hierarchy
```
trading_seasons
├── has many strategy_parameters
├── has many market_data records
├── has many simulation_results
├── has many positions
└── has many orders (via orders table)
```

### Order Processing Flow
```
orders
├── has one or many order_executions
├── references positions
└── logged in audit_log
```

## Indexes

### Performance-Critical Indexes
```sql
-- Auth queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);

-- Season queries
CREATE INDEX idx_seasons_user ON trading_seasons(user_id);
CREATE INDEX idx_seasons_status ON trading_seasons(status);

-- Order queries
CREATE INDEX idx_orders_season ON orders(season_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_created ON orders(created_at);

-- Market data queries
CREATE INDEX idx_market_season_date ON market_data(season_id, date);
CREATE INDEX idx_market_symbol ON market_data(symbol);

-- Position queries
CREATE INDEX idx_positions_season ON positions(season_id);
CREATE INDEX idx_positions_symbol ON positions(symbol);

-- Audit queries
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_changed ON audit_log(changed_at);
```

## Flyway Migrations

Migrations are version-controlled in `apps/business-backend/db/migrations/`

### Migration Naming Convention
```
V001__Initial_schema.sql
V002__Add_user_sessions_table.sql
V003__Add_audit_log_table.sql
...
V00N__Description_of_changes.sql
```

### Version Tracking
Flyway automatically creates and maintains `flyway_schema_history` table:
```sql
CREATE TABLE flyway_schema_history (
    installed_rank INT PRIMARY KEY,
    version VARCHAR(50) UNIQUE,
    description VARCHAR(255),
    type VARCHAR(20),
    script VARCHAR(1000),
    checksum INT,
    installed_by VARCHAR(100),
    installed_on TIMESTAMP,
    execution_time INT,
    success BOOLEAN
);
```

## Backup & Recovery

### Backup Strategy
```bash
# Full backup
pg_dump -h localhost -U paysprint paysprint > backup.sql

# Compressed backup
pg_dump -h localhost -U paysprint paysprint | gzip > backup.sql.gz

# Restore from backup
psql -h localhost -U paysprint paysprint < backup.sql
```

### Point-in-Time Recovery
Enable WAL archiving for PITR capability:
```sql
ALTER SYSTEM SET wal_level = replica;
ALTER SYSTEM SET archive_mode = on;
ALTER SYSTEM SET archive_command = 'cp %p /path/to/archive/%f';
```

## Query Performance Tips

### Common Query Patterns

**Find user's recent orders:**
```sql
SELECT * FROM orders
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 50;
```
Uses index on (user_id, created_at)

**Get season performance:**
```sql
SELECT * FROM simulation_results
WHERE season_id = $1
ORDER BY date DESC
LIMIT 1;
```
Uses unique constraint (season_id, date)

**Audit trail for entity:**
```sql
SELECT * FROM audit_log
WHERE entity_type = $1 AND entity_id = $2
ORDER BY changed_at DESC;
```
Uses index on (entity_type, entity_id)

## Monitoring

### Critical Metrics
- Connection pool usage
- Query execution time (slow query log)
- Replication lag (if read replicas exist)
- Table/index bloat
- Transaction abort rate

### Health Checks
```sql
-- Database availability
SELECT 1;

-- Transaction status
SELECT state FROM pg_stat_activity;

-- Replication status (if applicable)
SELECT * FROM pg_stat_replication;
```

## Security Considerations

1. **Encryption at Rest** - Use PostgreSQL encryption extensions
2. **Encryption in Transit** - SSL/TLS for all connections
3. **Row-Level Security** - Implement RLS policies per tenant (future)
4. **Column Encryption** - For sensitive fields like passwords
5. **Audit Logging** - All changes logged via audit_log table
6. **Access Control** - Database roles with minimal permissions

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and components
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Database setup and operations
- [DEVELOPMENTWORKFLOW.md](./DEVELOPMENTWORKFLOW.md) - Local development
