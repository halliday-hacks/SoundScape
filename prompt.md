# SoundSoil — UI Prompt Guide

## Project Identity

**Name:** SoundSoil
**Tagline:** Listen to the Earth. Watch it Grow.
**One-liner:** A real-time environmental soundscape platform that turns neighbourhood audio into a living, pixelated game world — and lets communities explore and share the sounds of any place on Earth.

---

## The Aesthetic Mandate

SoundSoil has a **dual visual identity** — and this contrast is the entire point:

1. **The Pixel Art World** — Retro game canvas (Terraria/Stardew Valley/Celeste). Tile-based, warm, earthy, cozy. Side-scrolling biome that grows and degrades. 16×16 tiles, crispy pixels, gentle sprite animations.
2. **The App Shell** — Clean, modern, minimal UI that _frames_ the pixel world. Think: a museum frame around retro art. The UI should NOT try to be pixelated itself — the contrast between clean modern UI and retro pixel world is intentional and is part of the brand.

**Do not** use watercolour, 3D, or generic "SaaS minimalism" for the pixel canvas. The world is a game, not a dashboard widget.

---

## Color Palette

### Pixel World Palettes (dynamic, shift based on audio state)

| State              | Dominant Tiles               | Palette                                                           |
| ------------------ | ---------------------------- | ----------------------------------------------------------------- |
| Birdsong (healthy) | Trees, birds, lush grass     | Warm greens `#4a7c59`, `#2d5a27`, golden sky `#ffd166`, `#06d6a0` |
| Insects (thriving) | Flowers, butterflies         | Purples `#7b2d8b`, reds `#e63946`, yellows `#f4d35e`              |
| Rain/Wind          | Rain pixels, puddles, clouds | Cool blues `#457b9d`, `#a8dadc`, grey `#adb5bd`                   |
| Traffic (degraded) | Grey tiles, cracks, smog     | Desaturated `#6c757d`, `#495057`, dirty brown `#8d6e63`           |
| Construction       | Dust, rubble, damaged tiles  | Rust `#bc6c25`, ochre `#dda15e`, ash `#ced4da`                    |
| Silence            | Fog tiles, muted world       | Soft mist `#dee2e6`, lavender `#c5b4e3`                           |

### App Shell Palette (modern, consistent, does NOT shift)

- **Background:** `#0f0f0f` (near-black) or `#fafaf9` (off-white) — prefer dark mode as primary
- **Surface:** `#1c1c1e` cards, `#2c2c2e` elevated
- **Brand accent:** Forest green `#22c55e` (healthy earth) + Sky blue `#38bdf8`
- **Text:** `#f4f4f5` primary, `#a1a1aa` secondary/muted
- **Border:** `#27272a`
- **Danger/pollution:** Amber `#f59e0b` → Red `#ef4444` for high traffic scores

---

## Typography

- **UI Shell:** System font stack or `Inter` — clean, readable, no quirks
- **Headings:** Bold, tight tracking. `font-bold tracking-tight`
- **Pixel World Labels / Toasts:** Use a **pixel/monospace font** (e.g. `Press Start 2P`, `VT323`, or `Silkscreen`) ONLY inside or directly adjacent to the pixel canvas. This reinforces the game-world feel.
- **Biodiversity score display:** Large, bold, monospace — treat it like a game score counter

---

## Page Structure & Routes

### `/` — Landing Page (unauthenticated)

The marketing face of SoundSoil. Should immediately communicate:

- What it is (pixel world grows from real sounds)
- The dual aesthetic (pixel art + clean UI)
- Call to action: "Start Listening" → sign up

**Hero section:** Full-width pixel canvas preview (static or animated demo). Show a lush biome on the left, a grey/polluted biome on the right. The split communicates the concept instantly without words.

**Below fold:**

- 3-step explainer: LISTEN → GROW → SHARE
- Map preview teaser
- Tech credibility (on-device ML, real-time, open map)
- Final CTA

### `/dashboard` — Authenticated Home

The main experience hub. Should contain:

- **Pixel World Canvas** — large, centred, live-updating. This is the hero element.
- **Biodiversity Score** — prominent, top-right of canvas or overlay. Displayed like a game HUD element.
- **Current Classification** — small badge showing dominant sound class (e.g. "🐦 Birdsong 78%")
- **Start/Stop Listening** button — primary CTA
- **Recent Events** — timeline of last 10 classifications
- Nav links to Map and Settings

### `/map` — Social Audio Discovery Map

"SoundCloud meets Google Maps"

- Full-viewport Leaflet map (OpenStreetMap tiles)
- Clustered pins coloured by dominant class (green = birds, grey = traffic, blue = rain)
- **Filter pills** row above map: `All` `Birds` `Rain` `City` `Wind` `Insects`
- **Date filter**: Today / This Week / This Month
- **Search bar**: top of map, searches location name, species, or category
- **Sound Card** (appears on pin tap, slides in from right or bottom sheet on mobile):
  - Audio player with waveform visualisation
  - Uploader avatar + name
  - Timestamp, duration, location name
  - AI classification tags (colour-coded pills)
  - Biodiversity score badge
  - Like button (real-time count) + listen count
  - "View Landscape" button → renders pixel art scene for that recording

### `/settings` — User Settings

Minimal. Profile info, notification prefs, account management.

