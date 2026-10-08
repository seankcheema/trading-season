# TradingSeason Platform Terms and Conditions

> Draft for business-client circulation. Effective date: 8 October 2026.

> This document reflects TradingSeason as currently implemented. It is intended to support business review of the platform terms presented to authorised users in the dashboard. It is not legal advice and should be reviewed by counsel before external issue or contractual use.

## 1. Parties and acceptance

These terms govern access to and use of TradingSeason by a business client and each individual user whom that client authorises to access the platform.

By accepting these terms in the TradingSeason dashboard, the user confirms that the user is acting on the user's own behalf and, where applicable, on behalf of the user's employer or client organisation to the extent the user is authorised to do so.

## 2. Service description

TradingSeason is a browser-based simulated trading environment intended for training, product familiarisation, workflow rehearsal, and internal evaluation.

As implemented today, the platform provides authenticated user access, profile registration, dashboard views, account summaries, holdings, watchlists, cash movements, market replay, recent transaction views, and educational order-entry workflows.

## 3. Simulation-only environment

TradingSeason is not a brokerage, dealer, custodian, exchange, execution venue, clearing platform, settlement platform, portfolio management system, or investment advisory service.

Orders submitted in TradingSeason are simulated platform actions only. They do not route to a live market, do not create a real trading instruction, and do not create any live settlement, custody, or payment obligation.

Prices, account balances, portfolio values, fills, performance views, and market events displayed in the platform are generated or replayed for simulation purposes. They must not be treated as live market quotations, executable prices, official valuations, confirmations, statements, or books and records for any real account.

## 4. No financial, legal, tax, or compliance advice

Nothing in TradingSeason constitutes financial, investment, legal, tax, accounting, regulatory, or compliance advice.

TradingSeason does not recommend that any person buy, sell, hold, or avoid any security, instrument, strategy, or market exposure. Any examples of gains, losses, leverage, execution, or account performance are educational illustrations only.

The client and each user remain solely responsible for any real-world investment, treasury, legal, regulatory, or tax decision made outside the platform.

## 5. Client and user responsibilities

The client is responsible for determining which personnel are authorised to access TradingSeason and for ensuring those users use the platform only for legitimate business, training, or evaluation purposes.

Each user must provide accurate registration details, protect authentication credentials, and promptly report any suspected unauthorised access, misuse, or security incident affecting that user's account.

The client and its users are responsible for independently reviewing any concepts, calculations, workflows, or reports before applying them in any live operational, investment, brokerage, finance, or compliance setting.

## 6. Acceptable use restrictions

The client and its users must not:

- interfere with platform security, integrity, availability, or performance;
- attempt to gain unauthorised access to accounts, services, APIs, or data;
- scrape, bulk export, or exfiltrate protected information except as expressly permitted;
- impersonate another person or misrepresent authority to act for the client;
- reverse engineer restricted service behaviour except where non-excludable law permits; or
- use the platform to test, rehearse, or facilitate fraudulent, manipulative, abusive, or unlawful trading conduct.

The platform operator may suspend sessions, invalidate tokens, restrict features, or block access where reasonably necessary to protect users, data, or service operations.

## 7. Records, acknowledgements, and document control

TradingSeason records whether a signed-in user has accepted these terms and stores the corresponding acceptance timestamp against that user's profile.

The current implementation writes the acceptance timestamp once and preserves the original acceptance record on later sign-ins. The platform therefore treats acceptance as a standing acknowledgement for that user unless and until a new version of the terms is deployed with a renewed acceptance workflow.

The current implementation does not maintain a separate in-product document version history for accepted terms. If materially revised wording is introduced, the operator should release the revised document together with a renewed acceptance requirement before relying on the updated text.

## 8. Data, records, and reliance limitations

TradingSeason keeps a permanent record of every simulated order, the price it was filled at, and the resulting cash and holding changes, attributed to the user and the time they occurred. That record is the platform's authoritative record of activity within the simulation. It is not a record of any live-market transaction, and it is not the client's ledger, regulatory archive, trade blotter, tax record, or valuation source for any real account or live business process.

Although the platform stores and returns profile, account, holdings, cash, order, and simulation data through authenticated application flows, that information is provided for platform operation, training, and evaluation only.

The client must maintain its own controls, books and records, supervisory procedures, and evidentiary records for any live business process.

## 9. Availability and change control

TradingSeason is provided on an educational and development-oriented basis. Continuous availability, historical completeness, uninterrupted replay fidelity, and simulation accuracy are not guaranteed.

Features, workflows, and supporting data may change as the platform evolves. The client should not assume that a simulated workflow, timing model, or result set will match production-market behaviour or any external provider's systems.

## 10. Risk acknowledgement

The client and its users acknowledge that securities-related workflows involve risk, including volatility, illiquidity, delayed or incomplete data, model limitations, operational interruption, and user error.

Simulated outcomes may differ materially from live execution quality, slippage, fees, taxes, counterparty behaviour, exchange controls, settlement timing, or capital at risk in a real environment.

## 11. Current in-product presentation

In the current implementation, the acceptance dialog appears after successful authentication and after the dashboard has loaded the signed-in user's profile from `GET /api/users/me`, but before the user can place orders, move cash, create accounts, rename accounts, or open settings.

When the user provides a matching typed signature, the client application records acceptance through `PUT /api/users/me/terms-acceptance`. The backend stores the first successful acceptance timestamp and returns the updated profile without prompting the same user again on later sign-ins.