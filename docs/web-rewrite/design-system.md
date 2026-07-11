# Underdeck — Design System Specification

**Area:** `design-system`
**Source paths covered:** `lib/design_system/` (all files, including `components/`, `components/info_card/`, `painters/`), `assets/fonts/`, `pubspec.yaml` font declarations, plus the app-level theme wiring in `lib/app/theme.dart` and the two settings/haptics services the design-system components depend on.
**Target:** Recode as CSS/React (Vite + React + TypeScript, GitHub Pages). The web developers have NO access to the Flutter code — this document is the only source.

---

## 1. Visual identity overview

Underdeck is a **dark sci-fi / cyberpunk "ship terminal" companion app** for the game *Underpunks55*. The entire app is a single dark theme (no light mode). The look is built from:

- A **near-black deep-navy background** (`#03060B`) with a faint cyan radial glow bleeding in from the top-left corner.
- A **very faint hexagonal grid** drawn over the whole background (6% opacity), evoking a sci-fi HUD.
- **CRT scanlines** overlaid on top of ALL content (thin dark horizontal lines every 3px, multiply-blended) for a retro-terminal feel.
- Optional **floating cyan particles** drifting upward (used on select hero screens).
- **"Glass" cards**: dark navy panels with 1px faint-cyan borders and 14px rounded corners. (Real backdrop blur exists as an option but is OFF by default for performance — the default card is a solid fill.)
- **Neon accents**: electric cyan (`#4FC3FF`) primary, lighter cyan (`#7AE3FF`) secondary, plus pink-red danger, amber warn, mint success.
- **Terminal typography**: JetBrains Mono for all "system readout" text (uppercase micro-labels with 2px letter-spacing, `> namespace.notes` prompts, blinking `▋` block cursors, zero-padded `[01]` indexes); Inter for body copy; Quicksand for large friendly display numerals/titles.
- Fictional in-world branding: every main page has an opaque top banner reading `ESSI · <Page Name>` with a pulsing green status dot and a scroll-driven fake sector code `ESSI//NNN` on the right.

Everything glows subtly: buttons carry colored box-shadows, active elements pulse, reveals slide up 5% with a fade like console output appearing.

**Accessibility / reduced motion:** Every animation in the design system is disabled when EITHER the OS-level "reduce motion" setting is on (web: `@media (prefers-reduced-motion: reduce)`) OR the in-app setting `settings.reduceAnimations` (persisted, see §10) is true. When disabled, components render their static end-state (details per component below).

---

## 2. Color tokens (`lib/design_system/colors.dart`)

All colors are fully opaque unless an alpha is listed. Alpha values map to CSS `rgba()`.

| Token | Hex / value | CSS equivalent | Usage |
|---|---|---|---|
| `bgDeepest` | `#03060B` | `#03060B` | App/page background, scaffold, banners, code-block copy button fill |
| `bgElevated` | `#0A1220` | `#0A1220` | Elevated surfaces (declared; used by feature screens) |
| `bgGlass` | `#0F1C30` @ 55% alpha | `rgba(15, 28, 48, 0.55)` | InfoCard fill (translucent panel) |
| `bgCard` | `#111E30` | `#111E30` | GlassCard fill — the **opaque** sibling of `bgGlass` used by default cards (no blur) |
| `accentPrimary` | `#4FC3FF` | `#4FC3FF` | Electric cyan. Primary accent: terminal text, icons, section headers, glows, button gradients |
| `accentSecondary` | `#7AE3FF` | `#7AE3FF` | Lighter cyan. Second gradient stop, code text, op/step titles, particles |
| `accentDanger` | `#FF5577` | `#FF5577` | Pink-red. Danger buttons, error color |
| `accentWarn` | `#FFB347` | `#FFB347` | Amber. Warnings, quirk rows, danger-button gradient second stop |
| `accentSuccess` | `#5FE8A0` | `#5FE8A0` | Mint green. Success states, live-status dots |
| `textPrimary` | `#E8F4FF` | `#E8F4FF` | Near-white ice-blue. Primary text, default icon color |
| `textSecondary` | `#8AA4C2` | `#8AA4C2` | Muted blue-grey. Secondary text, captions, info-card body |
| `textDim` | `#6E8AAB` | `#6E8AAB` | Dimmest text. Chevrons, micro-labels, timestamps. (Deliberately tuned to ~4.7:1 contrast on `bgCard` for WCAG AA at 10px sizes — do not darken.) |
| `borderSubtle` | `#7AE3FF` @ 12% alpha | `rgba(122, 227, 255, 0.12)` | 1px borders on all cards/panels |
| `borderGlow` | `#4FC3FF` @ 45% alpha | `rgba(79, 195, 255, 0.45)` | 1px border on neon buttons |

