# FreeRTC System Architecture

> Companion document for `architecture-diagram.excalidraw`.
> Open the diagram in [excalidraw.com](https://excalidraw.com) or the VS Code Excalidraw extension.

---

## High-Level Overview

FreeRTC is a peer-to-peer video, audio, and screen-sharing application with rich text chat. Media flows directly between users via WebRTC; the server's only role at runtime is signaling (exchanging connection metadata) and lightweight application state (auth, friends, chat relay). The system is deployed to a single AWS EC2 instance using infrastructure-as-code (Terraform + Ansible) and a CI/CD pipeline (GitHub Actions + GitHub Container Registry).

### Clients

Users can connect in two ways:

- **Browser** — Any modern browser (Chrome, Firefox, Edge, Safari). No install required; navigate to the server URL.
- **Electron Desktop App** — Standalone desktop application for Windows, macOS, and Linux. Connects to the same server and provides native features like system audio capture and display source picking via Electron APIs.

Both clients run identical WebRTC, chat, and UI code. The Electron app wraps the web client in a native window and adds a preload bridge (`window.electronAPI`) for desktop-specific capabilities.

---

## Runtime Architecture (How a Call Works)

### 1. Authentication

1. User opens `https://<server>:8001` in a browser or the Electron app.
2. Submits credentials to `POST /login` (or registers via `POST /register`).
3. Server verifies the bcrypt-hashed password against SQLite and sets an `express-session` cookie (24-hour expiry).
4. All subsequent HTTP requests and Socket.IO connections are gated by session middleware.

### 2. Room Creation and Joining

1. User clicks "Create Room" (`POST /api/rooms`) — server generates a random 8-hex-character room ID.
2. User is redirected to `/room/<roomId>`. The client emits a `join-room` Socket.IO event.
3. Server tracks rooms in memory: `Map<roomId, Map<socketId, { username, media }>>`. Max 2 participants per room.
4. When a second user joins, the server broadcasts `room-participants` and `user-connected` events to both peers.

### 3. WebRTC Signaling (via Socket.IO)

FreeRTC uses **two independent peer connections** per call:

| Connection | Purpose | Tracks | Events |
|---|---|---|---|
| **Voice PC** | Microphone audio | 1 audio track (processed through Web Audio API) | `voice-offer`, `voice-answer`, `voice-ice` |
| **Video PC** | Camera, screen share, system audio | 1-2 video/audio tracks | `video-offer`, `video-answer`, `video-ice` |

Separating voice and video means stopping your camera never interrupts audio, and each connection can be independently renegotiated or restarted.

**Signaling flow:**

```
User A                       Server                      User B
  |                            |                            |
  |--- voice-offer ----------->|--- voice-offer ----------->|
  |                            |                            |
  |<-- voice-answer -----------|<-- voice-answer ------------|
  |                            |                            |
  |--- voice-ice ------------->|--- voice-ice -------------->|
  |<-- voice-ice --------------|<-- voice-ice ---------------|
  |                            |                            |
  |<========== Direct P2P Audio (WebRTC) ==================>|
```

The same flow happens independently for video when a user starts their camera or screen share.

### 4. ICE Candidate Exchange and NAT Traversal

Clients fetch ICE server configuration from `GET /api/rtc-config` on page load:

- **STUN servers** (always): `stun1.l.google.com:19302`, `stun2.l.google.com:19302` — used to discover the client's public IP and port mapping.
- **TURN server** (if configured): `turn:<elastic-ip>:3478` with long-term credentials — relays media when direct P2P is impossible (e.g., symmetric NAT).

ICE candidates are exchanged through Socket.IO. Each peer connection buffers incoming candidates until the remote SDP description is set, then drains the queue.

### 5. Media Streams (Peer-to-Peer)

Once ICE negotiation completes, media flows **directly between the two users** — the server is not in the media path (unless TURN relay is needed as a fallback).

**Audio pipeline (Web Audio API):**

```
Microphone (getUserMedia)
    |
MediaStreamSource
    |
GainNode (mic volume control)
    |
AnalyserNode (VU meter)
    |
AudioDestination
    |
addTrack(voicePC)  -->  sent to remote peer
```

Audio settings (noise suppression, echo cancellation, auto gain control) are applied as `getUserMedia` constraints and can be toggled live — the pipeline swaps the source node without interrupting the stream.

**Video track replacement:** When switching between camera and screen share, `RTCRtpSender.replaceTrack()` swaps the track in-place on the existing Video PC, avoiding a full renegotiation.

### 6. Chat

Chat messages are relayed through Socket.IO (not through WebRTC data channels). The rich text editor is Tiptap-based and supports:

- Bold, italic, strikethrough, code blocks, blockquotes, highlights, links
- Emoji picker (emoji-picker-element web component) and `:shortcode:` syntax
- GIF search (GIPHY API, proxied through the server)
- File and image attachments (up to 7 MB, base64-encoded)
- Message editing, deletion, and emoji reactions (all verified server-side for ownership)

### 7. Friends and Presence

- `GET /api/friends` returns the friend list; online status is pushed in real-time via `user-online`/`user-offline` Socket.IO events.
- Online friends can be invited to a room. The invitation appears as a toast notification and is stored in a bell-icon panel (last 10 invites).
- Participants in a call can add each other as friends directly from the participant list.

---

## AWS Infrastructure

### Provisioned Resources (Terraform)

| Resource | Details |
|---|---|
| **EC2 Instance** | `t3.micro` (Free Tier eligible), Ubuntu 24.04 LTS, 8 GB gp3 EBS |
| **Elastic IP** | Static public IP bound to the instance |
| **Security Group** | Ingress: SSH (22), HTTP (80 — Let's Encrypt), App (8001), TURN/STUN (3478 TCP+UDP), Media relay (49152-65535 UDP). Egress: all. |
| **Key Pair** | Pre-existing EC2 key pair for SSH access |

Configuration lives in `deployment/terraform/`. Run from Windows PowerShell:

```powershell
cd deployment/terraform
cp terraform.tfvars.example terraform.tfvars   # edit key_name, region
terraform init && terraform apply
# outputs: public_ip, ssh_command
```

### Server Configuration (Ansible)

Ansible runs from WSL2 (or any Linux host) and performs the full server setup in a single playbook (`deployment/ansible/playbook.yml`):

1. Installs Docker via `get.docker.com`
2. Clones the FreeRTC repo to `/opt/freertc`
3. Copies `config/secrets.json` (TURN credentials, GIPHY API key)
4. Patches `coturn/turnserver.conf` with the Elastic IP and TURN credentials
5. Obtains a Let's Encrypt SSL certificate via `cert.sh` (standalone HTTP-01 validation)
6. Pulls Docker images and starts services with `docker compose up -d`

```bash
cd deployment/ansible
cp inventory.ini.example inventory.ini   # edit IP, SSH key path
cp vars.yml.example vars.yml             # edit domain, public_ip, email
ansible-playbook -i inventory.ini playbook.yml
```

### Docker Compose Services

Two containers orchestrated via `docker-compose.yml`:

**freertc** — The application server:
- Image: `ghcr.io/jcksnvllxr80/freertc:latest`
- Port: 8001
- Volumes: `certs/` (read-only), `config/` (read-only), `data/` (persistent SQLite DB)

**coturn** — The TURN/STUN relay:
- Image: `coturn/coturn:latest`
- Network mode: `host` (for UDP relay performance)
- Volume: `coturn/turnserver.conf` (read-only)
- Ports: 3478 (TURN/STUN), 49152-65535 (media relay range)
- Security: blocks private IP relay (RFC 1918), no multicast, long-term credential auth with DTLS fingerprint

### SSL Certificates

`cert.sh` wraps certbot for Let's Encrypt certificate management:

- **Create:** `./cert.sh -c <domain> -e <email>` — standalone HTTP-01 validation on port 80
- **Renew:** `./cert.sh -r` — renews and restarts the freertc container automatically
- Certificates valid 90 days. Recommended cron: `0 0 * * * /opt/freertc/cert.sh -r`
- Free domain option: use `<elastic-ip>.nip.io` (wildcard DNS that resolves any IP)

---

## CI/CD Pipeline

### GitHub Actions Workflow (`.github/workflows/docker.yml`)

Triggered on every push or PR to `master`:

```
Developer pushes to master
        |
        v
GitHub Actions runner (ubuntu-latest)
        |
        |-- Read version from package.json
        |-- Create git tag (vX.X.X) if push
        |-- Log in to GitHub Container Registry
        |-- Build Docker image (with layer caching)
        |-- Tag: latest, vX.X.X, sha-<commit>
        |-- Push to ghcr.io (push only, not on PR)
        |
        v
ghcr.io/jcksnvllxr80/freertc:latest
```

- PRs build and cache but do not push (validation only).
- Tags are idempotent — existing tags are silently skipped.

### Deploying a New Version

After CI pushes a new image, SSH into the server (or run Ansible again):

```bash
cd /opt/freertc
docker compose pull && docker compose up -d
```

This pulls the latest image and recreates the container with zero-downtime restart.

---

## Configuration Files

| File | Purpose | Gitignored? |
|---|---|---|
| `config/server.json` | Server port (default 8001) | No |
| `config/secrets.json` | TURN credentials, GIPHY API key | Yes |
| `config/client.json` | Electron app server URL, log level | No |
| `coturn/turnserver.conf` | TURN relay config (patched by Ansible) | No |
| `deployment/terraform/terraform.tfvars` | AWS region, key pair, instance type | Yes |
| `deployment/ansible/vars.yml` | Domain, public IP, Let's Encrypt email | Yes |
| `deployment/ansible/inventory.ini` | Ansible host + SSH key | Yes |

### secrets.json Structure

```json
{
  "turnUrl": "turn:<elastic-ip>:3478",
  "turnUser": "freertc",
  "turnCredential": "<strong-password>",
  "giphyApiKey": "<optional>"
}
```

The TURN credentials are sent to clients via `/api/rtc-config` — this is a WebRTC architecture requirement (clients need them to authenticate with the TURN server).

---

## Database

SQLite via `better-sqlite3`, stored at `data/users.db` with WAL mode enabled for concurrency.

| Table | Columns | Notes |
|---|---|---|
| `users` | `id`, `username` (unique), `password` (bcrypt, 10 rounds), `created_at` | Registration and login |
| `friends` | `id`, `username`, `friend_username`, `added_at` | Unique constraint on pair |

The database is volume-mounted (`./data:/app/data`) and persists across container restarts.

---

## Network Flow Summary

```
                    Deployment Pipeline
                    ===================

Developer ──git push──> GitHub Actions ──docker push──> GHCR
    |                                                     |
    | terraform apply                     docker compose pull
    | ansible-playbook                                    |
    v                                                     v
┌─────────────────────── AWS Cloud ───────────────────────┐
│                                                          │
│  EC2 (t3.micro) + Elastic IP + Let's Encrypt SSL        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ FreeRTC Server (Docker)                            │  │
│  │ Node.js + Express 5 + Socket.IO                    │  │
│  │ Auth, Signaling, Chat, Friends, Static Files       │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌─────────────────────┐  ┌───────────────────────────┐  │
│  │ Coturn (Docker)     │  │ SQLite                    │  │
│  │ TURN relay :3478    │  │ users + friends           │  │
│  └─────────────────────┘  └───────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
        ^            ^               ^            ^
        | HTTPS+WSS  | TURN relay   | HTTPS+WSS  | TURN relay
        | signaling   | (fallback)   | signaling   | (fallback)
        v            v               v            v
┌──────────────┐                          ┌──────────────┐
│   User A     │                          │   User B     │
│ Browser or   │<── Direct P2P WebRTC ──> │ Browser or   │
│ Electron App │  Voice PC + Video PC     │ Electron App │
└──────────────┘                          └──────────────┘
        \                                       /
         \_____ STUN (NAT discovery) __________/
                        |
               Google STUN Servers
          stun1/stun2.l.google.com:19302
```

---

## Electron Desktop App

The Electron app (`src/desktop/main.js`) wraps the web client in a native BrowserWindow:

- Loads server URL from `config/client.json` (`serverUrl` field)
- **Display source picker** — native window/screen selection via `desktopCapturer` for screen sharing (exposes `window.electronAPI.pickDisplaySource()`)
- **System audio capture** — on supported platforms, captures desktop audio alongside screen share
- **Structured logging** — writes to `userData/freertc.log` with configurable log level
- **Device selection** — uses the OS-reported default microphone rather than WebRTC's default

The web client detects Electron via `window.electronAPI` and uses native APIs when available, falling back to browser APIs (`getDisplayMedia`) otherwise.

---

## Cost

| Component | Free Tier (12 months) | After Free Tier |
|---|---|---|
| EC2 t3.micro | 750 hrs/month included | ~$8/month |
| Elastic IP | Free while attached | ~$3.60/month if detached |
| Data transfer | 100 GB/month out | $0.09-0.20/GB |
| **Estimated total** | **$0** | **~$12-15/month + bandwidth** |

Media streams flow P2P and do not transit the server (unless TURN is used), so bandwidth costs are primarily from signaling, static assets, and chat — not video.
