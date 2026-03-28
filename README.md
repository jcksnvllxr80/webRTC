# FreeRTC

A self-hosted, peer-to-peer video and audio calling app with rich text chat, screen sharing, friends, and an Electron desktop client — served over HTTPS with session-based authentication.

## Project Layout

```
certs/              HTTPS certificate files
config/             runtime config and secrets
data/               SQLite database (auto-created)
deployment/
  ansible/          Ansible playbook and config templates
  terraform/        Terraform infrastructure scripts
  DEPLOYMENT.md     Full AWS deployment guide
src/
  desktop/          Electron client
  server/           HTTPS + Socket.IO backend
  web/public/       browser app
```

## Deploying to AWS

Video and audio require a public server and a TURN relay — WebRTC cannot cross most home NAT routers without one. AWS Free Tier covers everything for the first 12 months.

Deployment is automated using Terraform and Ansible — scripts live in `deployment/`. See **[deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md)** for the full step-by-step guide covering prerequisites, Terraform setup, Ansible configuration, SSL certificates, and the GitHub Actions CI/CD workflow.

## Secrets

`config/secrets.json` holds credentials and API keys. It is gitignored and never committed. The server merges it over `config/server.json` at startup, so any key here overrides the default.

Create the file on your server (Ansible does this automatically — this is only needed for manual setups):

```json
{
  "turnUrl": "turn:YOUR_ELASTIC_IP:3478",
  "turnUser": "freertc",
  "turnCredential": "your-strong-password",
  "giphyApiKey": "YOUR_GIPHY_KEY"
}
```

| Key | Purpose | Where to get it |
|-----|---------|----------------|
| `turnUrl` | TURN relay server for cross-network calls | Your coturn server (set by Ansible) |
| `turnUser` / `turnCredential` | TURN authentication | Must match `coturn/turnserver.conf` |
| `giphyApiKey` | GIF search in chat | [developers.giphy.com](https://developers.giphy.com) — free, 100 req/hr |

## Electron Desktop Client

The desktop app is a native wrapper that connects to your FreeRTC server. Before building, set the server URL in `config/client.json`:

```json
{
  "serverUrl": "https://your-domain.com:8001"
}
```

When `serverUrl` is set, the app connects automatically on launch with no prompt. If it's empty or the connection fails, a dialog appears to enter the URL manually.

Build on the platform you want to target:

```bash
# Install dependencies first (only needed once)
npm install

# Build for your current platform
npm run build
```

Output in `dist/`:

| Platform | Output |
|----------|--------|
| Windows | `FreeRTC Setup x.x.x.exe` |
| macOS | `FreeRTC-x.x.x.dmg` |
| Linux | `FreeRTC-x.x.x.AppImage` |

`npm run build` targets your current platform. To cross-compile for a specific platform:

```bash
npx electron-builder --win
npx electron-builder --mac   # must run on macOS
npx electron-builder --linux
```

Install it like any other app. On first launch, enter your server's domain or IP and port `8001` in the connection window, then log in as normal.

---

## Links

- [Feature Reference](design/FEATURES.md) — video, audio, and chat feature details
- [Deployment Guide](deployment/DEPLOYMENT.md) — full AWS setup with Terraform and Ansible
- [Design System](design/DESIGN.md) — fonts, colors, and UI conventions