Additional derived colors used inside components (compute at use-site):
- `accentPrimary @ 10%` → `rgba(79,195,255,0.10)` — background radial glow.
- `accentPrimary @ 18%` → glow shadow of GlassCard `glow` variant.
- `accentPrimary @ 40–60%` → back-to-top button border/shadow.
- `accentSecondary @ up to 55%` → particle color (opacity animated).
- `black @ 18%` → scanline stroke (`rgba(0,0,0,0.18)`), multiply blend.
- `borderSubtle @ 40% of its own alpha` → TerminalNotes divider = `rgba(122,227,255,0.048)`.

Suggested CSS custom properties:

```css
:root {
  --bg-deepest: #03060B;
  --bg-elevated: #0A1220;
  --bg-glass: rgba(15, 28, 48, 0.55);
  --bg-card: #111E30;
  --accent-primary: #4FC3FF;
  --accent-secondary: #7AE3FF;
  --accent-danger: #FF5577;
  --accent-warn: #FFB347;
  --accent-success: #5FE8A0;
  --text-primary: #E8F4FF;
  --text-secondary: #8AA4C2;
  --text-dim: #6E8AAB;
  --border-subtle: rgba(122, 227, 255, 0.12);
  --border-glow: rgba(79, 195, 255, 0.45);
}
```

---

## 3. Typography (`lib/design_system/typography.dart`, `assets/fonts/`, `pubspec.yaml`)

### 3.1 Font families (bundled assets — never fetched from Google Fonts at runtime, for privacy + offline)

| Family name | Asset file | License file | Role |
|---|---|---|---|
| `Inter` | `assets/fonts/Inter-Variable.ttf` (variable `wght` axis) | `assets/fonts/Inter-OFL.txt` (SIL OFL) | Sans — body/UI text |
| `JetBrainsMono` | `assets/fonts/JetBrainsMono-Variable.ttf` (variable `wght`) | `assets/fonts/JetBrainsMono-OFL.txt` (SIL OFL) | Mono — terminal/system text |
| `Quicksand` | `assets/fonts/Quicksand-Variable.ttf` (variable `wght`, max 700) | `assets/fonts/Quicksand-OFL.txt` (SIL OFL) | Rounded — display numerals/titles |

**Web adaptation:** self-host the same three variable TTFs (or woff2 conversions) with `@font-face`; do NOT link fonts.gstatic.com (the Flutter app deliberately avoids it). The OFL license texts must remain distributed with the app (the Flutter app registers them in an in-app license page via `LicenseRegistry`; on web, include them in the repo and/or an "About / licenses" page).

CSS stacks:
```css
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrainsMono', ui-monospace, monospace;
--font-rounded: 'Quicksand', var(--font-sans);
```

### 3.2 Type scale

All styles default `text-decoration: none`. Flutter `height` = CSS unitless `line-height`. Where no height is set, Flutter uses the font metrics (~1.17–1.5 depending on family); using `line-height: normal` in CSS is acceptable.

| Style token | Family | Size (px) | Weight | Line-height | Color | Letter-spacing |
|---|---|---|---|---|---|---|
| `display` | Quicksand | 34 | 600 | 1.1 | `textPrimary` | normal |
| `title` | Inter | 22 | 600 | normal | `textPrimary` | normal |
| `headline` | Inter | 17 | 600 | normal | `textPrimary` | normal |
| `body` | Inter | 15 | 400 | normal | `textPrimary` | normal |
| `caption` | Inter | 12 | 500 | normal | `textSecondary` | normal |
| `mono` | JetBrainsMono | 14 | 400 | normal | `textPrimary` | normal |
| `terminal` | JetBrainsMono | 13 | 500 | normal | `accentPrimary` | normal |

Components frequently derive from these with `copyWith` — the derived variants are documented per component below (common ones: mono 9–12px in various weights/colors; the uppercase 2px-letter-spaced micro-label).

### 3.3 Theme wiring (`lib/app/theme.dart`)

Material dark theme overridden with:
- `scaffoldBackgroundColor: #03060B`
- colorScheme: `surface #03060B`, `primary #4FC3FF`, `secondary #7AE3FF`, `error #FF5577`, `onSurface #E8F4FF`
- textTheme mapping: displayLarge→`display`, displayMedium & titleLarge→`title`, titleMedium→`headline`, bodyLarge & bodyMedium→`body`, labelMedium & labelSmall→`caption`
- Default icon color: `#E8F4FF`
- Ripple/splash: `accentPrimary @ 8%` splash, `@ 4%` highlight. (Web: use a subtle `:active` background of `rgba(79,195,255,0.08)` on interactive Material-like surfaces, or drop ripples entirely.)

---

## 4. Spacing, radii, motion tokens

### 4.1 Spacing (`lib/design_system/spacing.dart` — `AppSpacing`)

| Token | px |
|---|---|
| `xxs` | 2 |
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 24 |
| `xxl` | 32 |
| `xxxl` | 48 |

### 4.2 Border radii (`AppRadius`)

