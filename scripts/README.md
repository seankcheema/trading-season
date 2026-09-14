# Scripts - Python Analytics & Backtesting

Standalone Python utilities for market analysis, trading strategy backtesting, and analytics reporting.

## 📋 Overview

**Purpose:** Tools for analyzing trading simulation results and validating strategies.

**Language:** Python 3.11+  
**Package Manager:** pip  
**Dependencies:** pandas, numpy, matplotlib, scikit-learn (future)

---

## 📁 Project Structure

```
scripts/
├── backtesting/
│   ├── runbacktest.py           ← Execute backtest
│   ├── strategies/
│   │   ├── simple_buy_hold.py
│   │   ├── momentum_strategy.py
│   │   └── mean_reversion.py
│   ├── data/
│   │   └── sample_market_data.csv
│   └── results/
│       └── backtest_results.json
├── analytics/
│   ├── reportgenerator.py       ← Generate reports
│   ├── metrics.py               ← Performance metrics
│   └── plots.py                 ← Visualizations
├── requirements.txt             ← Python dependencies
├── README.md                    ← This file
└── .agent.md                    ← AI guidance
```

---

## 🚀 Quick Start

### Installation

**Prerequisites:**
- Python 3.11+ installed
- pip package manager

```bash
cd scripts
pip install -r requirements.txt
```

### Run Backtest

```bash
python backtesting/runbacktest.py --strategy simple_buy_hold --data data/sample_market_data.csv
```

**Output:**
```
Backtest Results:
  Initial Balance: $100,000
  Final Balance: $125,430.50
  Return: 25.43%
  Max Drawdown: -12.15%
  Sharpe Ratio: 1.82
  Winning Trades: 45
  Losing Trades: 12
```

### Generate Analytics Report

```bash
python analytics/reportgenerator.py --backtest results/backtest_results.json --output report.pdf
```

---

## 📦 Dependencies

**File:** `requirements.txt`

```
pandas==2.0.3           # Data analysis
numpy==1.24.3           # Numerical computing
matplotlib==3.7.1       # Plotting
scikit-learn==1.2.2     # Machine learning (future)
pytest==7.3.1           # Testing
jupyter==1.0.0          # Notebooks (optional)
```

**Install:**
```bash
pip install -r requirements.txt
```

---

## 📊 Backtesting

### Purpose
Test trading strategies against historical market data without risking real capital.

### Typical Workflow
1. Define strategy (buy/sell logic)
2. Load historical data
3. Run backtest
4. Analyze results
5. Iterate on strategy

### Example Strategy

**File:** `backtesting/strategies/simple_buy_hold.py`

```python
class SimpleStrategyBuyHold:
    def __init__(self):
        self.name = "Simple Buy & Hold"
    
    def should_buy(self, price_data, index):
        # Buy on first day
        return index == 0
    
    def should_sell(self, price_data, index):
        # Sell on last day
        return index == len(price_data) - 1
```

**Run backtest:**
```bash
python backtesting/runbacktest.py --strategy simple_buy_hold
```

### Data Format

Market data should be CSV with columns:
```
date,open,high,low,close,volume
2024-01-01,150.50,151.20,150.00,151.00,1000000
2024-01-02,151.00,152.50,150.80,152.20,1200000
...
```

---

## 📈 Analytics & Reporting

### Metrics Calculated

| Metric | Description |
|--------|-------------|
| **Total Return** | % gain/loss from start to end |
| **Annual Return** | Annualized rate of return |
| **Max Drawdown** | Largest peak-to-trough decline |
| **Sharpe Ratio** | Risk-adjusted return (>1.0 is good) |
| **Sortino Ratio** | Return per downside risk |
| **Win Rate** | % of profitable trades |
| **Profit Factor** | Gross profit / Gross loss |

### Generate Report

```python
from analytics.reportgenerator import generate_report

results = {
    'initial_balance': 100000,
    'final_balance': 125430.50,
    'trades': [
        {'entry': 150.00, 'exit': 155.00, 'profit': 5.00},
        # ... more trades
    ]
}

generate_report(results, output_file='report.pdf')
```

---

## 🧪 Testing

### Run Tests
```bash
pytest                  # Run all tests
pytest backtesting/     # Run backtest tests
pytest analytics/       # Run analytics tests
pytest -v              # Verbose output
```

### Example Test

**File:** `backtesting/test_backtest.py`

```python
import pytest
from backtesting.runbacktest import Backtest
from backtesting.strategies.simple_buy_hold import SimpleStrategyBuyHold

def test_backtest_simple_strategy():
    data = [
        {'date': '2024-01-01', 'close': 100},
        {'date': '2024-01-02', 'close': 110},
        {'date': '2024-01-03', 'close': 105}
    ]
    
    backtest = Backtest(SimpleStrategyBuyHold(), data, initial_balance=10000)
    results = backtest.run()
    
    assert results['final_balance'] > results['initial_balance']
    assert results['return'] > 0
```

---

## 📓 Jupyter Notebooks

For interactive analysis:

```bash
jupyter notebook
```

**Create analysis notebook:**
```python
import pandas as pd
from analytics.metrics import calculate_sharpe_ratio

# Load data
data = pd.read_csv('data/sample_market_data.csv')

# Calculate metrics
sharpe = calculate_sharpe_ratio(data['returns'])
print(f"Sharpe Ratio: {sharpe}")
```

---

## 🚢 Integration with Platform

### Load Simulation Data from Backend
```python
import requests

response = requests.get('http://localhost:8080/api/simulation/data')
data = response.json()

# Run analysis
results = backtest_strategy(data)
```

### Export Results Back to Database
```python
import requests

results = {
    'strategy': 'momentum_strategy',
    'return': 25.43,
    'sharpe_ratio': 1.82,
    'max_drawdown': -12.15
}

response = requests.post('http://localhost:8080/api/analytics/results', json=results)
```

---

## 🐛 Troubleshooting

### Import Errors
```
ModuleNotFoundError: No module named 'pandas'
→ Run: pip install -r requirements.txt
```

### Data File Not Found
```
FileNotFoundError: data/sample_market_data.csv not found
→ Check file path matches exactly
→ Ensure CSV format is correct
```

### Backtest Takes Too Long
```
→ Use smaller dataset
→ Reduce number of iterations
→ Optimize strategy logic
```

---

## 📚 Documentation

For integration with main platform, see:
- [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — System design
- [docs/DEVELOPMENTWORKFLOW.md](../../docs/DEVELOPMENTWORKFLOW.md) — Development setup

---

**Last Updated:** 2026-09-09  
**Maintained By:** DuaLEAPa Analytics Team
