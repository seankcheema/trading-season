# Reporting Module

Python utilities for calculating performance metrics, risk analysis, and generating trading analytics reports.

## Overview

This module provides:
- **Performance Metrics Calculator** — Returns, Sharpe Ratio, Drawdown, Win Rate, Profit Factor
- **Risk Metrics Calculator** — VaR, CVaR, Beta, Concentration, Leverage
- **Trade Analytics** — Trade grouping, win/loss analysis, expectancy calculation
- **Reporting ETL** — Data extraction and transformation from operational DB to reporting DB
- **Scheduling Framework** — Daily, hourly, and weekly aggregation jobs

## Installation

```bash
cd scripts/reporting
pip install -r requirements.txt
```

## Usage

### 1. Performance Metrics

```python
from metrics_calculator import PerformanceCalculator
import pandas as pd

# Create calculator
pc = PerformanceCalculator()

# Calculate returns
returns = pc.calculate_returns(
    starting_balance=100000,
    ending_balance=115000,
    period_days=365
)
print(f"Total Return: {returns['total_return_percent']}%")

# Calculate Sharpe Ratio
daily_returns = pd.Series([0.001, -0.002, 0.0015, ...])
sharpe = pc.calculate_sharpe_ratio(daily_returns, risk_free_rate=0.02)
print(f"Sharpe Ratio: {sharpe}")

# Calculate Drawdown
equity_curve = pd.Series([100000, 102000, 99500, 105000, ...])
max_dd, current_dd = pc.calculate_drawdown(equity_curve)
print(f"Max Drawdown: {max_dd}%")
```

### 2. Trade Analytics

```python
from metrics_calculator import TradeAnalyticsCalculator
import pandas as pd

# Create calculator
tac = TradeAnalyticsCalculator()

# Analyze trades
trades = pd.DataFrame({
    'pnl': [100, -50, 200, -75, 150, 250],
    'instrument_id': [1, 1, 2, 2, 1, 3]
})

# Calculate metrics
win_rate = tac.calculate_win_rate(trades)
profit_factor = tac.calculate_profit_factor(trades)
expectancy = tac.calculate_expectancy(trades)

print(f"Win Rate: {win_rate}%")
print(f"Profit Factor: {profit_factor}")
print(f"Expectancy: ${expectancy}")

# Group by instrument
by_instrument = tac.group_trades_by_instrument(trades)
for instrument_id, inst_trades in by_instrument.items():
    print(f"Instrument {instrument_id}: {len(inst_trades)} trades")
```

### 3. Risk Metrics

```python
from metrics_calculator import RiskCalculator
import pandas as pd

rc = RiskCalculator()

# Calculate VaR and CVaR
daily_returns = pd.Series([0.001, -0.002, 0.0015, ...])
portfolio_value = 500000

var_95 = rc.calculate_var(daily_returns, confidence_level=0.95, portfolio_value=portfolio_value)
cvar_95 = rc.calculate_cvar(daily_returns, confidence_level=0.95, portfolio_value=portfolio_value)

print(f"VaR (95%): ${var_95}")
print(f"CVaR (95%): ${cvar_95}")

# Calculate Beta
asset_returns = pd.Series([...])
market_returns = pd.Series([...])
beta = rc.calculate_beta(asset_returns, market_returns)
print(f"Beta: {beta}")

# Calculate concentration
holdings = pd.DataFrame({
    'value': [150000, 120000, 80000, 50000, 30000]
})
concentration = rc.calculate_concentration(holdings)
print(f"Concentration: {concentration}%")
```

### 4. ETL Pipeline

```python
from etl import ReportingDatabaseConnection, ReportingETL
from datetime import datetime, timedelta

# Initialize connection
db_conn = ReportingDatabaseConnection(
    host="localhost",
    port=5432,
    database="trading_platform_reporting",
    user="postgres",
    password="your_password"
)

# Create ETL instance
etl = ReportingETL(db_conn)

# Extract trades
account_id = 1
start_date = datetime.now() - timedelta(days=30)
end_date = datetime.now()

trades = etl.extract_trades(account_id, start_date, end_date)
print(f"Extracted {len(trades)} trades")

# Extract holdings
holdings = etl.extract_holdings(account_id, datetime.now())
print(f"Extracted {len(holdings)} holdings")

# Extract cash balance
cash_balance = etl.extract_cash_balance(account_id, datetime.now())
print(f"Cash balance: ${cash_balance}")

# Transform and load metrics
metrics = etl.transform_daily_performance(
    trades=trades,
    previous_balance=100000,
    current_balance=115000,
    daily_returns=pd.Series([0.001, -0.002, ...])
)

etl.load_performance_metrics(account_id, metrics, datetime.now())
```