| Token | px | Usage |
|---|---|---|
| `sm` | 8 | Code blocks, small chips |
| `md` | 14 | Cards, buttons (default) |
| `lg` | 22 | Bottom sheets (top corners) |

### 4.3 Motion (`lib/design_system/motion.dart` — `AppMotion`)

| Token | Duration | Curve | CSS equivalent |
|---|---|---|---|
| `cta` | 400 ms | easeOutBack | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` (slight overshoot) |
| `card` | 550 ms | easeOutCubic | `cubic-bezier(0.215, 0.61, 0.355, 1)` |
| `subtle` | 200 ms | easeInOut | `cubic-bezier(0.42, 0, 0.58, 1)` |
| `flash` | 350 ms | easeOut | `cubic-bezier(0, 0, 0.58, 1)` |

These are shared tokens; individual components also hard-code durations (listed per component).

---

## 5. Background system

### 5.1 `AppBackground` (`components/app_background.dart`)

Full-screen stack wrapping every page. Props: `showsParticles` (default **false**), `showsScanlines` (default **true**). Layers bottom→top:

1. **Solid fill** `#03060B` covering everything.
2. **Radial gradient glow**: centered at the TOP-LEFT corner (Flutter `Alignment(-1,-1)` = the corner itself), radius 1.2× of the shorter dimension, from `rgba(79,195,255,0.10)` at center to fully transparent. CSS: `background: radial-gradient(circle 120% at 0% 0%, rgba(79,195,255,0.10), transparent);` layered over the solid fill.
3. **Hex grid** at 6% opacity (`opacity: 0.06`), pointer-events none. See §5.2.
4. **Cyber particles** (only if `showsParticles`), see §5.4.
5. **The page content** (children).
6. **Scanlines overlay** (only if `showsScanlines`) at 55% opacity, pointer-events none, ON TOP of the content. See §5.3.

Also: tapping anywhere on the background dismisses the focused text input (Flutter unfocuses primary focus). Web: optional; blur active element on background click is a reasonable equivalent.

### 5.2 `HexGridPainter` (`painters/hex_grid_painter.dart`)

Draws a flat-top hexagon tiling with stroked outlines. Algorithm (exact):

- Hexagon circumradius `r = 18` (px).
- Stroke: color `#4FC3FF`, width `0.4px`, no fill. (Whole layer later dimmed to 6% opacity by AppBackground.)
- Row step: `dy = r * sqrt(3) / 2 ≈ 15.588`; rows are placed at `y = -dy, +dy, +3dy, ...` i.e. starting at `y = -dy` and incrementing by `2*dy ≈ 31.18` per row.
- Odd rows are shifted right by `r * 1.5 = 27`.
- Within a row, hexagon centers start at `x = -r + xOffset` and step by `r * 3 = 54` until `x ≥ width + r`.
- Each hexagon: 6 vertices at angles `i * 60°` (i = 0..5), vertex at `(cx + r*cos(a), cy + r*sin(a))`, closed path. (Angle 0 = pointing right → "pointy-left/right" flat-top orientation.)

Pseudo-code:

```js
const r = 18, dy = r * Math.sqrt(3) / 2;
ctx.strokeStyle = '#4FC3FF'; ctx.lineWidth = 0.4;
let row = 0;
for (let y = -dy; y < height + dy; y += dy * 2, row++) {
  const xOffset = row % 2 === 0 ? 0 : r * 1.5;
  for (let x = -r + xOffset; x < width + r; x += r * 3) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  }
}
```

Static — paint once (Canvas, or better: an inline SVG `<pattern>` / pre-rendered data-URI tile repeated with `background-repeat`; tile size 54×31.177 with the two offset hexes).

### 5.3 `ScanlinesPainter` (`painters/scanlines_painter.dart`)

CRT scanlines: 1px-tall horizontal rectangles, color `rgba(0,0,0,0.18)`, blend mode **multiply**, repeated every `3px` starting at y=0 (so 1px dark line + 2px gap). Layer is drawn ABOVE content at 55% layer opacity (net line alpha ≈ 0.099).

CSS equivalent (fixed, pointer-events none, covering the viewport, z-index above content):

```css
.scanlines {
  position: fixed; inset: 0; pointer-events: none;
  opacity: 0.55; mix-blend-mode: multiply;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px,
    transparent 1px, transparent 3px
  );
}
```

### 5.4 `CyberParticles` (`components/cyber_particles.dart`) + `CyberParticlesPainter` (`painters/cyber_particles_painter.dart`)

Floating cyan dots drifting upward, full-screen, pointer-events none. Default `count = 28` particles. **Hidden entirely** (render nothing) when reduce-motion is active.

Particle model (each generated once with uniform random values):
- `x`: 0..1 (fraction of width — fixed; particles move only vertically)
- `speed`: 0.18..0.55 (full screen-heights per second)
- `radius`: 0.6..2.4 px
- `phase`: 0..1 (cycle offset)

Per animation frame, with `t` = elapsed seconds:

