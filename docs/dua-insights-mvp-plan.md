# Dua: choice-based stock insights

Status: Implemented in the Client UI. See verification below for validation limits.

## Experience and capabilities

Dua opens from a fixed bottom-right shark launcher on the dashboard and advanced stock screen. It starts closed and offers predefined choices, with no text input, model, backend changes or additional polling.

| Choice | Card | Purpose |
| --- | --- | --- |
| Daily review | Market overview | Placeholder S&P 500 daily gain of +1.8%, Today. |
| Daily review | Portfolio impact | Placeholder +$385 daily gain, including $210 from NVIDIA, Today. |
| Daily review | Tomorrow's outlook | Placeholder two earnings reports and an inflation release, Up Next. |
| My holdings | Portfolio growth | Placeholder monthly growth of +12.4% and $2,450. |
| My holdings | Sector concentration | Placeholder 68% technology allocation. |
| My holdings | Top performer | Placeholder NVIDIA monthly return of +32.8% and $1,280 contribution. |
| This stock | Growth insight, Valuation insight, Risk insight | Explicitly illustrative previews: +24.8% revenue growth, -18% P/E versus industry and 65% revenue from one geographic market; not figures for the selected stock. |

Daily review uses three static illustrative examples, available independently of account positions or live quotes. My holdings shows three static placeholder cards, independently of account positions. There is no Your Holdings Today card. The displayed narratives and upcoming events are illustrative only. No actual forecasts, trade recommendations, reports or order actions are included.

## Calculation rules and retained analytics

- Daily change divides current price minus session opening price by session opening price. Describe the tracked stocks, not an index or the entire market. Market pulse mentions unchanged stocks only when explaining a flat market.
- Rank gainers by unrounded percentage change descending and losers ascending. Break ties alphabetically by ticker. Standout movers lists at most two of each; omit nonexistent categories.
- Retained calculation helpers (not the current My holdings placeholder cards): holdings value sums current price times quantity. Unrealized gain/loss subtracts purchase cost for remaining shares; weighted return divides that gain/loss by total purchase cost. Exclude shared cash and realized results.
- The retained performance driver helper selects only the largest positive dollar gain and largest negative dollar loss, with alphabetical ticker tie-breaking. A single holding appears once. All-flat holdings have an explicit no-gain/loss state.
- The retained exposure helper divides the largest position's value by total holdings value. Its dollar value is shown too. Holdings value and exposure do not require valid purchase costs.
- Missing prices or quantities suppress complete totals and exposure rather than presenting partial values as the entire account. Missing purchase costs suppress unrealized performance. Comparisons with incomplete coverage carry a note.
- Respect account and simulation cursor. Never substitute average cost for a missing market price or use demo commentary as an analytical source.
- The former price/direction/position cards are replaced in This stock by static illustrative previews. No real company fundamentals are available. Do not adapt example figures to the selected ticker or imply actual company performance.
- Explanations cover illustrative-data limitations and the market/portfolio/event examples for Daily review, placeholder-data limitations and monthly growth/sector/performance definitions for My holdings, and illustrative-data limitations and signal definitions for This stock. Returning from explanations preserves the snapshot.

## Appearance and navigation

- Panel width is 360px, constrained to the viewport minus 32px; maximum height is 560px, constrained to available viewport height.
- Show one card at a time with previous/next controls and selectable navigation bars. Every choice has three bars. Selecting or refreshing a choice returns to its first card.
- Cards share a content-driven grid row sized to the tallest card in the selected section, capped to the viewport. Use compact internally scrolling lists after 96px; preserve access to overflow with enlarged text.
- Extend the teal/purple gradient across the full result body without a black outer gutter or nested card border. Keep the header black. Retain the dark fade at the bottom and content padding for readability.
- Use large white headline numbers and light-green up/light-red down arrows. Stock-list percentage changes use green/red and explicit signs. Daily ticker links have no external-link icons; other relevant ticker links retain them.
- Keep result messages short and understandable, emphasizing significant numbers and outcomes in bold through safe interpolation. Keep the accessible circled question-mark explanation button at the top right beside the card title, outside scrolling content.
- Show only snapshot time beside the header. Refresh/retry is an accessible icon beside the close control. Account names and demo labels are omitted.

## Frontend implementation

