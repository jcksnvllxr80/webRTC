# Release Notes

## v0.4.0 — 2026-03-24

### Design System Implementation

- Created `DESIGN.md` — formal design system spec covering aesthetic direction, typography, color, spacing, layout, motion, and border radius scales
- **Typography:** Switched from `system-ui` to Geist (sans) + Geist Mono via Google Fonts across all pages (index, login, register)
- **CSS Custom Properties:** Rewrote `main.css` and `login.css` to use design tokens (`:root` variables) for all colors, fonts, spacing, radii, and motion durations — no more hardcoded values scattered throughout
- **Color refinements:**
  - Accent hover standardized to `#98e626` (was `#a8f03c`)
  - Input/card backgrounds use `--c-elevated` (#242424), video backgrounds use `--c-base` (#0e0e0e) for depth hierarchy
  - Status messages restyled with left-border accent pattern
- **Monospace accents:** Username display, room IDs, resolution selector, and friends panel headers now use Geist Mono for the industrial/terminal feel
- **Motion:** Added `transition` properties to all interactive elements (buttons, inputs, links) using design system duration tokens (80ms micro, 200ms short)
- **Focus states:** Inputs now use `box-shadow` accent ring instead of browser outline for a subtler, consistent focus indicator
- **HTML cleanup:** Set `lang="en"` on all pages, added font preconnect hints, updated page titles (Login/Register now include "— WebRTC")
- Updated `CLAUDE.md` with design system enforcement section
- Marked design consultation TODO as complete in `TODOS.md`

### Online/Offline Friend Status

- Server now tracks connected users via Socket.IO — maintains a `username → Set<socketId>` map
- New `/api/online` endpoint returns array of currently online usernames
- Friends list shows green/grey status dots next to each name — green with glow for online, muted grey for offline
- Real-time updates: `user-online` and `user-offline` Socket.IO events update dots live without polling

### Interaction States

- **Loading feedback on all buttons:** Create Room → "Creating...", Join → "Joining...", Start Camera → "Starting...", Share Screen → "Sharing...", Add Friend → "Adding...", Invite → "Creating...", Remove → "Removing...", Leave → "Leaving..."
- **Active press feedback:** All buttons scale down slightly (97%) on click via `transform: scale(0.97)`
- **Disabled state:** Global `button:disabled` gets `opacity: 0.6` and `cursor: not-allowed`
- **Empty states:** Friends list shows "No friends yet — add someone after joining a call." instead of bare "No friends yet"; chat shows centered italic "No messages yet — say hello!" placeholder that clears on first message
- **Loading state:** Friends list shows "Loading..." while fetching; error state shows "Failed to load friends."
- **Error recovery:** Buttons re-enable and restore original text if an action fails

### First-Use Onboarding

- Lightweight guided tooltip overlay for first-time users (persisted to localStorage)
- **Lobby steps:** Create Room → Join Room → Friends List (3 steps)
- **Call steps:** Start Camera → Share Screen → Copy Link → Chat (4 steps)
- Each step highlights the target element above the overlay with an accent outline
- Skip button to dismiss, Next/Done to advance — counter shows progress (e.g., "2 / 3")
- Only shows once per browser — setting stored as `webrtc-onboarding-done` in localStorage