```js
for (const p of particles) {
  let cycle = (t * p.speed + p.phase) % 1; if (cycle < 0) cycle += 1;
  const y = height * (1 - cycle);              // travels bottom → top
  const opacity = Math.sin(cycle * Math.PI);   // fades in at bottom, out at top
  ctx.fillStyle = `rgba(122, 227, 255, ${0.55 * opacity})`; // accentSecondary
  ctx.beginPath(); ctx.arc(p.x * width, y, p.radius, 0, Math.PI * 2); ctx.fill();
}
```

Web: `<canvas>` + `requestAnimationFrame`; stop the loop when `prefers-reduced-motion` or in-app setting says so, or when tab hidden.

---

## 6. Layout / page-scaffold components

### 6.1 `TransmissionHeader` (`components/transmission_header.dart`) — the "ESSI banner"

Opaque banner at the top of every main page (and inside scroll content on detail pages). **Fully solid `#03060B` background** — content scrolls between the banner and the bottom nav, never behind either.

Structure (outer→inner):
- Container: background `#03060B`, padding `12px horizontal, 6px vertical`.
- Inner box with a `1px` bottom border `var(--border-subtle)` and `4px` padding-bottom.
- Row content, vertically centered:
  1. **PulsingDot** — 6px circle, color `accentSuccess` (`#5FE8A0`), pulsing (see §8.1).
  2. 8px gap.
  3. **Label** (flexes, ellipsis on overflow): the `label` prop rendered **UPPERCASE**, JetBrainsMono 10px, weight 600, letter-spacing 2px, color `#4FC3FF`. Example content: `ESSI · OPERATIONS BRIDGE`.
  4. **Sector code** (right-aligned): JetBrainsMono 10px, weight 500, color `#6E8AAB`. Text is `ESSI//NNN`.
  5. If actions exist: 8px gap, then the trailing action icon widgets (typically a `+` create button supplied by the page).

**Sector code logic (exact):**
- If an explicit `sector` string prop is given, show it verbatim.
- Otherwise it is scroll-driven: on mount pick a random integer seed `0..899` (per header instance, stable for its lifetime). Given the current scroll offset in px:
  ```
  ticks = floor(abs(scrollOffset) / 4)        // changes every 4px scrolled
  value = 100 + ((seed + ticks) % 900)        // always 100..999
  text  = `ESSI//${value}`
  ```
- Scroll offset source: an explicitly passed reactive offset (preferred, from `BannerPage`), else the nearest `ScrollOffsetScope` context (see §6.3), else static 0.

### 6.2 `BannerPage` (`components/banner_page.dart`)

Layout scaffold for main shell pages: a `SafeArea` (top only) column of
1. `TransmissionHeader` (pinned, non-scrolling) with `bannerLabel` and optional `bannerActions`;
2. the page body (fills remaining height), built via a render-prop that receives the shared scroll element/controller so the header's sector code can track the body's scroll offset.

Web equivalent: a flex column (100dvh minus bottom nav), header `flex: none`, body `flex: 1; overflow-y: auto`, with a scroll listener feeding the header's sector-code state.

### 6.3 `PageScrollView` + `ScrollOffsetScope` (`components/page_scroll_view.dart`)

Drop-in scroll wrapper used by page bodies. Two flavors (plain child vs. virtualized sliver list — on web this is just "optionally virtualize long lists", e.g. with a windowing library). Behavior:

- Broadcasts its scroll offset to descendants (`ScrollOffsetScope` — web: React context holding the offset, or a callback).
- Keyboard dismiss on drag (mobile-only nicety — **drop on web**).
- **Back-to-top floating button**: appears once `scrollTop > viewportHeight` (one full screen). Positioned `16px` from right and bottom of the scroll area. Appearance/disappearance animates with a 200ms scale+fade (`AnimatedSwitcher`; web: CSS transition on `transform: scale()` + `opacity`).
  - Button visual: 44×44 circle, background `#03060B`, border 1px `rgba(79,195,255,0.6)`, box-shadow `0 0 10px rgba(79,195,255,0.4)`, containing a Material **`arrow_upward`** icon, 22px, color `#4FC3FF`.
  - On click: light haptic (web: **drop**, or `navigator.vibrate(10)` where supported) then smooth-scroll to top over 300ms easeInOut (web: `scrollTo({top: 0, behavior: 'smooth'})`).

---

## 7. Surface components

### 7.1 `GlassCard` (`components/glass_card.dart`) — the standard card

Props: `padding` (default 12px all around), `radius` (default 14), `glow` (default false), `blur` (default false).

Default (no blur):
```css
.glass-card {
  background: #111E30;            /* bgCard — opaque on purpose (perf) */
  border: 1px solid rgba(122,227,255,0.12);
  border-radius: 14px;
  padding: 12px;
  overflow: hidden;                /* content clipped to radius */
}
```

