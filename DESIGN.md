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

## Component: Rich Text Chat Input

### Input Container
Replaces `<input type="text" id="message-input">`. The container is the border/focus surface — the editable area and action bar live inside it as siblings.

- **Structure:** `contenteditable` div + bottom action bar, wrapped in a single bordered container
- **Sizing:** min-height 1 line (38px); auto-expands to 5 lines; scrolls beyond
- **Focus state:** `border-color: var(--c-accent)` + `box-shadow: 0 0 0 2px var(--c-accent-muted)`
- **Font:** Geist 400 13px (text-sm scale), 1.5 line-height
- **Background:** `var(--c-elevated)` — matches existing input

**Action bar** (inside container, `border-top: 1px solid var(--c-border-subtle)`):
- Left: 😀 emoji button · GIF button (Geist Mono 11px label) · 📎 attach button
- All action buttons: 28×28px, no border, `var(--c-text-secondary)` default, `var(--c-accent)` on hover
- Right: hint text `↵ send · ⇧↵ newline` in `var(--c-text-muted)` · Send button (accent fill, same as current)

**Attachment preview row** (shown only when files are queued, above the editable area):
- 56×56px thumbnails
- Image thumbs: actual preview; file thumbs: file-type label in Geist Mono + accent color
- Each thumb has an ✕ remove button (16×16px, top-right, dark overlay background)

### Floating Formatting Toolbar
Appears above any text selection. Disappears on deselect or click-away. No persistent chrome.

- **Background:** `var(--c-overlay)` (`#2e2e2e`)
- **Border:** `1px solid var(--c-border)` + `box-shadow: 0 4px 16px rgba(0,0,0,0.5)`
- **Border-radius:** `var(--r-sm)` (4px)
- **Caret:** 8×8px rotated square below toolbar pointing to selection
- **Button size:** 28×26px, `var(--c-text-secondary)` default, `var(--c-text)` on hover
- **Active state:** `background: var(--c-accent-muted)`, `color: var(--c-accent)`
- **Button order:** B · I · S̶ · ─── · ` · ≡ · ─── · H · " · 🔗
  - B = bold, I = italic, S̶ = strikethrough, ` = inline code, ≡ = code block, H = highlight, " = blockquote, 🔗 = link

### Message Rendering in Feed
All rendered as HTML in the messages div. Current `<p>` structure is retained; formatting renders inline.

| Format | Element | Style |
|--------|---------|-------|
| Bold | `<strong>` | `font-weight: 700`, inherits text color |
| Italic | `<em>` | `font-style: italic`, color `#c8c8c8` |
| Strikethrough | `<s>` | `text-decoration: line-through`, `var(--c-text-muted)` |
| Highlight | `<mark>` | bg `var(--c-accent-muted)`, color `var(--c-accent)`, padding `1px 3px`, `border-radius: 2px` |
| Inline code | `<code>` | Geist Mono 12px, bg `var(--c-base)`, border `1px solid var(--c-border)`, color `var(--c-accent)`, padding `1px 5px`, `border-radius: 3px` |
| Code block | `<pre><code>` | Geist Mono 12px, bg `var(--c-base)`, border `1px solid var(--c-border)`, `border-radius: var(--r-sm)`, text color `#c8e6c9` (terminal green), lang label top-right in `var(--c-text-muted)` |
| Blockquote | `<blockquote>` | `border-left: 3px solid var(--c-accent)`, bg `var(--c-base)`, `border-radius: 0 3px 3px 0`, italic, `var(--c-text-secondary)` |
| Image | `<img>` | max-width `280px`, max-height `180px`, `border-radius: var(--r-sm)`, `border: 1px solid var(--c-border-subtle)` |
| GIF | `<img>` | Same as image; small `GIF` badge (Geist Mono 9px, overlay bg, accent text) in top-right corner |
| File attachment | custom card | bg `var(--c-base)`, border, file icon + name + size + ghost download button |

### Emoji
Two entry points:

1. **😀 button → picker panel**
   - Library: `emoji-picker-element` (web component, ~12KB, no dependencies)
   - Width: 280px, bg `var(--c-overlay)`, border, `border-radius: var(--r-md)`
   - Layout: search input → category tabs (icon row) → section label → 8-column emoji grid
   - Category tabs: 28×24px icon buttons, 50% opacity default, full opacity + accent-muted bg on active
   - Emoji buttons: 30×30px, scale(1.2) on hover, 80ms transition
   - Max grid height: 200px, overflow-y scroll

2. **`:shortcode:` autocomplete**
   - Trigger: typing `:` followed by at least one character
   - Dropdown: `var(--c-overlay)` bg, border, `var(--r-sm)`, 220px wide
   - Each row: emoji glyph (18px) + `:name:` label (matched chars in accent color)
   - Selected row: `var(--c-accent-muted)` background
   - Navigation: ↑↓ keys, ↵ to insert, Esc to dismiss

### GIF Search
- Trigger: GIF button in action bar
- API: Tenor v2 (free tier, no required branding attribution — unlike GIPHY free tier)
- Panel: same overlay bg + border + shadow as emoji panel
- Layout: search input → masonry/grid of GIF previews
- Clicking a GIF: closes panel, inserts GIF inline in the message being composed

### File Attachment
- Entry: 📎 button OR drag-and-drop anywhere on the chat container OR clipboard paste (images)
- Queued files appear as thumbnails in the attachment preview row above the editable area
- On send: files are uploaded/transferred; messages render the file card or inline image

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+Shift+X` | Strikethrough |
| `` Ctrl+` `` | Inline code |
| `` Ctrl+Shift+` `` | Code block |
| `Ctrl+Shift+H` | Highlight |
| `Ctrl+Shift+B` | Blockquote |
| `Ctrl+K` | Insert link |
| `Enter` | Send message |
| `Shift+Enter` | Line break within message |
| `:name` | Emoji autocomplete trigger |
| `Esc` | Dismiss picker / autocomplete |

### Libraries
- **Rich text engine:** [Tiptap](https://tiptap.dev) — ProseMirror-based, vanilla JS compatible, tree-shakable. Use `@tiptap/core` + individual extension packages.
- **Emoji picker:** [emoji-picker-element](https://github.com/nolanlawson/emoji-picker-element) — web component, ~12KB, fully styleable via CSS custom properties and `::part()` selectors.
- **GIF search:** Tenor API v2 — free tier, no forced GIPHY attribution branding required.

---

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-24 | Initial design system created | Created by /design-consultation — Retro-Futuristic/Industrial aesthetic chosen to match the personal hacker-tool identity. Geist font family for unified sans/mono pairing. Greenyellow accent preserved from existing codebase as signature color. |
| 2026-03-24 | Dark mode as default | Product is a developer/hacker tool — dark mode is the natural default. Light mode supported but secondary. |
| 2026-03-24 | Minimal decoration | Let the content (video streams, chat) dominate. UI should be invisible infrastructure, not decoration. |
| 2026-03-26 | Rich text chat input spec added | Floating toolbar on selection (vs persistent toolbar) chosen to preserve the minimal, tool-like aesthetic. Tiptap over Quill — tree-shakable, actively maintained, better vanilla JS DX. emoji-picker-element over emoji-mart — web component with no React dep. Tenor over GIPHY — free tier without forced attribution branding. Action bar designed as first-class bottom edge of input container, not bolted on. |
