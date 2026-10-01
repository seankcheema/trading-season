# TradingSeason Design System

TradingSeason (also written "Trading Season") is a trading-simulation platform: users register with a starting cash balance, open one or more accounts, and buy/sell stocks against a simulated market whose prices replay from a seeded simulation session. The monorepo contains an Angular client UI, a NestJS auth service, two Spring Boot services (holdings & trade, order & sell), a PostgreSQL market-data store and placeholder reporting services.

**Source:** https://github.com/seankcheema/trading-season (branch `main`). Explore it further — especially `apps/client-ui/src/app/**` and `packages/shared-ui-components/src/lib/**` — to build designs that match the product more closely. Key files: `apps/client-ui/src/styles.css` (tokens), `dashboard/dashboard.component.*`, `landing/`, `login/`, `register/`, `dashboard/order-submission/`, `dashboard/shared/*` (chart, sparkline, search, toggles, dialog, dropdown).

## Products / surfaces
- **Client UI** (`apps/client-ui`, port 4200) — landing, login, register, dashboard, order / cash / settings dialogs. Recreated in `ui_kits/client-ui`.
- **Instrument view** — *proposed, not in product*. Advanced-trader deep dive. `ui_kits/instrument-view`.
- **Reporting UI** (`apps/reporting-ui`, port 4300) — placeholder only in the repo. *Proposed* analyst/support console in `ui_kits/reporting-ui`.

Tech: Angular 21, SpartanNG "helm" components (shadcn-style, `nova` style), Tailwind v4, `@ng-icons/lucide`. The app is **dark-only** (`<html class="dark">`).

