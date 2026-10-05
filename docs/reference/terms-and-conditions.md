# Terms and Conditions

This document is the canonical TradingSeason terms and conditions text currently shown in the dashboard acceptance modal. It is written for the platform as implemented today: a simulated trading environment with authentication, profile registration, market replay, holdings, cash movements, and educational order workflows.

## Research basis

The current draft emphasizes plain-language disclosure, user acknowledgement, and risk visibility based on publicly available investor guidance:

- SEC Investor.gov explains that investors should understand the risks of securities trading before using a platform and that risk can include substantial losses and forced liquidations in margin contexts.
- SEC Investor.gov's Form CRS bulletin stresses concise, plain-English disclosure of services, fees, conflicts, and relationship scope.
- These sources support clear disclosure even for a simulation product: users should understand what the platform is, what it is not, and what responsibilities remain with them.

This document is product documentation, not legal advice. Final production language should still be reviewed by legal counsel before external release.

## Current platform terms

### 1. Educational simulation only

TradingSeason provides a simulated environment for learning and practicing investment decisions. It does not provide brokerage, custody, clearing, settlement, investment advisory, or execution services.

Prices, portfolio values, fills, account balances, and market events displayed in the platform are generated or replayed for simulation and training purposes only. They must not be relied on as live market data, official statements, or books and records for any real account.

### 2. No financial, legal, or tax advice

Nothing in TradingSeason constitutes financial, investment, legal, accounting, compliance, or tax advice. The platform does not recommend that a user buy, sell, hold, or avoid any security, strategy, or market sector.

You remain solely responsible for any real-world investment or financial decision you make outside this simulated environment.

### 3. Risk acknowledgement

You acknowledge that securities trading involves risk, including volatility, illiquidity, price gaps, model error, delayed data, system interruption, and the possibility of loss.

Examples involving gains, losses, margin-style scenarios, order execution, historical replay, or account growth are educational illustrations only. Simulated outcomes may differ materially from live-market behavior, actual execution quality, tax treatment, slippage, fees, or capital at risk.

### 4. User account responsibilities

You agree to provide accurate registration information, maintain the confidentiality of your credentials, and notify the platform operator promptly if you suspect unauthorized use of your account.

You are responsible for all activity performed through your authenticated session unless and until access is revoked.

### 5. Acceptable use

You may use TradingSeason only for lawful, authorized, and non-abusive purposes. You must not:

- attempt to interfere with system integrity, availability, or security;
- scrape or exfiltrate protected data;
- impersonate another user;
- reverse engineer restricted service behavior beyond what applicable law permits; or
- use the platform to rehearse fraudulent, manipulative, or abusive trading conduct.

The platform operator may suspend access, invalidate sessions, or restrict features to protect users, data integrity, or service operations.

### 6. Records and feature controls

TradingSeason records whether a signed-in user has accepted these terms and the timestamp of that acceptance. The current implementation records acceptance once per user profile and does not prompt again after acceptance has been stored successfully.

The operator may update these terms in the future. If the terms change materially, the platform should version the document and require renewed acceptance before further use.

### 7. Limitation of platform reliance

TradingSeason is provided on an educational and developmental basis. Availability, continuity, historical data completeness, and simulation accuracy are not guaranteed.

Users should independently verify any concept, calculation, or workflow before relying on it in a live investing, brokerage, treasury, or compliance setting.

## Current UX placement

The acceptance prompt appears after successful authentication and after the dashboard loads the signed-in user's profile from `GET /api/users/me`, but before the user can place orders, move cash, create accounts, rename accounts, or open settings.

That position was chosen because:

- it applies equally to returning users and newly registered users;
- it relies on the existing authenticated profile bootstrap instead of a parallel identity check; and
- it allows the backend to persist acceptance on the shared user profile once and stop prompting thereafter.