---

## Key UI Components

### PixelCanvas

- `<canvas>` element, `image-rendering: pixelated` (CRITICAL — never blur)
- `width: 1600px` (50 tiles × 16px × 2x scale), `height: 800px` (25 tiles)
- Responsive: scale down with CSS, never re-render at lower resolution
- Rounded corners `rounded-xl`, subtle border `border-2 border-stone-800`
- Dark background behind canvas for letterboxing

### HUD Overlay (on canvas)

Game-style HUD layered over the canvas:

- Top-left: Current sound class icon + confidence bar
- Top-right: Biodiversity score (big number, pixel font)
- Bottom bar: Mini waveform / audio level visualiser

### ClassificationBadge

Pill badge showing dominant audio class. Colour-coded:

- Birds: `bg-green-500/20 text-green-400 border-green-500/30`
- Insects: `bg-purple-500/20 text-purple-400`
- Traffic: `bg-gray-500/20 text-gray-400`
- Rain/Wind: `bg-blue-500/20 text-blue-400`
- Construction: `bg-amber-500/20 text-amber-400`
- Silence: `bg-zinc-500/20 text-zinc-400`

### BiodiversityScore

Large display component. Shows 0–100. Colour shifts:

- 80–100: `text-green-400` (thriving)
- 50–79: `text-yellow-400` (moderate)
- 20–49: `text-amber-500` (stressed)
- 0–19: `text-red-500` (degraded)

Treat it like a health bar in a game. Include a thin progress arc or bar below the number.

### SoundCard (Map popup)

Floating card, elevated shadow `shadow-2xl`. Contains:

- Waveform visualiser (canvas-based, not SVG for performance)
- Audio controls: play/pause, seek, volume
- Metadata row: avatar, name, location pin icon + location name, time ago
- Tag row: classification pills
- Stats row: `♥ 12` likes (real-time), `👁 34` listens
- Action row: Like button, Share button, "View Landscape" button

### MapPin

Custom SVG markers. Circle with icon inside. Colour by dominant class (matches ClassificationBadge colours). Size scales slightly with biodiversity score.

---

## Interactions & Micro-animations

- **Tree growth:** Tile-by-tile reveal upward. 200ms per tile row. No easing needed — pixel art is snappy.
- **Flower bloom:** Scale from 0 → 1 on individual flower tiles, 100ms, `ease-out`
- **Traffic erosion:** Colour transition on tiles, 2s duration, slow and ominous
- **Rain particles:** New tile spawns at top of sky column, moves down 1 tile per frame at 30fps
- **Bird sprite:** Hops between branch tiles. Simple 2-frame walk animation.
- **Pin tap → Sound Card:** Slide in from right (desktop) or slide up from bottom (mobile), 300ms `ease-out`
- **Like button:** Pulse scale animation on tap. Counter increments real-time via Convex subscription.
- **Biodiversity score change:** Number counts up/down with a brief `scale-110` flash

---

## Audio Player (in Sound Card)

- Waveform: draw to `<canvas>` using Web Audio API `AnalyserNode` or pre-computed PCM data
- Seek: click/drag on waveform to seek position
- Controls: large play/pause icon (icon-only, no text label needed)
- Duration display: `MM:SS / MM:SS` monospace font
- Volume: slider, thin and subtle

---

## Map Design Details

- **Base tiles:** OpenStreetMap with a dark/muted style (e.g. CartoDB Dark Matter or Stamen Toner) to let coloured pins pop
- **Cluster bubbles:** Colour = dominant class of most common sound in cluster. Show count.
- **Heatmap layer** (P1): Toggle overlay showing biodiversity density — green to red gradient
- **Viewport query:** Pins refresh on map move (Elastic geo-bounding-box)

---

## Responsive Behaviour

- **Mobile first** for the map and sound card (bottom sheet pattern)
- **Dashboard:** Canvas scales down, HUD elements stack vertically on small screens
- **Landing:** Hero canvas preview uses a static screenshot on mobile, live canvas on desktop
- **Navigation:** Bottom nav bar on mobile, sidebar or top nav on desktop

---

## Accessibility Requirements (non-negotiable for Best Design prize)

- Canvas has `aria-label` describing current world state, updated every classification cycle
- All interactive elements keyboard-navigable with visible focus rings
- Colour-blind safe: never use colour alone to convey state — always pair with icon or label
- Classification badges include text, not just colour
- Audio player has `<audio>` element with native controls as fallback

---

## What NOT To Do

- Do NOT make the app shell look pixelated or retro — only the canvas is pixel art
- Do NOT use drop shadows or gradients on the pixel canvas itself
- Do NOT blur or anti-alias the pixel canvas (always `image-rendering: pixelated`)
- Do NOT use generic chart libraries for the waveform — it should look custom and alive
- Do NOT use stock map marker icons — custom SVG markers only
- Do NOT use default browser audio player styling
- Do NOT overload the dashboard — the pixel world IS the content, keep surrounding UI minimal

---

## Design North Star

> The pixel world should feel like stumbling son a cozy nature game inside a clean, modern app. The contrast is the magic. When birds sing, the world should feel _alive_. When traffic dominates, it should feel _wrong_. The UI shell stays calm and clean throughout — it is the scientist's lab notebook framing a wild, living experiment.

Every design decision should serve this duality.
