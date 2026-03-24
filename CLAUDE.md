# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WebRTC peer-to-peer video/audio/screen-sharing app with text chat, served over HTTPS with session-based authentication. Uses Express 5, Socket.IO for signaling, and browser-native WebRTC APIs.

## Commands

- **Start server:** `node server.js` (HTTPS on port 3000 by default, configurable via `PORT` env var)
- **Install deps:** `npm install`
- **No test suite or linter configured.**

## Prerequisites

Self-signed SSL certs must exist in the project root (`private.key`, `certificate.pem`). Generate with:
```
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout private.key -out certificate.pem
```

## Architecture

**Server (`server.js`):**
- HTTPS server with Express 5 + Socket.IO
- Session-based auth via `express-session` (in-memory session store)
- Hardcoded user credentials in a `users` object (plaintext passwords, not using the bcrypt dependency)
- Socket.IO middleware enforces session auth on WebSocket connections
- Signaling events: `join-room`, `offer`, `answer`, `ice-candidate`, `chat-message`, `user-stopped-stream`

**Client (`public/`):**
- `login.html` — standalone login page with inline styles/script
- `index.html` — main app page with video elements (`user-1` local, `user-2` remote) and chat UI
- `main.js` — all client WebRTC logic: peer connection setup, ICE candidate exchange, camera/screen-share controls, chat messaging via Socket.IO
- `main.css` — styles for the main page
- Uses Google STUN servers (`stun1/stun2.l.google.com:19302`)

**Signaling flow:** Client joins a hardcoded room (`'main'`), sends offers/answers through Socket.IO, exchanges ICE candidates, and establishes a direct peer connection. Currently supports only two peers.
