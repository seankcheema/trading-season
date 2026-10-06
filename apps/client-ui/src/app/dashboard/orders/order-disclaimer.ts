// Disclaimer wording shown wherever an order can be placed. Kept in one place so the ticket
// subtext and the review popup cannot drift apart. See docs/reference/trade-record.md.

/** Short subtext shown under every order ticket's submit button. */
export const ORDER_DISCLAIMER_SUBTEXT =
  'Simulated trading for education only. Not investment advice. Confirmed orders are permanently recorded.';

/** What the client is told before confirming an order, one paragraph per entry. */
export const ORDER_REVIEW_DISCLAIMER: readonly string[] = [
  'TradingSeason is a simulation. Prices and fills are not live market data, and nothing here is investment, legal, or tax advice.',
  'Once you confirm, this order, the price it is filled at, and the resulting changes to your cash and holdings are permanently recorded against your account with the time they occurred. A recorded order cannot be edited or deleted.',
];
