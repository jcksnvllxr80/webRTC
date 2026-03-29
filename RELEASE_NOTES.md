# Release Notes

## v0.15.0 — 2026-03-28

### Feat: mic volume slider and VU meter in audio settings

- **Mic Volume** slider (0–200%) in the settings panel; value persists across sessions
- **Input Level** VU meter shows live mic activity so you can confirm the mic is working
- Audio routed through a Web Audio pipeline (GainNode → AnalyserNode → peer connection), enabling real-time volume control without re-negotiating the peer connection

---

## v0.14.4 — 2026-03-29

### Feat: structured logging for Electron desktop client

- Log file written to `%APPDATA%\FreeRTC\freertc.log` (writable in packaged app)
- Four levels: `debug`, `info`, `warn`, `error` — configurable via `logLevel` in `client.json`
- Logs connection attempts, auto-connect results, config saves, window lifecycle, display picker, permission checks, renderer crashes, and uncaught exceptions
- Log file accessible from **Help → Open Log File**
- Log level changeable at runtime from **Help → Log Level** — selection is saved to `client.json` and persists across restarts

---

## v0.14.3 — 2026-03-28

### Fix: Electron server URL not persisting across restarts

- `config/client.json` inside the app bundle is read-only when installed — writes were silently failing
- Server URL is now saved to the OS user data directory (`%APPDATA%\FreeRTC\` on Windows) which is always writable
- Dev mode still seeds the initial URL from `config/client.json` in the project root

---

## v0.14.2 — 2026-03-28

### Fix: browser screen share failing with exact constraints error

- `getDisplayMedia` does not support `exact` constraints — the camera `deviceId` was being passed through and causing a TypeError
- Screen share in the browser now uses resolution-only constraints, stripping the device ID

---

## v0.14.1 — 2026-03-28

### Feat: persist server URL after successful Electron connection

- After manually connecting to a server, the URL is written back to `config/client.json`
- App auto-connects on next launch without showing the connection dialog

---

## v0.13.3 — 2026-03-28

### Fix: disable invite button when friend is already in the room

- Invite button is now disabled with tooltip "Already in the room with you" when a friend is already a participant in the current room
- Prevents redundant invites mid-call

---

## v0.13.2 — 2026-03-28

### Chore: consolidated deployment directory, README cleanup

- Moved `terraform/`, `ansible/`, and `DEPLOYMENT.md` into a single `deployment/` directory to keep infrastructure scripts co-located and out of the project root
- Updated all references: README link and project layout, `.gitignore` paths, and `cd` commands inside `DEPLOYMENT.md`
- Added Ansible and Terraform prerequisites, tool install instructions, IAM setup steps, and domain timing guidance to `DEPLOYMENT.md`
- README deployment section reduced to a short description with a link to `deployment/DEPLOYMENT.md`

---

## v0.13.1 — 2026-03-28

### Chore: GitHub Actions CI/CD, README deployment docs

**GitHub Actions**
- New `.github/workflows/docker.yml` builds and publishes the Docker image to `ghcr.io` on every push to `master`
- PRs trigger a build-only run (no push) to catch broken Dockerfiles before merge
- Uses GHA layer cache for fast repeat builds
- `docker-compose.yml` updated to pull the pre-built image from `ghcr.io` instead of building on the server — faster deploys, no build toolchain needed on EC2

**README**
- Deployment section now covers the full GitHub → ghcr.io → server update flow
- Added note on setting the package to public visibility after first push
- Added note for forks to update the image name in `docker-compose.yml`
- Expanded Terraform and Ansible prerequisites with tool install instructions, IAM setup steps, key pair permissions, and domain timing guidance

---

## v0.13.0 — 2026-03-28

### Feat: full AWS deployment stack, TURN support, Electron auto-connect

**Docker**
- `Dockerfile` builds the Node.js app on Node 22 slim with native module support (bcrypt, better-sqlite3)
- `docker-compose.yml` runs the FreeRTC app and a coturn TURN server together; certs, config, and data are volume-mounted so they persist across rebuilds
- `coturn/turnserver.conf` included as a ready-to-edit template with port range, private IP deny rules, and placeholder for your Elastic IP and credentials

**Terraform**
- `terraform/main.tf` provisions EC2 (Ubuntu 24.04 LTS, t3.micro), security group, and Elastic IP
- AMI resolved dynamically — always picks the latest Ubuntu 24.04 LTS image for the target region
- All required ports opened: 22 (SSH), 80 (certbot), 8001 (app), 3478 TCP+UDP (TURN/STUN), 49152–65535 UDP (TURN relay)

**Ansible**
- `ansible/playbook.yml` fully configures the server from scratch: installs Docker, clones repo, writes secrets, patches coturn config, obtains SSL cert, starts all services
- `inventory.ini.example` and `vars.yml.example` provide fill-in-the-blank templates; both gitignored

**cert.sh**
- New script handles Let's Encrypt certificate creation (`-c <domain>`) and renewal (`-r`)
- `-e <email>` enables non-interactive mode for use with Ansible
- `-v` for verbose output
- Renewal auto-detects domain from existing cert and restarts FreeRTC automatically

**TURN server config**
- TURN credentials served from the server via `/api/rtc-config` — never bundled into client JS
- `config/server.json` now includes `turnUrl`, `turnUser`, `turnCredential` fields
- Client fetches ICE server config at startup and falls back to STUN-only if unavailable

**Electron auto-connect**
- New `config/client.json` holds the server URL — set it before building and the app connects on launch with no prompt
- Connection dialog only appears when the URL is missing or the connection fails
- Connection window simplified to a single URL field (was separate IP + port inputs)

**README**
- Overhauled to reflect AWS as the primary deployment path
- Covers full Terraform → Ansible workflow, cert.sh usage, browser and desktop client connection

---

## v0.12.1 — 2026-03-28

### Fix: camera picker modal, draggable settings panel, audio settings restored

**Camera picker rework**
- Replaced the small floating tooltip with a proper centered modal: dark overlay with blur, animated card, full-width camera buttons with icon and label, ✕ close button, Cancel button, and click-backdrop-to-dismiss

**Draggable settings panel**
- Settings panel is now a `position: fixed` floating panel — no longer anchored above the gear button where it could be clipped off-screen
- Drag handle at the top lets you move it anywhere on screen; position is saved to `localStorage` and restored on next open
- Opens to the bottom-right corner by default when no saved position exists
- `max-height` + `overflow-y: auto` ensures it never goes off-screen regardless of content length
- ✕ close button in the drag handle; Escape key still works

**Audio settings restored**
- Audio section (Microphone, Noise Suppression, Echo Cancellation, Auto Gain Control) was being hidden by the panel going off the top of the viewport; fixed by the panel position rework above

---

## v0.12.0 — 2026-03-28

### Feat: video embeds, camera selection, device properties, paste fix, link font

**Video link embedding**
- YouTube (`youtube.com`, `youtu.be`) and Vimeo links sent in chat auto-render as embedded iframes below the link
- Uses `youtube-nocookie.com` for YouTube privacy; embeds are lazy-loaded at 16:9 aspect ratio

**Camera source selection**
- Settings panel (⚙️) now includes a Camera dropdown — pick from any connected camera before or between streams
- Also includes a Microphone dropdown for selecting the active input device
- Dropdowns populate on load and refresh with device labels after permissions are granted
- `devicechange` events keep the list current if you plug/unplug a device mid-session

**Camera picker on Start Camera**
- Clicking "Start Camera" now shows an inline popup listing all available cameras when more than one is detected — click to choose and start
- Single-camera machines skip the picker and start immediately

**Live camera property sliders**
- After starting the camera, a "Camera Properties" section appears in the settings panel with sliders for any device-supported properties: brightness, contrast, saturation, sharpness, zoom, exposure time
- Changes apply live via `track.applyConstraints()` with no need to restart the stream
- Section is hidden automatically if the browser or device exposes no adjustable properties

**Fix: text paste broken in chat**
- Plain text paste was being swallowed by the async Clipboard API fallback — it called `event.preventDefault()` before confirming an image was found, blocking all text paste
- Fixed: the fallback now checks for `text/plain` / `text/html` in `clipboardData.items` first and skips the async path if text content is present

**Fix: chat link font size**
- Links in chat messages are now rendered 1px larger (14px vs the inherited 13px body text) for easier tap/click targets

---

## v0.11.3 — 2026-03-27

### Fix: invite button not updating when friend comes online

- Invite button disabled state was only set at render time — if a friend came online after the list rendered, the button stayed greyed out
- Invite buttons now update in real-time alongside status dots when `user-online` / `user-offline` events arrive

---

## v0.11.2 — 2026-03-27

### Fix: invite button incorrectly disabled for online friends

- Online status was not yet loaded when the friends list rendered, causing all invite buttons to appear disabled even for online users
- Friends list now renders after the online users fetch completes so invite button state is accurate

---

## v0.11.1 — 2026-03-27

### Fix: invite rules, reaction sound, screenshot in chat

**Invite button**
- Invite button only appears when you are in a room — not in the lobby
- Disabled and titled "User is offline" when the friend is not currently logged in

**Reaction sound**
- Incoming reactions from other users now play the receive sound
- No sound when you react to a message yourself

**Screenshot / inline image in chat**
- Images are now compressed via canvas (max 1280px, JPEG 0.82) before being embedded — keeps payloads small and consistent across screen sizes
- Socket.IO `maxHttpBufferSize` raised to 10MB and server HTML slice limit raised to 5MB so large screenshots are no longer silently dropped

---

## v0.11.0 — 2026-03-27

### Feat: room invites, connection status, stop video fix, macOS name fix

**Room invites**
- Invite button on the friends list now sends a direct invite when you're already in a room — no link copying required
- Recipient receives a toast notification (bottom-right, auto-dismisses after 12s) with a Join button
- Bell icon in the header shows an unread badge; clicking opens a panel of recent invites (up to 10) with Join and dismiss per item
- Out of a room, Invite still creates a new room and copies the link to the clipboard

**Connection status**
- Remote video area shows "Waiting for other participant…" when you're alone in the room
- Shows "Connection lost — reconnecting…" or "Connection failed — retrying…" on ICE failure
- Clears automatically when the peer connects

**Stop video fix**
- Stopping your video or leaving audio no longer tears down the peer connection (and clears incoming video) when the remote peer is still in the room

**macOS name fix**
- App name in the macOS dock and menu bar now correctly shows "FreeRTC" instead of "Electron"

---

## v0.10.3 — 2026-03-27

### Fix: icon, header cleanup, help menu, minimize button

- App icon now loads from `src/web/public/icon.png/.ico/.icns` — served by the web server and referenced by Electron at runtime and build time
- macOS dock icon fixed via `app.dock.setIcon()`
- Removed logo and title from the app header — already present in the OS title bar
- Help menu moved to the native menu bar (alongside Connection and Edit) with version number, Documentation, and GitHub Repository links
- Local video minimize button moved back to the left side of the preview

---

## v0.10.2 — 2026-03-27

### Feat: help menu and configurable server port

- Help menu (`?` button in the header) shows the app version, a link to the documentation, and a link to the GitHub repository
- Version is fetched live from a new `/api/version` endpoint so it always reflects the running build
- Server port can now be set via CLI argument (`--port=8080`), in addition to the existing `PORT` env var and `config/server.json` — arg takes highest priority

---

## v0.10.1 — 2026-03-27

### Chore: app icon and license

- Added non-commercial license — free to use, modify, and distribute; selling or charging for access is prohibited
- Added white placeholder app icon (`favicon.svg`) shown in browser tabs and the app header
- Favicon linked in all pages (index, login, register)
- Electron taskbar and window title bar now show the icon; falls back to a white placeholder until `src/web/public/icon.png` is provided
- electron-builder configured to pick up `icon.png/.ico/.icns` from `src/web/public/` for all platforms

---

## v0.10.0 — 2026-03-27

### Chore: rebrand to FreeRTC

- Renamed app from "WebRTC" to "FreeRTC" across all user-facing surfaces: page titles, header, desktop window title, Electron `productName`, and `package.json` name/description

---

## v0.9.2 — 2026-03-27

### Feat: screen share audio, remote mute, local preview minimize, PiP popout

**Screen share audio**
- Screen share now transmits audio to the remote peer — browser captures system/tab audio via `getDisplayMedia`; Electron tries `chromeMediaSource: 'desktop'` audio and silently falls back to video-only if the platform doesn't support it
- Mic and screen audio coexist as independent tracks; `ontrack` handler updated to only replace stale video tracks, not active audio tracks — mic is no longer silenced when screen audio arrives
- Screen audio sender is tracked in `state.screenAudioSender` and removed cleanly when screen share stops

**Remote audio mute**
- Mute button (speaker icon) added to the remote video overlay controls — toggles local playback of all remote audio (mic + screen audio) without affecting their outgoing stream
- Icon switches to a muted-speaker when active; button title and aria-label update accordingly

**Local preview minimize / restore**
- Minimize button (chevron) on the local video overlay collapses the preview to give more space to chat; a "Preview" restore button appears in the controls bar
- State persists across page reloads via localStorage

**Remote video PiP popout**
- Popout button on the remote video overlay opens the incoming stream in a floating Picture-in-Picture window
- Button icon and title reflect current PiP state; button hidden automatically on browsers that don't support PiP

---

## v0.9.1 — 2026-03-27

### Fix: camera/screen share error, frozen remote video, resize bleed-through

**Camera / screen share**
- Fixed "InvalidAccessError: A sender already exists for the track" on every camera/screen start — `state.localStream` was assigned before `ensurePeerConnection()` ran, so a newly created peer connection would add the track, then `addVideoTrack()` tried to add it again; fixed by nulling `state.localStream` first so the PC starts clean, then adding the track once explicitly
- Because the error threw before `state.media.video = true` was set, `broadcastMediaState()` never ran and the button stayed on "Start Camera" — this is also fixed by the above

**Frozen remote video on stop**
- Replaced unreliable WebRTC `mute` event listener with the `participant-updated` socket signal — when the remote peer stops video/screen, `broadcastMediaState()` fires immediately and the `participant-updated` handler now clears the remote video element; no dependency on browser track events

**Resize handle**
- Video section now uses `overflow: hidden` to clip video content when the handle is dragged up — videos stay underneath the panel instead of bleeding through
- Removed `height: 100%; object-fit: cover` from `.video-player` and `flex: 1; align-items: stretch` from `#videos` — these caused the video grid to collapse or display at wrong proportions

---

## v0.9.0 — 2026-03-26

### Fix: video/chat split resize bug (video bleed-through)

- Resizer handle now clamps the video section between a sensible minimum and maximum based on available room UI height
- `#video-section` now uses `overflow: hidden` and `#videos` uses `min-height: 0` with `minmax(0, ...)` grid columns so remote/local video is clipped and never overlays the bottom panel
- Fixed PiP preview sizing so it remains independent of the splitter rule

---

## v0.8.9 — 2026-03-26

### Fix: peer lifecycle, remote video on restart, desktop connection UX

**Peer connection lifecycle**
- Peer connection is now torn down when the remote participant leaves the room, so rejoining always starts a clean negotiation instead of reusing a stale/failed connection
- `createOffer()` guarded by `makingOffer` flag to prevent race with `onnegotiationneeded` — eliminates a source of video freezing when both sides try to renegotiate simultaneously
- All `addIceCandidate` calls wrapped in try/catch so stale candidates from a previous session no longer crash the ICE handler
- `reapplyAudioSettings` now guards against a race with `leaveAudio` — prevents a ghost microphone staying active after the user leaves audio
- `user-stopped-stream` handler fixed: `data-sender-id` attribute was never set so remote video was never cleared; now clears unconditionally

**Remote video after stop/restart**
- Stopping a stream and restarting it now correctly shows on the remote side — `user-stopped-stream` was clearing `srcObject` but leaving `state.remoteStream` intact, so incoming tracks from the restart were invisible
- Stale ended tracks no longer accumulate in `state.remoteStream`; incoming tracks replace old ones of the same kind

**Desktop connection window**
- Inputs and button are disabled while a connection attempt is in progress, preventing double-submit
- Inputs are always re-enabled after a failed attempt (previously they could get stuck non-interactive)
- Error shown inline instead of `alert()` — the native alert was dropping focus after dismissal, making fields appear unresponsive
- IP field is auto-focused and selected on error for quick retry

---

## v0.8.8 — 2026-03-26

### Fix: WebRTC stability, audio filters, screenshot paste, image lightbox

**WebRTC stability**
- ICE connection monitoring: automatically calls `restartIce()` on failure, and after 3 seconds of sustained disconnect
- Fixed negotiation glare: `onnegotiationneeded` now uses a `makingOffer` guard and the modern `setLocalDescription()` (implicit offer) to prevent double-offer races
- `closePeerConnection` now resets `pendingCandidates` and `makingOffer` so stale state from a previous session cannot pollute a new connection
- Answer handler now checks `signalingState === 'have-local-offer'` (correct guard) and drains the ICE candidate buffer immediately after setting the remote description

**Audio filters**
- Fixed audio filter toggles (noise suppression, echo cancellation, AGC) doing nothing — `applyConstraints` cannot change capture-time constraints in Chrome/Electron; now acquires a new stream with the updated constraints first, `replaceTrack`s the sender while both tracks are live (no gap), updates the stream reference, then stops the old track — eliminates both the static burst and the silent gap

**Screenshot paste**
- Clipboard paste now uses a 3-level fallback: `clipboardData.items` → `clipboardData.files` → async `navigator.clipboard.read()` — covers the range of Electron builds that put screenshots in different places
- Added document-level paste listener so screenshots paste into the chat even when the editor doesn't have focus

**Image lightbox**
- Clicking any inline chat image opens it in a full-screen lightbox overlay
- Click outside or press Escape to dismiss

---

## v0.8.7 — 2026-03-26

### Fix: audio static and layout improvements

- Fixed audio static when toggling noise suppression / echo cancellation / AGC — now uses `applyConstraints` on the live track instead of stopping and replacing it, eliminating the interruption that caused static
- Draggable resize handle between video section and chat panel; position saved to localStorage
- Bottom panel has a minimum height so the main scroll area always reaches it
- SVG icons for edit/delete buttons inherit theme color correctly

---

## v0.8.6 — 2026-03-26

### Fix: UI polish and scrolling edge cases

- Edit/delete buttons now use SVG icons that inherit theme color; delete turns red on hover
- Themed scrollbars across the app (dark track, muted thumb, accent on hover)
- Main call area now scrolls when large images push the bottom panel out of view
- Fixed `#call-ui` being shown as `display:block` instead of `display:flex`, which broke the entire scroll constraint chain

---

## v0.8.5 — 2026-03-26

### Fix: layout, scrolling, and edit UX

- Page no longer scrolls; only the chat messages area scrolls
- Fixed scrollbar not appearing in messages when content overflowed — root cause was CSS Grid blocking height propagation; bottom panel converted to flexbox
- GIF/image preview shown above textarea when editing a message that contains one
- `(edited)` marker no longer accumulates on repeated edits
- Electron default window height increased to 960px

---

## v0.8.4 — 2026-03-26

### Fix: GIFs preserved when editing messages

- Editing a message that contained a GIF or inline image no longer drops the image
- Images are captured before the edit textarea opens, re-sent alongside the edited text, and reattached by the server when broadcasting the update

---

## v0.8.3 — 2026-03-26

### Edit & Delete Messages

- Hover your own messages to reveal ✏️ edit and 🗑 delete buttons
- Edit opens an inline textarea pre-filled with the message text; `Enter` saves, `Shift+Enter` newlines, `Esc` cancels
- Edited messages are marked with `(edited)`
- Delete removes the message from all participants' views immediately
- Both actions are server-verified — the server rejects requests for messages you didn't send

**Secrets config**
- API keys no longer go in `config/server.json` — create `config/secrets.json` (gitignored) and put keys there
- Server merges `secrets.json` over `server.json` at startup; `server.json` stays clean and committed

---

## v0.8.2 — 2026-03-26

### Chat Enhancements: Reactions, GIF Search, Code Block Improvements

**Emoji reaction picker**
- Hover any message to reveal a 😊 trigger button
- Hovering it opens a pill-shaped popover with 8 quick reactions: 👍 ❤️ 😂 🔥 😮 😢 👎 🎉
- The `···` button opens the full searchable emoji picker to choose any reaction
- Reactions appear as pills below the message with a count; click a pill to toggle your reaction
- Your own reactions are accent-highlighted; works on your own messages and others'
- Reactions are tracked per-room in server memory, cleared when the room empties

**GIF search**
- GIF button opens a live search panel powered by GIPHY
- Trending GIFs load on open; type to search with 400ms debounce
- 3-column animated preview grid; click any GIF to insert it inline into the composer
- API key proxied server-side — never exposed to the client
- Config: set `"giphyApiKey"` in `config/server.json` (free key at developers.giphy.com)
- Tenor replaced — closed new registrations January 2026, shutting down June 2026

**Code block improvements**
- `Enter` inside a code block adds a new line instead of submitting the message
- Exit by pressing `Enter` on the last empty line; no line limit
- Syntax highlighting persists in the message feed (re-applied after render)

---

## v0.8.1 — 2026-03-26

### Message Likes & Syntax-Highlighted Code Blocks

**Message reactions**
- 👍 button appears on hover for every message (including your own)
- Click to like; click again to unlike (toggle)
- Button stays visible with a count badge when anyone has liked the message
- Turns accent-colored when the current user has liked it
- Reactions are tracked per-room in server memory and cleared when the room empties

**Syntax-highlighted code blocks**
- Type ` ```python ` (or any supported language) at the start of a line to create a highlighted code block
- Supported languages: `python`/`py`, `javascript`/`js`, `typescript`/`ts`, `bash`/`sh`/`shell`, `json`, `sql`, `html`/`xml`, `css`, `go`, `rust`, `java`, `cpp`/`c`
- Syntax colors use a VS Code Dark+ palette — highlights carry through to received messages
- A faint language label appears above the code block in both the composer and the message feed

---

## v0.8.0 — 2026-03-26

### Rich Text Chat Editor

Chat now supports full rich text authoring, file attachments, emoji, and inline images.

**Composer**
- `contenteditable` input powered by [Tiptap](https://tiptap.dev/) (ProseMirror-based) — no `<textarea>`, supports structured content
- **↵** sends, **⇧↵** inserts a newline
- Auto-grows up to ~5 lines before scrolling; collapses back after send

**Inline formatting**
- Floating selection toolbar appears on text selection: **Bold**, _Italic_, ~~Strikethrough~~, ==Highlight==, `Inline Code`, and Link insertion
- Keyboard shortcuts work too: `Ctrl+B`, `Ctrl+I`, `Ctrl+Shift+X` (strikethrough), `Ctrl+Shift+H` (highlight), `` Ctrl+` `` (inline code)
- Fenced code blocks render with monospace font and a subtle border

**Emoji**
- 😀 button opens a full emoji picker panel (web component — searchable, categorized)
- `:shortcode:` autocomplete: type `:` followed by a name (e.g., `:wave`) to get an inline suggestion dropdown; **↑↓** to navigate, **Enter** to apply, **Esc** to dismiss

**GIF**
- GIF button is present; search requires a GIPHY API key in `config/server.json → "giphyApiKey"` (free key at developers.giphy.com — Tenor discontinued Jan 2026)

**File & image attachments**
- 📎 button opens a file picker; drag-and-drop and paste also work
- Images are embedded inline in the composer and sent as base64 (≤ ~5 MB)
- Non-image files show a thumbnail strip above the input; click × to remove before sending
- Received files appear as downloadable cards in the message feed

**Message rendering**
- All rich formatting (bold, italic, code blocks, blockquotes, lists, links, inline images) renders in the message feed
- Incoming HTML is sanitized with DOMPurify before insertion — `data:` image URIs are preserved
- File messages render as a file card with icon, name, size, and a download link

**Libraries added**
- `@tiptap/starter-kit`, `@tiptap/extension-highlight`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extension-placeholder` — editor core
- `emoji-picker-element` — emoji picker web component
- `dompurify` — HTML sanitization for received messages
- `esbuild` (devDependency) — bundles the editor source into `public/js/chat-editor.js`

---

## v0.7.0 — 2026-03-25

### Audio Settings Menu

- New gear icon in the controls bar opens a settings dropdown panel
- Three toggle switches: Noise Suppression, Echo Cancellation, Auto Gain Control — all on by default
- Toggles apply immediately to live audio via `RTCRtpSender.replaceTrack()` — no need to rejoin
- Settings persist to localStorage across sessions
- Panel dismisses on click outside or Escape key
- Toggle reverts with inline error if mic re-acquisition fails
- Custom CSS toggle switch component aligned with DESIGN.md tokens

---

## v0.6.1 — 2026-03-25

### Independent Media Controls

- Audio, video, and screen share are now fully independent — no need to join audio before sharing video or screen
- Each can be started and stopped independently in any order
- Peer connection is created on demand when any media is started, and torn down when all media is stopped

---

## v0.6.0 — 2026-03-25

### Participant List & Media Joining

Users now join rooms in chat-only mode and can independently opt into audio, video, and screen sharing.

**Participant List**
- Room displays a live participant list showing everyone currently in the room
- Each participant has a colored dot indicating their media state: grey (chat), green (audio), blue (video/screen)
- Updates in real-time as users join, leave, or change media state

**Media Controls**
- **Chat-only** (default): users enter the room with text chat — "Join Audio", "Start Camera", and "Share Screen" are all available
- Audio, video, and screen share are independent — start any combination
- "Leave Audio" stops the mic; "Stop Video" stops the camera/screen; peer connection closes when all media is stopped

**Server**
- New `rooms` Map tracks room membership and per-user media state (`{ audio, video, screen }` booleans)
- `media-state-change` event for clients to broadcast their current media flags
- `room-participants` and `participant-updated` events keep all clients in sync
- 2-person room limit enforced on join

**WebRTC Refactor**
- Peer connection creation decoupled from offer — new `ensurePeerConnection()` helper
- `negotiationneeded` event handler for automatic renegotiation when tracks are added/removed
- ICE candidate buffering for candidates arriving before remote description is set
- New `addVideoTrack()`, `removeVideoTracks()`, `closePeerConnection()` exports

---

## v0.5.2 — 2026-03-25

- Expanded Electron build documentation in README with platform-specific targets, cross-compilation commands, and output paths
- Added note about `npm audit` warnings being build-time only (from `electron-builder` dev dependencies)

---

## v0.5.1 — 2026-03-25

fix a few mugs during e2e tests

---

## v0.5.0 — 2026-03-25

### implement three features:

  1. Online/Offline Friend Status
  - Server (src/server/index.js): Tracks connected users in an onlineUsers Map, emits user-online/user-offline events, exposes /api/online endpoint
  - Client (friends.js): Fetches online users on load, listens for real-time status changes, renders green (glowing) / grey dots next to each friend name
  - CSS: .status-dot.online with green + box-shadow glow, .status-dot.offline in muted grey

  2. Interaction States

  - Loading text on every async button (Create Room → "Creating...", Start Camera → "Starting...", etc.)
  - Disabled state while loading (opacity: 0.6, cursor: not-allowed)
  - Active press feedback: transform: scale(0.97) on click
  - Empty states: friends list shows helpful message, chat shows centered italic placeholder that clears on first message
  - Error recovery: buttons re-enable and restore text on failure

  3. First-Use Onboarding

  - New onboarding.js module with a tooltip overlay walkthrough
  - 3 lobby steps (create room, join room, friends) or 4 call steps (camera, screen share, copy link, chat)
  - Highlights the target element above a semi-transparent overlay
  - Skip/Next/Done buttons with step counter
  - Persists to localStorage so it only shows once per browser

---

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