- `blur: true` variant (rare; only for cards over busy content): background becomes translucent glass and a backdrop blur of 18px is applied: `background: rgba(15,28,48,0.55); backdrop-filter: blur(18px);`. **Performance note carried from the app:** default stays non-blurred because 5+ blurred cards on screen cost too much GPU; keep that discipline on web too (`backdrop-filter` is similarly expensive).
- `glow: true` variant adds an outer glow: `box-shadow: 0 0 14px rgba(79,195,255,0.18);`.

### 7.2 `InfoCard` (`components/info_card/info_card.dart`)

Lightweight panel used inside "How it works" sheets; designed to be cheap to stack many times.

```css
.info-card {
  width: 100%;
  background: rgba(15,28,48,0.55);   /* bgGlass, NO backdrop blur */
  border: 1px solid rgba(122,227,255,0.12);
  border-radius: 14px;
  padding: 16px;                      /* default; overridable */
}
```

### 7.3 `NeonButton` (`components/neon_button.dart`) — primary CTA

Props: `title` (string), `icon` (optional Material icon), `onPressed`, `enabled` (default true), `danger` (default false).

Visual (default):
- Min-height **50px**, full width of parent (it stretches; content centered).
- Background: horizontal linear gradient left→right from `#4FC3FF` to `#7AE3FF`. Danger variant: `#FF5577` → `#FFB347`.
- Border: 1px `rgba(79,195,255,0.45)` (`borderGlow`) — same in danger variant.
- Border-radius 14px.
- Glow: `box-shadow: 0 0 14px rgba(79,195,255,0.45)` (first gradient color at 45% alpha; danger: `rgba(255,85,119,0.45)`).
- Content: centered row — optional icon (18px, color `#03060B`) + 8px gap + title text (Inter/system 16px, weight 600, color **`#03060B`** i.e. dark text on the bright gradient).

States:
- **Pressed**: scales to `0.97` with a 200ms ease-out transition (`transform: scale(0.97); transition: transform 200ms cubic-bezier(0,0,0.58,1);` on `:active`).
- **Disabled**: whole button at `opacity: 0.4`, non-interactive.
- On successful press: light haptic then callback (haptic → **drop** on web).
- Accessibility: exposes a single button node labeled with the title (`<button aria-label>` naturally covers this).

### 7.4 `ToolCard` (`components/tool_card.dart`) — navigation list card

A tappable `GlassCard` row used on hub pages. Props: `title`, `subtitle`, `icon` (Material), `tint` (color), `onTap`.

Layout (row, 12px card padding from GlassCard):
1. Icon area: fixed 44×44 box, centered Material icon 28px in the provided `tint` color.
2. 12px gap.
3. Text column (flexes): title in `headline` (Inter 17 / 600 / `#E8F4FF`), 4px gap, subtitle in `caption` (Inter 12 / 500 / `#8AA4C2`).
4. Trailing chevron: Material **`chevron_right`**, 20px, color `#6E8AAB`.

On tap: light haptic (drop on web) then navigate. Whole card is the hit target. Accessibility: one merged button node — label = title, description/hint = subtitle.

### 7.5 `SectionHeader` (`components/section_header.dart`)

Row heading above content sections. Props: `title`, optional `subtitle`, optional `icon`.

- Optional leading Material icon: 18px, `#4FC3FF`, followed by 8px gap.
- Title rendered **UPPERCASE**: JetBrainsMono 12px, weight 600, **letter-spacing 2px**, color `#4FC3FF`.
- Optional subtitle 2px below: `caption` style (Inter 12 / 500 / `#8AA4C2`).

### 7.6 `TerminalNotes` (`components/terminal_notes.dart`)

Terminal-style notes card ("`> hangar.notes`" blocks used on hangar, asteroid analyzer, etc.). Props: `title` (namespace without the `> ` prefix), `lines` (list of strings).

Rendered inside a default `GlassCard`. Content, top to bottom:
1. Header row: text `> {title}` in `terminal` style (JetBrainsMono 13 / 500 / `#4FC3FF`); a spacer; then a static 6px circle in `#5FE8A0` at the far right (a "system online" dot — NOT pulsing here).
2. 8px gap, then a 1px horizontal divider colored `rgba(122,227,255,0.048)` (borderSubtle at 40% of its alpha), then 8px gap.
3. One row per line, 4px between rows:
   - Fixed 28px-wide index cell: `[NN]` where NN is the 1-based index zero-padded to 2 digits (`[01]`, `[02]`, …) — JetBrainsMono 11 / 600 / `#4FC3FF`.
   - 8px gap; the line text in `body` style but colored `#8AA4C2` (Inter 15 / 400), wrapping.
4. 4px gap + a trailing "pending" line (2px top padding): index `[NN]` for `lines.length + 1`, same style but the index color at 55% alpha (`rgba(79,195,255,0.55)`), then 8px gap, then a **BlinkingCursor** (`▋`, see §8.2) — suggesting "more notes pending".

### 7.7 `BootTerminalText` (`components/boot_terminal_text.dart`) — typewriter boot log