## Modules

### `metrics_calculator.py`

Core metrics calculation functions:
- `PerformanceCalculator` — Performance metrics (returns, Sharpe, Sortino, Calmar, drawdown)
- `TradeAnalyticsCalculator` — Trade-level analysis (win rate, profit factor, expectancy)
- `RiskCalculator` — Risk metrics (VaR, CVaR, Beta, concentration, leverage)
- `ReportingAggregator` — Aggregates metrics into complete reports

### `etl.py`

Data pipeline for reporting:
- `ReportingDatabaseConnection` — Manages DB connections
- `ReportingETL` — Extracts, transforms, loads data
- `ReportingScheduler` — Manages scheduled jobs

## Database Schema

### Performance Metrics Table
```sql
CREATE TABLE performance_metrics (
    metric_id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    date_calculated TIMESTAMP NOT NULL,
    total_return_percent NUMERIC(10, 4),
    ytd_return_percent NUMERIC(10, 4),
    sharpe_ratio NUMERIC(10, 4),
    max_drawdown_percent NUMERIC(10, 4),
    win_rate_percent NUMERIC(10, 4),
    profit_factor NUMERIC(10, 4),
    avg_trade_return NUMERIC(10, 4),
    total_trades_count INT,
    winning_trades_count INT,
    losing_trades_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, date_calculated)
);
```

### Trade Analytics Table
```sql
CREATE TABLE trade_analytics (
    analytics_id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    instrument_id INT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    total_trades_count INT,
    total_volume NUMERIC(15, 2),
    total_cost NUMERIC(15, 2),
    realized_pnl NUMERIC(15, 2),
    avg_entry_price NUMERIC(10, 4),
    avg_exit_price NUMERIC(10, 4),
    win_rate_percent NUMERIC(10, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, instrument_id, period_start)
);
```

## Scheduled Jobs

### Daily Aggregation (9 PM UTC)
Calculates daily performance metrics for all active accounts:
- Total return, Sharpe Ratio, Drawdown
- Trade count, win rate, profit factor
- Average trade return

### Hourly Refresh (Every hour)
Updates cached metrics:
- Portfolio value
- Unrealized P&L
- Active orders
- Recent fills

### Weekly Consolidation (Sunday 2 AM UTC)
Consolidates weekly metrics:
- Week-over-week comparisons
- Strategy performance
- Risk trends

## Testing

```bash
pytest tests/
pytest tests/ --cov=scripts/reporting
```

## Integration with Spring Boot Backend

### REST Endpoint for Metrics
```
GET /api/v1/reports/performance-metrics
Parameters:
  - accountId (required)
  - startDate (optional)
  - endDate (optional)
  
Response:
{
  "accountId": 1,
  "dateCalculated": "2026-09-09T21:00:00Z",
  "totalReturnPercent": 15.24,
  "sharpeRatio": 1.85,
  "maxDrawdownPercent": -8.32,
  "winRatePercent": 64.5,
  "profitFactor": 2.15,
  "avgTradeReturn": 1250.00,
  "totalTradesCount": 245,
  "winningTradesCount": 158,
  "losingTradesCount": 87
}
```

## Configuration

Create `.env` file:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_platform_reporting
DB_USER=postgres
DB_PASSWORD=your_password

RISK_FREE_RATE=0.02
VAR_CONFIDENCE_LEVEL=0.95

METRICS_CACHE_TTL=300  # 5 minutes
```

## Performance Considerations

- **Query Optimization:** Uses indexed columns for fast lookups
- **Materialized Views:** Pre-aggregated data for common reports
- **Caching:** Redis caching of frequently accessed metrics
- **Batch Processing:** Daily aggregation runs in batch mode
- **Data Partitioning:** Monthly partitions on date fields

## Future Enhancements

- [ ] Machine learning-based anomaly detection
- [ ] Advanced charting with Plotly
- [ ] Email report scheduling
- [ ] Real-time WebSocket updates
- [ ] Comparison reports vs benchmarks
- [ ] Mobile app integration

## Contributing

1. Follow PEP 8 style guide
2. Add tests for new functionality
3. Update documentation
4. Test against mock data before production

## License

Part of the DuaLEAPa Trading Platform

---

**Last Updated:** 2026-09-09  
**Version:** 0.1.0  
**Maintainer:** Data Engineering Team
