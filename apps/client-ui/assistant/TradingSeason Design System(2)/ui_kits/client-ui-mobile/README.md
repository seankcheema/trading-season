# Client UI — mobile web kit (proposed)

A mobile web adaptation of `ui_kits/client-ui`. The product's Angular client is desktop-first, so this layout is new. It keeps the product's tokens, components and copy unchanged.

- **Frame:** 390×844 on desktop, full-bleed `100dvh` below 500px. A sticky top bar holds the mark, the account pill, search and the avatar; a 4-tab bottom bar has Home, Assets, Activity and Account.
- **Home** (`MobileScreens.jsx`): net-worth card, portfolio chart with full-width timeframe toggle, the top 3 assets, the first 4 Watch List entries and the 4 most recent transactions. "View all" switches tabs.
- **Assets:** an Assets | Watch List switch, then invested and unrealized totals, sort chips, and holding rows with avg cost, share of portfolio and gain/loss.
- **Activity:** All / Trades / Cash chips and the full transaction list.
- **Account** (`MobileSheets.jsx`): profile, account switcher, idle-timeout setting and log out (these replace the profile dropdown and Settings dialog).
- **Sheets:** dialogs become bottom sheets (`BottomSheet` in `MobileShell.jsx`): New Order (watchlist star, chart, shared `OrderTicket`), Deposit/Withdraw, Search, Accounts.
- **Landing / Login / Register:** `MobileLanding.jsx`; the auth screens reuse `../client-ui/AuthScreens.jsx` with `mobile` (stacked lockup, no fixed positioning).

Touch targets are at least 44px, inputs use 16px text to avoid iOS zoom, and the bottom bar respects `safe-area-inset-bottom`. Route and tab persist in `localStorage['ts-mobile']`.

## Layouts
A Cards / Flat switch (top-left on desktop, or `?layout=flat`, saved in `localStorage['ts-mobile-layout']`) swaps the tab screens:
- **Cards** — the bento stack of dash cards (`MobileScreens.jsx`).
- **Flat** (`MobileFlat.jsx`) — no card containers. Full-bleed net-worth hero with the portfolio chart directly under it, inline search field, then hairline-separated Assets / Watch List / Recent Transactions sections with 18px headings. Assets and Activity use underlined text tabs; Account is a settings-style grouped list.
