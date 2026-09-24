---
name: Obsidian Terminal
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bdc8d2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#87929b'
  outline-variant: '#3d4850'
  surface-tint: '#80cfff'
  primary: '#8bd3ff'
  on-primary: '#00344b'
  primary-container: '#00bbff'
  on-primary-container: '#004764'
  inverse-primary: '#00658c'
  secondary: '#edffe1'
  on-secondary: '#053900'
  secondary-container: '#33ff00'
  on-secondary-container: '#127100'
  tertiary: '#ffb9b6'
  on-tertiary: '#680010'
  tertiary-container: '#ff8f8d'
  on-tertiary-container: '#8a0019'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c5e7ff'
  primary-fixed-dim: '#80cfff'
  on-primary-fixed: '#001e2d'
  on-primary-fixed-variant: '#004c6a'
  secondary-fixed: '#79ff5a'
  secondary-fixed-dim: '#2de500'
  on-secondary-fixed: '#022100'
  on-secondary-fixed-variant: '#0b5300'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b0'
  on-tertiary-fixed: '#410006'
  on-tertiary-fixed-variant: '#92001b'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display:
    fontFamily: Archivo Narrow
    fontSize: 3.5rem
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Archivo Narrow
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Archivo Narrow
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Archivo Narrow
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: 0em
  headline-md:
    fontFamily: Archivo Narrow
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0em
  headline-sm:
    fontFamily: Archivo Narrow
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Archivo Narrow
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  body-md:
    fontFamily: Archivo Narrow
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.45'
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Archivo Narrow
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  label-md:
    fontFamily: Archivo Narrow
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Archivo Narrow
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.08em
  data-mono:
    fontFamily: Archivo Narrow
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.04em
spacing:
  gutter: 0.5rem
  gutter-desktop: 0.75rem
  margin: 0.75rem
  margin-desktop: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets high-frequency quantitative traders, financial analysts, and algorithmic capital managers who operate in real-time, data-dense environments. The brand personality is razor-sharp, analytical, authoritative, and relentlessly focused on execution speed. The interface evokes the tension and precision of an advanced orbital flight terminal or proprietary trading desk—disciplined, technical, and frictionless.

The visual style unites **High-Tech Minimalism** with high-density data brutalism. It strips away ornamental skeuomorphism and excessive blur, relying instead on pure contrast, hairline dividers, monospaced tabular layouts, and precise luminescent signals. The dark canvas minimizes eye fatigue during extended multi-monitor surveillance, while high-voltage neon accents immediately direct attention to volatile order book changes, spread shifts, and system telemetry.

## Colors

Color functions as an operational status indicator rather than decorative styling. Every hue carries unambiguous meaning to eliminate cognitive latency during trading decisions.

- **Primary Canvas (`#0e0e0e`):** A deep carbon black base that absorbs glare and creates infinite contrast against luminescent typography and vectors.
- **Surface Elevation 1 (`#141414`):** Base container fill for secondary panels, sidebar rails, and inactive tiles.
- **Surface Elevation 2 (`#1a1a1a`):** Interactive card fill, elevated popovers, dropdown containers, and table row hover states.
- **Foreground Primary (`#eefaff`):** An icy, blue-tinted white delivering maximum contrast without the harsh vibration of pure `#ffffff`.
- **Foreground Muted (`#8ca3ad`):** Mid-tone slate for field labels, table headers, and timestamp metadata.
- **Foreground Subdued (`#41525a`):** De-emphasized state for disabled controls and tick dividers.
- **Accent / Interactive Cyan (`#00bbff`):** Used exclusively for focus states, interactive triggers, selection rings, primary buttons, and telemetry active tracks.
- **Telemetry Gain (`#33ff00`):** Saturated neon lime for long positions, positive delta, ask executions, and nominal operational states.
- **Telemetry Loss (`#ff0037`):** Electric scarlet for short positions, negative delta, bid sweeps, and critical system faults.
- **Borders & Grid Dividers:** Structured using low-opacity icy blue (`rgba(238, 250, 255, 0.08)`) and active focus cyan (`rgba(0, 187, 255, 0.25)`).

## Typography

Typography relies entirely on the compact, technical efficiency of **Archivo Narrow**. The font family was selected for its high horizontal density, allowing complex financial ledgers and multi-column depth charts to fit more critical data points per viewport inch without degradation of legibility.

