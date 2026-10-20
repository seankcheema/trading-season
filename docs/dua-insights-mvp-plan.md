# Dua MVP: a shark buddy for stock insights

Status: Implementation added to the Client UI; build, test execution, and browser validation are pending.

## Summary

Add Dua as a clickable shark in the bottom-right corner of the dashboard and advanced stock screen in the [Client UI](../apps/client-ui/README.md).

The compact conversation panel starts closed, with a fin-focused circular shark launcher. Clicking the launcher opens the predefined choices; users can minimize the panel again. The overlay uses viewport-fixed positioning independently of the page layout, remaining at bottom-right while either screen scrolls. All insights use existing market and holdings data, calculated in the browser. No text input, NLP, AI model, or backend changes are included.

## Experience

Dua opens with: "What would you like to review?"

| Choice | Available on | Result |
| --- | --- | --- |
| Daily review | Both screens | Selected account's held stocks with the largest rise and fall since session open. |
| My holdings | Both screens | Position gains and losses compared with average purchase cost. |
| This stock | Advanced stock screen | Selected stock's movement since open and recent price direction. |

Each response contains at most three short insight cards, with a **Back to choices** header control and a **Refresh** action. Relevant stock cards include **View stock**, opening the existing advanced screen.

Example wording:

- "AAPL is up 10.0% since today's session opened."
- "Your TSLA position is 12.4% below your average purchase price."
- "AAPL rose across the last 5 completed candles, gaining 1.8% over that interval."

Insights appear only after selection; opening the panel initially shows choices. No unsolicited insight popups, order actions, reports, downloads, recommendations, or persistent chat history are included in this MVP.

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
- Use the exact supplied [shark-launcher-light-512.png](../apps/client-ui/public/assets/assistant/shark-launcher-light-512.png), copied unchanged into the Client UI public assets and served at `/assets/assistant/shark-launcher-light-512.png`. The supplied AssistantLauncher design is a visual reference only; retain the existing Angular implementation and real analytics.
- Keep the launcher 52px square with circular clipping and 16px safe-area spacing. Use a 50% horizontal, 44% vertical transform origin. At rest, scale the image to 2.2x and translate it 4px down to center the fin in the circular clip while keeping the face below the visible area.
- Fix the component host itself to the viewport at bottom-right, sized only to the shark, so scrolling the dashboard or advanced stock screen never moves it. Do not add a wrapper div, viewport-sized container, spacer, or reserved page area. The chat bubble is absolutely anchored above the shark.
- On hover, keyboard focus, while a notification is pending, or while chat is open, slide the image to translateY(-10px) and scale 1.35 over 450ms with symmetric ease-in-out, restoring the less magnified face view. Move only the image; keep the launcher size and position unchanged. Smoothly slide back to the centered idle fin crop over 450ms with symmetric ease-in-out when closed with no pending notification and no longer hovered or focused. No wiggle, image swapping, timed introduction, or automatic opening.
- Initial account/stock data establishes a baseline. Changes to the rounded insight cards or market trading date produce one consolidated pending update for that account, session and stock context, using existing UI data with no extra requests. Show a small red **1** badge on the notification shark; it represents the pending snapshot rather than a count of stocks or ticks.
- Clicking the notified shark opens the chat, acknowledges the update, removes the badge, and reveals the full face in one click. Position the red badge 6px below the top of the launcher, outside the circular image clipping area. A pending notification keeps the slightly zoomed face visible, even without hover. Hovering or focusing also reveals the face without changing the notification state. Close chat on every page navigation, preserving insight baselines and notification acknowledgement. Reset user-specific insight baselines on logout. With reduced motion, switch image transforms immediately, and keep Dua hidden while terms block the page.
- MVP notification limit: once the user clicks a notified shark, suppress further notifications for the remainder of that page load, across account changes and navigation. Keep this acknowledgement in memory only; a full browser refresh permits a new notification. This does not prevent opening the chat or refreshing its insights.
- Feed Dua the current account, holdings, stock, market session, cursor, quotes, and connection status through a shared typed context. Reuse existing [market-service](../apps/client-ui/src/app/dashboard/market-data.service.ts) requests and caches; introduce no separate polling loop.
- Calculate a snapshot when a choice is selected or Refresh is pressed. Display its "As of" market timestamp. Reset results when account, stock, or simulation context changes.
- Show skeletons while fetching data, specific unavailable states for missing prices/history, and a retry action on failure. Never substitute average cost for a missing market price.
- Clear state on logout. Preserve keyboard access, focus restoration, Escape-to-close, and mandatory terms-dialog behavior.

## Minimal chat appearance

- Anchor the compact rounded panel 12px above the circular launcher, keeping the shark visible below it. Follow the supplied reference's clean panel outline without a bubble tail.
- Use a desktop width of 320px and a maximum height of 400px, constrained to the available viewport. Let content determine the height until that limit, then scroll the body internally. On mobile, retain the compact anchored bubble with width limited to the viewport minus 32px; do not expand into a full-screen chat.
- Use the app's charcoal card and muted surface tokens, subtle borders, off-white text, restrained cyan accents, and a soft shadow. Avoid neon glows, gradients, pulsing effects, and decorative animation.
- The initial header has a small full-face shark avatar, an 18px "Dua" name with a smaller "- Free Plan" label, and a minimize button. In result views, replace the avatar with a back control and display the selected choice title. Use short messages, rounded choice rows with small icons and descriptive subtitles, and subtle result dividers. Show only the current choices or result, without accumulating a transcript.
- Open with a 180ms ease-out opacity and small upward translation from the shark; close over 120ms. Use the lower-right transform origin so the panel appears connected to the launcher. Disable these transitions for reduced-motion preferences.
- Keep all interaction choice-based: no composer, typing indicator, oversized welcome screen, or extra decorative controls. Display insight timestamps and necessary status feedback quietly but legibly.

## Verification and assumptions

- Test percentage calculations, zero/missing baselines, winner/loser selection, the 10% threshold, and rising/falling/mixed candle sequences.
- Verify simulation filtering, unfinished candles, empty holdings, insufficient history, disconnected data, and context changes.
- Check both screens on desktop and mobile, including keyboard interaction and overlap with existing controls.
- Verify the initial closed/fin-focused state, smooth face reveal on hover and keyboard focus, new-information badges, opening chat and clearing notifications in one click, reduced motion, and image fallback. Check that the compact panel remains within the viewport and the launcher stays fixed while both screens scroll.
- Run the Client UI build, relevant Angular tests, targeted UI checks, and `git diff --check`; update the Client UI README when implementing the feature.

Defaults: selected account only, English copy, existing simulation data, exact supplied light shark PNG, compact charcoal panel, session-only state, and no backend changes.
