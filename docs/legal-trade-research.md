# Legal trade research (DUA-68)

Research behind the Legal Trade Regulations story: which United States rules a real trading platform would have to meet for its terms, disclosures, and trade records, and how TradingSeason compares. Written 15 October 2026.

TradingSeason is a simulation. It takes no real money, routes no orders to a market, and holds no securities, so it is not a broker-dealer or an investment adviser and none of these rules bind it. The platform follows them where doing so is practical, so that the product behaves like the regulated systems it trains people for.

This is a project research summary, not legal advice. The rule summaries are condensed; check the current text of each rule before relying on it.

## Sources reviewed

| Rule | Who it applies to | What it requires, in short |
| --- | --- | --- |
| Securities Exchange Act of 1934, section 15(a) | Anyone effecting securities transactions for others | Registration as a broker-dealer |
| SEC Rule 17a-3 (17 CFR 240.17a-3) | Broker-dealers | Records to create: blotters of every purchase and sale, ledgers of cash and securities per account, and a memorandum of each order with its terms, account, time of entry, time of execution, and price |
| SEC Rule 17a-4 (17 CFR 240.17a-4) | Broker-dealers | How long to keep those records (six years for blotters and ledgers, three years for order memoranda and most other records, the first two years easily accessible), and how electronic records must be kept: a non-rewriteable, non-erasable format, or since the 2022 amendments an audit-trail system that preserves every change, the time it was made, and who made it |
| FINRA Rule 4511 | FINRA member firms | Keep books and records as Rule 17a-4 requires; where no period is set, keep them for six years |
| FINRA Rule 2210 | FINRA member firms | Communications with the public must be fair and balanced, give a sound basis for evaluating the facts, and not be false, exaggerated, or misleading; predictions and projections of performance are generally prohibited |
| Investment Advisers Act of 1940, section 202(a)(11) | Anyone who advises others on securities for compensation | Registration as an investment adviser. Bona fide publications of general, impersonal content fall outside the definition (Lowe v. SEC, 1985) |
| Regulation Best Interest | Broker-dealers recommending securities to retail customers | Act in the customer's best interest when making a recommendation, with disclosure of material facts and conflicts |
| Electronic Signatures in Global and National Commerce Act (E-SIGN, 2000) | Electronic agreements in interstate commerce | An agreement or signature may not be denied effect only because it is electronic |
| Specht v. Netscape (2002), Meyer v. Uber (2017) | Online terms | Terms bind a user when they had reasonable notice of them and clearly manifested assent; terms shown only by a link the user need not open (browsewrap) often do not |

## What TradingSeason does about each

### Terms and assent

The terms are a clickwrap agreement: a dialog that cannot be dismissed shows them in full before the dashboard or the market page can be used, and the user types their name and presses accept. The version accepted and the time are stored per user in `terms_acceptances`, and Order and Sell refuses orders until the terms in force are accepted. A changed version asks every user again. This meets the notice-and-assent standard in Specht and Meyer, and E-SIGN makes the electronic acceptance effective. See [Client UI](../apps/client-ui/README.md) and [Holdings and Trade](../apps/holdings-and-trade-service/README.md).

The terms state that the platform is a simulation, not a brokerage or advisory service, that nothing in it is advice, and that confirmed orders are permanently recorded. A [PDF](terms-and-conditions.pdf) is generated from the same wording the dialog shows.

### Disclosures before an order

FINRA Rule 2210 and Regulation Best Interest both turn on the customer understanding what they are being shown. Every order passes through a review popup that restates it, says the prices and fills are simulated and not advice, and says the order will be permanently recorded and cannot be edited or deleted. A short line under every submit button says the same. The wording is defined once, in [order-disclaimer.ts](../apps/client-ui/src/app/dashboard/orders/order-disclaimer.ts).

The platform makes no recommendations and shows no performance projections, so Regulation Best Interest and the projection limits in Rule 2210 have nothing to apply to. The market page's metrics, headlines, and commentary are demo data, and only partly say so; see [Gaps](#gaps).

### Trade records

Rules 17a-3, 17a-4 and FINRA 4511 shaped the trade record (BR-14), described in [Database: trade record](../db/README.md#trade-record).

| Rule 17a-3 and 17a-4 expectation | TradingSeason |
| --- | --- |
| A record of every order with its terms, account, entry time, and execution time and price | `orders` keeps the submitted terms, account, submission, acceptance and resolution times; `fills` keeps the price and time; the `PENDING`, `ACCEPTED` and `FILLED` audit entries restate them in full |
| Cash and securities ledgers per account | `cash_transactions` and `holding_movements`, written in the same transaction as the fill |
| Records attributable to a customer | Every row resolves to an account, every account to one user; the user's name, date of birth and sign-in email cannot be changed |
| Retention for at least six years | No retention period: nothing is ever purged |
| Non-rewriteable, non-erasable storage, or an audit trail of every change | Database triggers reject every update, delete, and truncate of the record for all roles, including the table owner |
| A copy that survives the loss of the primary | Manual backup and restore scripts; see [Database backup and restore](../infrastructure/README.md#database-backup-and-restore) |

## Gaps

These would have to be closed before the same design could serve a regulated firm. None is required of a simulation.

- **Write protection is not tamper-proof.** The table owner can drop or disable the triggers, and the services connect as that owner. Rule 17a-4's non-rewriteable option expects storage that cannot be altered at all, and its audit-trail option expects every change to be preserved. Separating the owner role from the application role, or writing the record to dedicated write-once storage, would close this.
- **Backups are manual.** Nothing schedules them, rotates them, or keeps a copy away from the database host.
- **No regulator access process.** There is no export of the record in a form a regulator could be given on request.
- **Demo content is only partly labelled.** The market page's session brief says its signal scores are illustrative, but its headlines are marked as simulated only for screen readers, and its metrics and AI commentary carry no label. Under Rule 2210 each should say it is generated where it appears.
- **Sensitive data in the record.** The `users` table holds SSNs and dates of birth, which backups copy. A regulated firm would also fall under Regulation S-P for protecting that data.