- Add app-local Dua launcher, panel, context adapter, and a pure insight-calculation module using the existing [Angular patterns](../apps/client-ui/AGENTS.md).
- Use the exact supplied [shark-launcher-light-512.png](../apps/client-ui/public/assets/assistant/shark-launcher-light-512.png), copied unchanged into the Client UI public assets and served at `/assets/assistant/shark-launcher-light-512.png`. The supplied AssistantLauncher design is a visual reference only; retain the existing Angular implementation and real analytics.
- Keep the launcher 52px square with circular clipping and 16px safe-area spacing. Use a 50% horizontal, 44% vertical transform origin. At rest, scale the image to 2.2x and translate it 4px down to center the fin in the circular clip while keeping the face below the visible area.
- Fix the component host itself to the viewport at bottom-right, sized only to the shark, so scrolling the dashboard or advanced stock screen never moves it. Do not add a wrapper div, viewport-sized container, spacer, or reserved page area. The chat bubble is absolutely anchored above the shark.
- On hover, keyboard focus, while a notification is pending, or while chat is open, slide the image to translateY(-10px) and scale 1.35 over 450ms with symmetric ease-in-out, restoring the less magnified face view. Move only the image; keep the launcher size and position unchanged. Smoothly slide back to the centered idle fin crop over 450ms with symmetric ease-in-out when closed with no pending notification and no longer hovered or focused. No wiggle, image swapping, timed introduction, or automatic opening.
- Initial account/stock data establishes a baseline. Changes to the rounded insight cards or market trading date produce one consolidated pending update for that account, session and stock context, using existing UI data with no extra requests. Show a small red **1** badge on the notification shark; it represents the pending snapshot rather than a count of stocks or ticks.
- Clicking the notified shark opens the chat, acknowledges the update, removes the badge, and reveals the full face in one click. Position the red badge 6px below the top of the launcher, outside the circular image clipping area. A pending notification keeps the slightly zoomed face visible, even without hover. Hovering or focusing also reveals the face without changing the notification state. Close chat on every page navigation, preserving insight baselines and notification acknowledgement. Reset user-specific insight baselines on logout. With reduced motion, switch image transforms immediately, and keep Dua hidden while terms block the page.
- MVP notification limit: once the user clicks a notified shark, suppress further notifications for the remainder of that page load, across account changes and navigation. Keep this acknowledgement in memory only; a full browser refresh permits a new notification. This does not prevent opening the chat or refreshing its insights.
- Feed Dua the current account, holdings, stock, market session, cursor, quotes, and connection status through a shared typed context. Reuse existing [market-service](../apps/client-ui/src/app/dashboard/market-data.service.ts) requests and caches; introduce no separate polling loop.
- Calculate a snapshot when a choice is selected or Refresh is pressed. Display snapshot time only beside the header, without account names, date or timezone. Reset results and explanations when account, stock, or simulation context changes. Preserve the snapshot when returning from explanations.
- Show skeletons while fetching data, specific unavailable states for missing prices/history, and a retry action on failure. Never substitute average cost for a missing market price.
- Clear state on logout. Preserve keyboard access, focus restoration, Escape-to-close, and mandatory terms-dialog behavior.

## Verification

Check market ties, flat/all-up/all-down markets, invalid baselines, missing data and empty accounts. Verify unrounded mover ranking, at most four movers, weighted returns, dollar-based drivers, absent categories, single holdings and exposure independent of purchase costs.

Check card counts, reset on refresh, stable heights, snapshot preservation, list overflow, ticker navigation, notification acknowledgement/suppression, keyboard access, reduced motion and viewport bounds. Run the Client UI build, relevant Angular and pure calculation tests, targeted browser checks, documentation link/encoding checks and git diff --check. Report unavailable prerequisites; compilation alone does not confirm browser behavior.



This stock previews use a large percentage, a larger white result headline with emphasized words, with supporting descriptions available from the question-mark icon. Each card shows its position (01 / 03 through 03 / 03) and the captured market date. Direction arrows are large and light green/red; Daily review and My holdings also use illustrative cards, with existing navigation and notification behavior. Revenue, valuation and geographic figures remain illustrative until a real fundamentals source is implemented.

Stock preview metric titles sit above the number in larger white text. The small metadata row shows the captured market date (MM/DD/YYYY) and card count, not a financial reporting date. The header reads Stock Insights; explanations state that figures are illustrative. Reduced card height and bottom padding keep navigation close to the description.

All Daily review, My holdings and stock preview cards share the same label-above-number layout, larger white metric labels, consistent top spacing, and a period-or-date/card-count row. The date is the viewed market context, not a financial reporting date. Card heading and metadata spacing is compact; signed values, directional colors, consistent section heights and internal scrolling are preserved.

The stock section header reads Stock Insights. Stock metric titles have 14px of spacing above them after the date/card-count row. These stock figures remain illustrative, as described in the explanation panel.

My holdings uses the same gradient, metric-first typography, circled explanation action and three-card navigation as Stock Insights. Its metadata row displays This Month or Current rather than a date. Refresh returns to Portfolio Growth. These examples do not derive from selected-account holdings, sector classification or monthly return history; Daily review also uses illustrative placeholders and existing notification behavior is preserved.

Daily review uses the shared three-card illustrative layout with Today/Up Next labels, large metrics, short result headlines with descriptions behind the question-mark icon. The explanation icon states that all figures and events are examples, not actual market data or the selected account's results. No event-calendar or market-news requests are made. Existing pure market/holdings calculations remain available for tests and notification baselines; they do not supply the displayed placeholder cards.

All three insight choices keep supporting gray descriptions off the main cards. The circled question mark opens a card-specific explanation with the same gradient and black header: a short result summary, Why it matters reasoning from the placeholder example, and a compact illustrative-data clarification. Returning restores the same card and snapshot without requests or recalculation.

Insight sections size naturally to their tallest card instead of reserving a fixed 320px. All slides share one grid cell so navigation stays in place as cards change and text wraps responsively. Inactive slides remain invisible, inert and hidden from assistive technology; overflowing content retains scrolling on short viewports or with enlarged text. Compact bottom padding keeps the headline close to navigation.

Question-mark explanation views also use content-driven height, matching insight-card padding and the same viewport height cap. Short explanations have no reserved blank space below their text; long explanations scroll internally when required by viewport size or enlarged text.

Card changes use a 180ms fade/short slide, and content-view changes ease the measured panel height over 240ms while remaining anchored above the launcher. Rapid changes continue from the current animated height; reduced-motion preferences disable both effects. The final size remains content-driven and viewport-constrained, with 12px card bottom padding and 12px navigation margins.

Information views use 24px bottom padding so their last paragraph has the same breathing room as the insight content above navigation. Their height remains content-driven and uses the shared resize transition.
