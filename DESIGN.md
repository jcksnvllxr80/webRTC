# Design System — WebRTC

## Product Context
- **What this is:** Peer-to-peer video/audio/screen-sharing app with text chat and friends system
- **Who it's for:** Personal use, hacker/developer tool — small group video calls without cloud infrastructure
- **Space/industry:** WebRTC, self-hosted communication tools
- **Project type:** Web app (Electron-capable)

## Aesthetic Direction
- **Direction:** Retro-Futuristic / Industrial
- **Decoration level:** Minimal — typography and color do the work, no decorative flourishes
- **Mood:** Terminal-inspired, utilitarian, hacker-friendly. Feels like a tool built by someone who knows what they're doing — not a consumer product trying to be friendly.
- **Reference sites:** None — designed from first principles for the personal/hacker use case

## Typography
- **Display/Hero:** Geist 800 — geometric, tight letter-spacing (-0.5px to -1.5px), modern but utilitarian
- **Body:** Geist 400 at 15px — clean readability at comfortable size, 1.5-1.65 line-height
- **UI/Labels:** Geist 500-600 — medium weight for buttons, labels, navigation
- **Data/Tables:** Geist with `font-variant-numeric: tabular-nums` — aligned columns for stats and metrics
- **Code:** Geist Mono 400 — same family, consistent with the overall aesthetic
- **Loading:** Google Fonts `https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap`
- **Scale:**
  - xs: 11px — timestamps, fine print
  - sm: 13px — labels, captions, secondary UI
  - base: 15px — body text, messages
  - lg: 18px — section titles, app title
  - xl: 22px — page headings
  - 2xl: 28px — hero text
  - 3xl: 48px — display (if ever needed)

## Color
- **Approach:** Restrained — one accent color does all the heavy lifting against neutral dark surfaces
- **Primary/Accent:** `#adff2f` (greenyellow) — the signature. Used for: active states, focus rings, links, app title, usernames in chat, video borders, primary buttons
- **Accent Hover:** `#98e626` — slightly darker for hover states
- **Accent Muted:** `rgba(173, 255, 47, 0.15)` — ghost button hover, subtle highlights
- **Accent on text:** `#111` — dark text on accent-colored backgrounds (buttons)
- **Neutrals (dark mode):**
  - Base: `#0e0e0e` — deepest background, video areas
  - Surface: `#1a1a1a` — main body background
  - Elevated: `#242424` — cards, panels, inputs
  - Overlay: `#2e2e2e` — dropdowns, tooltips
  - Border: `#333` — primary borders
  - Border Subtle: `#2a2a2a` — dividers, list separators
- **Text (dark mode):**
  - Primary: `#e0e0e0`
  - Secondary: `#999`
  - Muted: `#666`
- **Semantic:**
  - Success: `#28a745`
  - Warning: `#f0ad4e`
  - Error: `#dc3545`
  - Info: `#5bc0de`
- **Light mode strategy:** Invert surfaces to warm off-whites (`#f5f5f0` base, `#ffffff` surface), reduce accent saturation to `#6d9e00` for readable contrast, darken text to `#1a1a1a` primary. Semantic colors darken slightly. Not a primary mode — dark is default.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — not cramped, but not wasteful. Video gets the space, UI is compact.
- **Scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px

## Layout
- **Approach:** Grid-disciplined — predictable alignment, video-dominant hierarchy
- **Grid:** Single-column max-width container
  - Video: `1fr 1.5fr` (local smaller, remote larger)
  - Bottom panel: `220px 1fr` (friends sidebar + chat)
- **Max content width:** 1200px (body), 96vw in enlarged mode
- **Border radius:**
  - sm: 4px — inputs, small buttons, code blocks
  - md: 8px — cards, panels, main buttons
  - lg: 12px — modals, large containers
  - full: 9999px — pills, avatars (if added)
- **Breakpoints:**
  - Desktop: > 900px — full two-column layouts
  - Tablet: ≤ 900px — bottom panel collapses to single column
  - Mobile: ≤ 600px — videos stack, controls wrap, lobby actions stack

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension, nothing decorative
- **Easing:**
  - Enter: `ease-out`
  - Exit: `ease-in`
  - Move: `ease-in-out`
- **Duration:**
  - Micro: 50-100ms — button hover, focus ring
  - Short: 150-250ms — opacity transitions (remote controls fade)
  - Medium: 250-400ms — layout shifts
  - Long: 400-700ms — (not currently used, reserve for future modals)
- **Principle:** If the user can't tell why it's animating, remove it. Every transition should answer "what changed?"

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-24 | Initial design system created | Created by /design-consultation — Retro-Futuristic/Industrial aesthetic chosen to match the personal hacker-tool identity. Geist font family for unified sans/mono pairing. Greenyellow accent preserved from existing codebase as signature color. |
| 2026-03-24 | Dark mode as default | Product is a developer/hacker tool — dark mode is the natural default. Light mode supported but secondary. |
| 2026-03-24 | Minimal decoration | Let the content (video streams, chat) dominate. UI should be invisible infrastructure, not decoration. |