Animated terminal type-out used on boot/landing surfaces. Props with defaults:
- `lines`: list of strings to type.
- `charDelay`: 18 ms per character (18000 µs).
- `lineDelay`: 180 ms pause after each finished line.
- `visibleLines`: 4 (window height in lines).
- `lineHeight`: 18 px per line; `lineSpacing`: 4 px between lines.
- `onComplete` callback.

Behavior:
- Container height = `visibleLines * lineHeight + (visibleLines - 1) * lineSpacing` (default 4×18 + 3×4 = **84px**), full width, content clipped; internal scroll is programmatic only (user cannot scroll it).
- Types each line character by character (`charDelay` between chars). After a line completes, waits `lineDelay`, then starts a new line. While typing, the line in progress shows a trailing `▋` cursor blinking at 600ms cycle (opacity oscillates 0→1 with ease-in-out, mirrored — i.e. triangle-ish fade in/out). The cursor disappears once all lines finish.
- Auto-scrolls to bottom as new lines appear (180ms ease-out per scroll), so only the last `visibleLines` are visible — like a console window.
- Text style: `terminal` (JetBrainsMono 13 / 500 / `#4FC3FF`). Each line is exactly `lineHeight` tall, vertically centered.
- **Reduced motion:** renders all lines instantly (no typing, no cursor) and fires `onComplete` immediately.

### 7.8 `HowItWorksSheet` (`components/info_card/how_it_works_sheet.dart`) — bottom sheet scaffold

Standard scaffold for every "How it works" explainer. Presented as a **draggable modal bottom sheet**:
- Initial height 92% of screen; user can drag between 50% (min) and 97% (max). Web adaptation: a modal sheet/dialog covering ~92dvh (drag-resize optional; a fixed 92dvh panel with internal scroll is acceptable), with an overlay behind that dismisses on click.
- Top corners rounded 22px (`AppRadius.lg`), content clipped.
- Background `#03060B`.
- **App bar** (transparent over the sheet background, no elevation):
  - Leading: a text button, width 80px, label **`Close`** in `body` style colored `#8AA4C2` (Inter 15 / 400). Dismisses the sheet.
  - Centered title: **`How it works`** in `headline` (Inter 17 / 600 / `#E8F4FF`).
- Body: vertically scrolling list of the provided cards, padding `12px left/right`, top padding = safe-area + toolbar height (~56px) + 8px, bottom padding 32px. Cards separated by 16px vertical gaps.
- Cards are `InfoCard`s composed of the row primitives below (§7.9). *The actual copy text of each sheet lives in the feature specs, not here.*

### 7.9 Info-card row primitives (`components/info_card/*.dart`)

Small typographic rows composed inside `InfoCard`s in How-it-works sheets. All wrap at container width; "mono" = JetBrainsMono, "sans" = Inter.

**`KvRow`** (`kv_row.dart`) — key/value line. Props: `label`, `value`, `labelWidth` (default 110px). 2px vertical padding. Row: fixed-width label cell (mono 11 / 600 / `#4FC3FF`), 8px gap, value (mono 11 / 400 / `#8AA4C2`, flexes/wraps). Top-aligned.

**`OpRow`** (`op_row.dart`) — operation + description. Props: `op`, `desc`. 1px vertical padding. Row: fixed 70px op cell (mono 12 / 600 / `#7AE3FF`), 8px gap, description (sans 11 / 400 / `#8AA4C2`).

**`ParamRow`** (`param_row.dart`) — parameter with value and note. Props: `name`, `value`, `note`. 2px vertical padding. Line 1: name (mono 12 / 600 / `#7AE3FF`) and value (mono 11 / 400 / `#4FC3FF`) side by side with 8px gap, wrapping as needed. 2px gap. Line 2: note (sans 11 / 400 / `#8AA4C2`).

**`QuirkRow`** (`quirk_row.dart`) — warning/quirk callout. Props: `title`, `detail`. 2px vertical padding. Row: Material icon **`warning_amber_rounded`** 14px `#FFB347` (nudged 2px down to align with text), 8px gap, then a column: title (mono 12 / 600 / `#FFB347`), 2px gap, detail (sans 11 / 400 / `#8AA4C2`).

**`StatusRow`** (`status_row.dart`) — emoji/status icon + rule. Props: `icon` (a STRING, typically an emoji), `title`, `rule`. 2px vertical padding. Row: fixed 28px cell with the icon string at 18px font-size, 8px gap, column of title (mono 12 / 600 / `#4FC3FF`), 2px gap, rule (sans 11 / 400 / `#8AA4C2`).

**`StepRow`** (`step_row.dart`) — numbered step. Props: `number` (string), `title`, `body`. 2px vertical padding. Row: fixed 22px cell with the number (mono 16 / **700** / `#4FC3FF`), 8px gap, column of title (mono 12 / 600 / `#7AE3FF`), 2px gap, body (sans 11 / 400 / `#8AA4C2`).