## Index
- `styles.css` — entry; imports `tokens/fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `base.css`
- `guidelines/` — 16 foundation specimen cards (Colors, Type, Spacing, Brand)
- `components/` — React ports (namespace `window.TradingSeasonDesignSystem_86c3eb`)
  - `core/` — **Button**, **Card** (+CardHeader, CardTitle, CardDescription, CardContent, CardFooter), **DashCard** (+DashLabel, DashLink), **Separator** (+Label), **Icon**
  - `forms/` — **Field** (+FieldLabel, FieldDescription, FieldError, FieldChecklist), **Input**, **NativeSelect**, **Select**
  - `market/` — **PriceChart**, **Sparkline**, **TimeframeToggle** (+SideToggle), **ChangePill**, **InstrumentSearch**, **ShareSlider**
  - `overlays/` — **Dialog** (+CloseButton), **HeaderDropdown** (+MenuItem)
- `ui_kits/client-ui/` — recreation; `ui_kits/instrument-view/`, `ui_kits/reporting-ui/` — proposals; `ui_kits/_shared/` — AppHeader, OrderTicket, mock data
- `assets/` — `2b-waves.svg` (mark/favicon), `2b-waves-lockup-reversed.svg` (480×140 lockup for dark bg), `favicon.ico`
- `SKILL.md`, `github.md`

Component source map: Button ← `hlm-button.ts`; Card ← `hlm-card*.ts`; Field/Label ← `hlm-field*.ts`, `hlm-label.ts`; Input ← `hlm-input.ts`; NativeSelect ← `hlm-native-select.ts`; Select ← `hlm-select-*.ts`; Separator ← `hlm-separator.ts`; DashCard ← `.dash-card/.net-worth-card`; PriceChart ← `price-chart.component.ts`; Sparkline ← `daily-sparkline.component.ts`; TimeframeToggle ← `timeframe-toggle.component.ts`; SideToggle/ShareSlider ← `order-submission.component.*`; InstrumentSearch ← `instrument-search.component.ts`; Dialog ← `dashboard-dialog.component.ts`; HeaderDropdown ← `dashboard-header-dropdown.component.ts`.

**Intentional additions:** `Icon` (wrapper for Lucide glyphs, replaces ng-icon), `ChangePill` (the repeated inline rounded-full change/side badge), `DashLabel`/`DashLink` (the `.dash-label`/`.dash-link` classes), `FieldChecklist` (register password rules), `CandleChart` (kit-local, instrument view only).

## Content fundamentals
- **Voice:** short, plain, confident. Second person ("your account", "You were signed out…"); the product never says "I" or "we" except in errors ("We couldn't load your accounts.").
- **Casing:** Title Case for panel titles and dialog names ("Net Worth", "Recent Transactions", "Portfolio Value", "New Order"); sentence case for buttons, labels and form copy ("Get started", "Create an account", "Apply time", "Deposit funds", "First name").
- **Tagline:** "Ride the market." — period included. Sub: "Live prices, instant trades, smarter portfolios. Stay ahead of the market."
- **Buttons:** verb-first, 1–3 words; dynamic when useful ("Buy 5 AAPL", "Sell 2 META"). In-progress labels end in an ellipsis: "Signing in...", "Updating…", "Processing…".
- **Validation:** full sentences that say what to do: "Enter a valid email address.", "Enter at least $5,000.", "That's more than your available cash."
- **Helper copy** is reassuring and concrete: "This is just a starting point, not a commitment — you can deposit or withdraw later."
- **Empty states:** one line, what to do next: "This account has no holdings yet.", "Create an account to start building a portfolio."
- **Numbers:** USD with cents (`$316.59`), headline totals rounded to whole dollars (`$128,406`), signed percents with two decimals (`+5.20%`), tabular numerals everywhere. Tags lowercase text rendered uppercase (buy, sell, deposit, withdrawal).
- **No emoji.** No exclamation marks. Unicode "·" separates metadata ("Portfolio Value · Growth"), "@" in "4 @ $280.10".

## Visual foundations
- **Mood:** dark, calm terminal. Near-black ink (`#0e0e0e` page, `#141414` cards, `#1a1a1a` muted), frost-white text (`#eefaff`), one electric cyan accent (`#00bbff`), and neon market colors — gain `#33ff00`, loss `#ff0037`. Muted text is foreground at 50% alpha; borders are foreground at 15%.
- **Color use:** cyan = primary action, focus ring, links, buy side, active toggles, chart branding. Green only for gains/deposits/met rules; red for losses, sell, errors, log out. Tints via alpha (10% for change pills, 15% for tags/avatars).
- **Type:** Archivo (300–700) for everything; semibold 600 with −0.025em tracking for display and figures (hero 96px, net worth 36px, prices 30px); UI at 14px; quiet labels 12px/11px uppercase +0.04em, weight 500, muted. `tabular-nums` on every number.
- **Spacing:** Tailwind 4px unit. Cards pad 20px; dashboard grid gap 12px; dialog header 12×20; form stacks gap 20px; fields gap 8px.
- **Radii:** 5px on auth inputs/buttons (hand-set in the code), 6px segments, 8px controls/menu items, 10px auth card, 12px hlm card / search / order-side group, 14px dashboard cards, 16px dialogs, full for pills/avatars/meters.
- **Cards:** flat `#141414`, 1px 15% frost border, no shadow. The hlm Card uses a 1px 10% ring instead of a border. One hero card per screen gets the **net-worth gradient** (cyan radial glow bottom-right over `#10161a → #0b2f3e`) with a 20% cyan border.
- **Shadows:** only on floating layers — dropdown `shadow-xl`, search results `shadow-lg`, dialogs `shadow-2xl` at black/50.
- **Backgrounds:** solid ink. Landing only: a 10px hairline vertical-rule texture (3.5% frost) radially masked, plus a glowing cyan stock line (pale→mid→cyan gradient stroke, 6px blurred glow underlay, 28%→0 cyan area fill, dashed 6% gridlines) that fades in from the left and pulses a live dot. No photography, no illustrations.
- **Transparency & blur:** modal scrim black/60 with `backdrop-blur-sm` (4px). Glass buttons on the net-worth card use 6% frost with 12% border.
- **Animation:** restrained. Colors transition in 150ms. Dialogs fade scrim 150ms ease-out and pop the card from `translateY(8px) scale(.98)` over 200ms `cubic-bezier(.16,1,.3,1)`. Landing graph draws in via clip-path over 1.6s `cubic-bezier(.65,0,.35,1)`; live dot pulses (scale 1→3.5, 2.4s). Respect reduced motion.
- **Hover:** surfaces go to `--muted` (#1a1a1a); primary buttons drop to 80% (or mix 15% white on net-worth deposit); muted text/icons brighten to foreground; `.dash-link` turns cyan; danger menu items get a 10% red wash.
- **Press:** buttons nudge down 1px (`active:translate-y-px`). **Focus:** cyan border + 3px ring at 50%.
- **Disabled:** 50% opacity (70% on auth submit while loading), `not-allowed` cursor.
- **Charts:** line color follows period direction (green/red), 2px stroke, right-hand y-axis in whole dollars 11px, hairline 9% grid, current-point dot ringed with card color, hover crosshair at 40% frost and a label row "price · change · time".
- **Layout:** dashboard fills the viewport (`h-dvh`, max 1600px) with a 64px header and a 1 : 2.25 two-column grid; lists clip inside cards with a bottom fade mask and hidden scrollbars. Auth screens center a single card with the lockup fixed top-left.

## Iconography
- **Lucide** everywhere, via `@ng-icons/lucide` in the product (2px stroke, rounded, 16px default; 12/14/18/24 as needed). Here the `Icon` component renders Lucide glyphs from the `lucide-static@0.469.0` CDN as a `currentColor` mask. Names used in product: mail, lock, eye, eye-off, log-in, user-plus, map-pin, dollar-sign, search, x, check, chevron-down, calendar-clock, briefcase-business, pencil, plus, settings, log-out. Kits also use arrow-left, maximize-2, download, activity, users, list-ordered, arrow-right-left, circle-x, wallet, lock-open.
- Icons are muted by default, sit left of text in inputs (10px inset) and menus; no icon-only buttons without `aria-label`.
- No emoji, no custom icon font, no PNG icons. The only brand graphic is the **2b-waves** mark (`assets/2b-waves.svg`) and its reversed lockup.

## Fonts
Archivo is loaded from Google Fonts exactly as the product does (`tokens/fonts.css`). No local font binaries exist in the repo, so none are bundled.
