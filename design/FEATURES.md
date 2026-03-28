# FreeRTC Features

## Video

FreeRTC supports peer-to-peer video calling directly between two participants — no media server in the middle. Video travels over an encrypted WebRTC connection.

**Starting a call:**
- Click **Start Camera** to begin broadcasting your webcam
- If multiple cameras are detected, a picker lets you choose which one to use before starting
- Click **Stop Video** to stop sending your video without affecting the call or incoming video

**Camera controls:**
- A settings panel (⚙️) lets you switch cameras mid-session and adjust supported camera properties (brightness, contrast, saturation, sharpness, zoom, exposure) in real time via sliders
- Your incoming video can be popped out into a floating Picture-in-Picture window using the popout button on the remote video overlay
- The local preview can be minimized to free up space — a restore button appears in the controls bar

**Screen sharing:**
- Click **Share Screen** to share your display or a specific window
- Screen share audio is transmitted alongside the video where supported
- Screen share and camera are independent — you can switch between them without rejoining

---

## Audio

Audio is handled independently from video — you can join audio, share video, or do both in any order.

**Controls:**
- **Join Audio** activates your microphone and connects you to the call
- **Leave Audio** stops your microphone without ending the call or stopping video
- A mute button on the remote video overlay silences incoming audio locally without affecting the other participant's stream

**Audio settings** — accessible via the ⚙️ panel:

| Setting | Default | Effect |
|---------|---------|--------|
| Noise Suppression | On | Filters background noise from your mic |
| Echo Cancellation | On | Prevents your speakers from feeding back into your mic |
| Auto Gain Control | On | Normalizes mic volume automatically |

Changes apply immediately to the live stream with no need to rejoin. Settings persist across sessions via localStorage.

---

## Chat

The in-room chat supports rich text, file attachments, emoji, GIFs, and inline images. Messages are relayed through the server via Socket.IO — they do not travel peer-to-peer.

### Formatting

| Action | How |
|--------|-----|
| Bold | `Ctrl+B` or toolbar |
| Italic | `Ctrl+I` or toolbar |
| Strikethrough | `Ctrl+Shift+X` or toolbar |
| Highlight | `Ctrl+Shift+H` or toolbar |
| Inline code | `` Ctrl+` `` or toolbar |
| Code block | Start a line with ` ``` ` |
| Link | Select text → toolbar → paste URL |
| Send | `Enter` |
| Newline | `Shift+Enter` |

### Emoji

Click 😀 or type `:shortcode:` (e.g. `:wave:`) for inline autocomplete. Use ↑↓ to navigate suggestions and Enter to apply.

### GIF search

Requires a free [GIPHY API key](https://developers.giphy.com) (100 req/hr). Add `giphyApiKey` to `config/secrets.json`.

### Files and images

Click 📎, drag files onto the input, or paste from clipboard. Images are compressed and embedded inline (max 1280px, JPEG). Other files send as downloadable cards. The server enforces a 5 MB limit per file.

### Reactions

Hover any message to reveal a reaction button. Quick reactions (👍 ❤️ 😂 🔥 😮 😢 👎 🎉) appear in a popover; the `···` button opens the full emoji picker. Reactions are tallied per message and cleared when the room empties. Incoming reactions from others play a notification sound.

### Edit and delete

Hover your own messages to reveal ✏️ edit and 🗑 delete buttons. Edited messages are marked with `(edited)`. Both actions are server-verified — the server rejects requests for messages you didn't send.

### Rebuilding the editor

The chat editor (Tiptap, DOMPurify, emoji-picker-element) is pre-bundled at `src/web/public/js/chat-editor.js`. If you modify `src/web/editor-src/index.js`:

```bash
npm run build:editor
```