**`TierRow`** (`tier_row.dart`) — tier badge + text. Props: `tier` (short string, e.g. "A"), `title`, `body`. 2px vertical padding. Row: a 22×22 **circle badge** — transparent fill, border `0.7px solid rgba(79,195,255,0.6)`, centered tier text (mono 11 / 700 / `#4FC3FF`) — then 8px gap, column of title (mono 12 / 600 / `#7AE3FF`), 2px gap, body (sans 11 / 400 / `#8AA4C2`).

**`WindowRow`** (`window_row.dart`) — planet time-windows, two-column. Props: `planet`, `broad`, `refine`. 2px vertical padding. Column: planet name (mono 12 / 600 / `#7AE3FF`), 2px gap, then a row of two equal-width columns:
- Left: micro-label **`Coarse`** (mono 9 / 400 / `#6E8AAB`) above the `broad` value (mono 11 / 400 / `#8AA4C2`).
- Right: micro-label **`Refine`** (mono 9 / 400 / `#6E8AAB`) above the `refine` value (same style).

**`CodeBlock`** (`code_block.dart`) — copyable code snippet. Props: `text`. Structure:
- Container: background `rgba(3,6,11,0.55)` (bgDeepest @ 55%), border 1px `var(--border-subtle)`, radius 8px.
- Content: horizontally scrollable single-line/multi-line code, padding `8px top/bottom, 8px left, 40px right` (right padding reserves space for the copy button). Text: mono 11 / 400 / **`#7AE3FF`**, no wrapping (`white-space: pre; overflow-x: auto`).
- **Copy button** pinned top-right (6px inset from the container edges): 28×26 px, background `#03060B`, border 1px `var(--border-subtle)`, radius **5px**, centered icon 11px — Material **`copy`** (`content_copy`) in `#4FC3FF`.
- On click: copies the raw `text` to clipboard (web: `navigator.clipboard.writeText`), fires a success haptic (**drop** on web), swaps the icon to Material **`check`** in `#5FE8A0` for **1500 ms**, then reverts.

---

## 8. Animated primitives (`components/animated_primitives.dart`)

Shared rule for all five: **skip animation** when in-app `reduceAnimations` OR system reduce-motion is on — render the static fallback noted per component.

### 8.1 `PulsingDot`

Props: `color` (required), `size` (default 6px). A filled circle that slowly "breathes" by crossfading its opacity between **1.0 and 0.35** every **800 ms** (ease-in-out, alternating). Implementation detail worth copying: it's a low-rate opacity toggle, not a per-frame animation — on web, a simple CSS keyframe animation is perfect:

```css
@keyframes pulse-dot { from { opacity: 1; } to { opacity: 0.35; } }
.pulsing-dot { animation: pulse-dot 800ms ease-in-out infinite alternate; }
```

The animation pauses when the page/route is not visible (web: CSS animations on hidden elements are cheap; optionally pause with `document.visibilityState`). **Reduced motion:** static full-opacity dot.

### 8.2 `BlinkingCursor`

The text glyph `▋` (U+258B) in `terminal` style (JetBrainsMono 13 / 500 / `#4FC3FF`), opacity oscillating 0→1→0 over a **600 ms** half-cycle (ease-in-out, alternating — a smooth fade, not a hard blink):

```css
@keyframes blink-cursor { from { opacity: 0; } to { opacity: 1; } }
.blinking-cursor { animation: blink-cursor 600ms ease-in-out infinite alternate; }
```

**Reduced motion:** static `▋` at full opacity.

### 8.3 `PulsingGlow`

Wraps a child and pulses an outer glow. Props: `color` (default `#4FC3FF`), optional border-radius. Over a **1100 ms** alternating ease-in-out cycle, the box-shadow animates between:
- min: `0 0 4px rgba(color, 0.2)`
- max: `0 0 10px rgba(color, 0.7)`

(Both alpha and blur radius interpolate together with the same eased `t`: `alpha = 0.2 + 0.5t`, `blur = 4 + 6t`.) **Reduced motion:** static `0 0 6px rgba(color, 0.45)`.

### 8.4 `PulsingScale`

Wraps a (circular) child, pulsing both scale and a circular glow over a **1000 ms** alternating ease-in-out cycle:
- `scale: 1.0 → 1.15`
- glow: `0 0 2px rgba(color,0.2)` → `0 0 6px rgba(color,0.6)` (alpha `0.2+0.4t`, blur `2+4t`), circle-shaped shadow.

**Reduced motion:** static, no scale, `0 0 2px rgba(color,0.5)`.

### 8.5 `ConsoleReveal`

Entrance animation for content appearing like console output. Props: `delay` (default 0), `glitch` (default false).
- Start state: `opacity: 0; transform: translateY(5%)` (5% of own height).
- After `delay` (+ an extra **60 ms** if `glitch`), transitions to `opacity: 1; translateY(0)` over **220 ms** ease-out (or **180 ms** if `glitch`).
- **Reduced motion:** visible immediately, no transition.