All numerical financial figures, currency quantities, execution timestamps, and volume bars must enforce tabular numbers (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;`) to guarantee columnar stability during millisecond ticker updates. Uppercase transformations coupled with expanded letter-spacing (`0.06em` to `0.08em`) are strictly reserved for field labels, status badges, and table headers.

## Layout & Spacing

The layout operates on a compact 4px grid philosophy tailored for maximum information density and zero dead space. 

- **Grid Architecture:** Multi-pane dashboard layouts implement a CSS Grid with 12 to 24 flexible lanes. Gutters are constrained to `0.5rem` on mobile/tablet and `0.75rem` on desktop workstations to allow panels to sit closely together, reflecting the cohesive feel of a hardware instrument console.
- **Viewport Fluidity:** Margin widths are clipped at `1.25rem` maximum to dedicate 96%+ of viewport real estate to order books, depth charts, and trade feeds.
- **Breakpoints & Reflow:**
  - **Mobile (<768px):** Single-column stacked order; ticker summaries freeze to top; complex order matrices convert into segmented card feeds.
  - **Tablet (768px - 1199px):** Split 2-column view; persistent chart paired with toggleable trade/book columns.
  - **Desktop (≥1200px):** Multi-dock arrangement; simultaneous display of depth charts, active bids/asks, algorithmic log terminal, and global portfolio metrics.

## Elevation & Depth

This design system avoids soft, atmospheric drop-shadows and blurred neo-glassmorphism. Depth is engineered exclusively through **structural tonal layering** and **luminescent hairline borders**.

1. **Base Layer (`#0e0e0e`):** The non-interactive terminal backdrop.
2. **Module Surface (`#141414`):** Base layer for charting modules and telemetry grids, separated by a crisp 1px border of `rgba(238, 250, 255, 0.08)`.
3. **Elevated Popovers & Modals (`#1a1a1a`):** Overlays, dropdown menus, and tooltip inspect frames use a sharper boundary composed of a 1px border in `rgba(0, 187, 255, 0.3)` paired with an inner edge stroke (`box-shadow: inset 0 1px 0 0 rgba(238, 250, 255, 0.1)`).
4. **Active Focus & Glow:** Critical active elements and selected data rows omit ambient spread in favor of sharp, high-intensity perimeter highlights (`0 0 0 1px #00bbff, 0 0 12px rgba(0, 187, 255, 0.25)`).

## Shapes

The shape architecture is uncompromisingly architectural and sharp (`roundedness: 0`). 

All buttons, inputs, modules, data cells, badges, and modals feature pure 90-degree corners (`0px` border-radius). This geometric rigor maximizes usable pixel area, aligns precisely with dense data grids, and eliminates visual fluff. In specific edge-case sub-components—such as progress indicator ticks or market breadcrumbs—chamfered 45-degree angle cuts (1px to 2px clip-paths) may be deployed to reinforce the industrial hardware motif.

## Components

### Buttons
- **Primary:** Background `#00bbff`, foreground `#0e0e0e`, font weight 600, uppercase. Hover shifts to `#33c8ff` with an outer cyan glow. Active states snap to scale(0.99).
- **Secondary / Outline:** Background transparent, 1px border `rgba(0, 187, 255, 0.35)`, foreground `#00bbff`. Hover state fills with `rgba(0, 187, 255, 0.08)` and border brightens to `#00bbff`.
- **Destructive / Sell:** Background `#ff0037`, foreground `#0e0e0e` for immediate urgency, or transparent with a `#ff0037` border for standard sell actions.
- **Buy / Long:** Background `#33ff00`, foreground `#0e0e0e` for immediate buy triggers.

### Form Inputs & Selectors
- **Input Fields:** Background `#141414`, border 1px `rgba(238, 250, 255, 0.12)`, text `#eefaff`. Internal padding `0.5rem 0.75rem`. Focus applies a 1px solid `#00bbff` border with an interior inset cyan trace. Monospaced tabular digits for monetary amounts.
- **Checkboxes & Radios:** Sharp square form factors (0px radius). Unchecked: 1px border `rgba(238, 250, 255, 0.3)`. Checked: `#00bbff` solid fill with black check glyph.

### Cards & Panels
- Flat surfaces filled with `#141414`, enclosed by hairline borders `rgba(238, 250, 255, 0.08)`. Headers contain 0.5rem uppercase label typography with integrated status indicator LEDs.

### Data Tables & Ledgers
- Minimal row heights (28px to 32px) for high volume visualization. Alternating rows remain unstriped; separation occurs via hairline horizontal rules `rgba(238, 250, 255, 0.04)`. Hover highlights row in `#1a1a1a`. Price numbers utilize `#33ff00` (bid/gain) and `#ff0037` (ask/loss).

### Chips & Badges
- 0px radius, compact padding (`0.125rem 0.375rem`), font size `0.6875rem`, bold uppercase. Inactive: background `rgba(238, 250, 255, 0.05)`, text `#8ca3ad`. Gain status: background `rgba(51, 255, 0, 0.1)`, text `#33ff00`, border 1px `rgba(51, 255, 0, 0.3)`. Loss status: background `rgba(255, 0, 55, 0.1)`, text `#ff0037`, border 1px `rgba(255, 0, 55, 0.3)`.

### Market Visualizers
- **Order Book Depth Bars:** Horizontal percentage bars rendered behind tabular text using semi-transparent volume fills (`rgba(51, 255, 0, 0.15)` for bid side, `rgba(255, 0, 55, 0.15)` for ask side).
- **Execution Log Feed:** Monospaced real-time scrolling stream with millisecond time stamps rendered in Foreground Muted (`#8ca3ad`).