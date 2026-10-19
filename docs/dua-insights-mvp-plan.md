# Dua MVP: a shark buddy for stock insights

Status: Proposed. This document describes planned work, not implemented behavior.

## Summary

Add Dua as a clickable shark in the bottom-right corner of the dashboard and advanced stock screen in the [Client UI](../apps/client-ui/README.md).

Clicking Dua opens a compact conversation panel with predefined choices. All insights use existing market and holdings data, calculated in the browser. No text input, NLP, AI model, or backend changes are included.

## Experience

Dua opens with: "What would you like to review?"

| Choice | Available on | Result |
| --- | --- | --- |
| Daily review | Both screens | Selected account's held stocks with the largest rise and fall since session open. |
| My holdings | Both screens | Position gains and losses compared with average purchase cost. |
| This stock | Advanced stock screen | Selected stock's movement since open and recent price direction. |

Each response contains at most three short insight cards, followed by **Back to choices** and **Refresh**. Relevant stock cards include **View stock**, opening the existing advanced screen.

Example wording:

- "AAPL is up 10.0% since today's session opened."
- "Your TSLA position is 12.4% below your average purchase price."
- "AAPL rose across the last 5 completed candles, gaining 1.8% over that interval."

Insights appear only after selection. No automatic popups, order actions, reports, downloads, recommendations, or persistent chat history are included in this MVP.

## Insight rules

- **Daily movement:** `(current price - session opening price) / session opening price * 100`. Use the market session's trading date and timezone.
- **Position performance:** `(current price - average cost) / average cost * 100`. Show unrealized monetary gain/loss alongside it. Label this separately from today's price movement.
- **Daily review:** show the strongest positive and strongest negative move among current holdings; omit a category when none qualifies.
- **My holdings:** show the three positions with the lowest percentage return versus cost. Describe negative values factually; highlight losses of 10% or more as "Down over 10% versus average cost."
- **Recent direction:** use the last five completed candles from the existing 1D series, independently of the chart's selected range. Classify as rising only when each successive close increases, falling when each decreases, and mixed otherwise. Display the actual interval and percentage change from the first close to the last.
- Avoid "trending" claims about popularity or predictions. Describe only observed price direction.
- Respect the selected account and simulation cursor. Exclude candles after that cursor, including the unfinished candle. Never use demo commentary as an analytical source.

## Frontend implementation

- Add app-local Dua launcher, panel, context adapter, and a pure insight-calculation module using the existing [Angular patterns](../apps/client-ui/AGENTS.md).
- Use the supplied shark PNG as a static launcher image, preserving transparency and aspect ratio. No animation or generated artwork.
- Keep the launcher approximately 64px square with 16px safe-area spacing. Anchor the desktop panel above it; use a compact responsive sheet on mobile.
- Feed Dua the current account, holdings, stock, market session, cursor, quotes, and connection status through a shared typed context. Reuse existing [market-service](../apps/client-ui/src/app/dashboard/market-data.service.ts) requests and caches; introduce no separate polling loop.
- Calculate a snapshot when a choice is selected or Refresh is pressed. Display its "As of" market timestamp. Reset results when account, stock, or simulation context changes.
- Show skeletons while fetching data, specific unavailable states for missing prices/history, and a retry action on failure. Never substitute average cost for a missing market price.
- Clear state on logout. Preserve keyboard access, focus restoration, Escape-to-close, and mandatory terms-dialog behavior.

## Verification and assumptions

- Test percentage calculations, zero/missing baselines, winner/loser selection, the 10% threshold, and rising/falling/mixed candle sequences.
- Verify simulation filtering, unfinished candles, empty holdings, insufficient history, disconnected data, and context changes.
- Check both screens on desktop and mobile, including keyboard interaction and overlap with existing controls.
- Run the Client UI build, relevant Angular tests, targeted UI checks, and `git diff --check`; update the Client UI README when implementing the feature.

Asset prerequisite: the shark PNGs were not found in the repository search during planning. Their location must be supplied before implementation; use the provided artwork once available.

Defaults: selected account only, English copy, existing simulation data, static shark image, session-only state, and no backend changes.