Web: IntersectionObserver not needed — it plays on mount; use a mounted-state class + CSS transition, staggering `delay` across siblings (features stagger reveals with increasing delays).

---

## 9. Platform features used by design-system components → web adaptation

| Feature | Where | Web equivalent |
|---|---|---|
| Haptics (`HapticFeedback.lightImpact/mediumImpact/heavyImpact/selectionClick`) | NeonButton (tap), ToolCard (tap), PageScrollView back-to-top (tap), CodeBlock (success on copy) | **Drop** (or optional `navigator.vibrate()` on supporting mobile browsers). Gated by in-app setting `settings.hapticsEnabled` |
| Clipboard (`Clipboard.setData`) | CodeBlock copy button | `navigator.clipboard.writeText()` |
| System reduce-motion (`MediaQuery.disableAnimations`) | All animated primitives, BootTerminalText, CyberParticles | `@media (prefers-reduced-motion: reduce)` / `matchMedia` |
| Keyboard dismiss on background tap / on scroll-drag | AppBackground, PageScrollView | Drop (or blur active element on outside click) |
| Backdrop blur (`BackdropFilter` 18×18) | GlassCard `blur:true` only | `backdrop-filter: blur(18px)` — keep opt-in for perf |
| Draggable bottom sheet | HowItWorksSheet | Modal panel ~92dvh with internal scroll; drag-resize optional |
| Safe areas (`SafeArea`) | BannerPage | `env(safe-area-inset-*)` padding |
| Font/license bundling (`LicenseRegistry` in `main()`) | fonts | Ship OFL texts in repo; show in an about/licenses page |

Material icons referenced by design-system components: `arrow_upward` (back-to-top), `chevron_right` (ToolCard), `warning_amber_rounded` (QuirkRow), `content_copy` + `check` (CodeBlock). Web: use Material Symbols/Icons font or inline SVGs of the same glyphs.

---

## 10. Persistence / settings dependencies

The design system reads two globally persisted app settings (owned by the settings area, keys listed for cross-reference — stored in SharedPreferences, web: `localStorage`):

- `settings.hapticsEnabled` (bool, default **true**) — gates every haptic call.
- `settings.reduceAnimations` (bool, default **false**) — combined (OR) with the OS reduce-motion flag to disable all design-system animations.

No Drift tables are involved in the design system.

---

## 11. Copy strings owned by the design system (exact)

| String | Where |
|---|---|
| `How it works` | HowItWorksSheet app-bar title |
| `Close` | HowItWorksSheet leading dismiss button |
| `Coarse` | WindowRow left column micro-label |
| `Refine` | WindowRow right column micro-label |
| `▋` (U+258B LEFT FIVE EIGHTHS BLOCK) | BlinkingCursor / BootTerminalText cursor glyph |
| `ESSI//` (prefix) | TransmissionHeader sector code, e.g. `ESSI//347` |
| `> ` (prefix) | TerminalNotes title, e.g. `> hangar.notes` |
| `[NN]` (zero-padded 2-digit index in brackets) | TerminalNotes line indexes |

All other copy (banner labels like `ESSI · Operations Bridge`, sheet contents, notes lines) is supplied by feature screens — see the feature-area specs.

---

## 12. Component → CSS quick reference (summary table)

| Component | Fill | Border | Radius | Shadow/glow | Key type |
|---|---|---|---|---|---|
| GlassCard (default) | `#111E30` | 1px `rgba(122,227,255,.12)` | 14 | none (opt: `0 0 14px rgba(79,195,255,.18)`) | — |
| InfoCard | `rgba(15,28,48,.55)` | 1px `rgba(122,227,255,.12)` | 14 | none | — |
| NeonButton | grad `#4FC3FF→#7AE3FF` (danger `#FF5577→#FFB347`) | 1px `rgba(79,195,255,.45)` | 14 | `0 0 14px` tint@45% | 16/600 `#03060B` |
| CodeBlock | `rgba(3,6,11,.55)` | 1px `rgba(122,227,255,.12)` | 8 | none | mono 11 `#7AE3FF` |
| Copy button | `#03060B` | 1px `rgba(122,227,255,.12)` | 5 | none | icon 11 |
| Back-to-top | `#03060B`, 44×44 circle | 1px `rgba(79,195,255,.6)` | 50% | `0 0 10px rgba(79,195,255,.4)` | icon 22 `#4FC3FF` |
| TransmissionHeader | `#03060B` | 1px bottom `rgba(122,227,255,.12)` | 0 | none | mono 10/600 ls2 uppercase `#4FC3FF` |
| TierRow badge | transparent, 22×22 circle | 0.7px `rgba(79,195,255,.6)` | 50% | none | mono 11/700 `#4FC3FF` |
| HowItWorksSheet | `#03060B` | none | 22 top | overlay scrim | headline title |
