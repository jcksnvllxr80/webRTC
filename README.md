# FreeRTC

A self-hosted, peer-to-peer video and audio calling app with rich text chat, screen sharing, friends, and an Electron desktop client — served over HTTPS with session-based authentication.

## Project Layout

```
certs/          HTTPS certificate files
config/         runtime config and secrets
data/           SQLite database (auto-created)
src/
  desktop/      Electron client
  server/       HTTPS + Socket.IO backend
  web/public/   browser app
```

## Deploying to AWS

Video and audio require a public server and a TURN relay — WebRTC cannot cross most home NAT routers without one. AWS Free Tier covers everything for the first 12 months.

Infrastructure is provisioned with **Terraform** and configured with **Ansible**.

### Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) installed locally
- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/) installed locally
- An AWS account with credentials configured (`aws configure`)
- An AWS key pair created in your target region, `.pem` file downloaded
- A domain name (or free subdomain from [nip.io](https://nip.io)) pointing to your Elastic IP

### 1. Provision with Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — set your key_name and region
terraform init
terraform apply
```

Note the `public_ip` from the output — you'll need it in the next step.

### 2. Configure and deploy with Ansible

```bash
cd ansible
cp inventory.ini.example inventory.ini
cp vars.yml.example vars.yml
# edit both files — fill in your IP, domain, credentials, and email
ansible-playbook -i inventory.ini playbook.yml
```

The playbook installs Docker, clones the repo, writes your secrets, configures coturn, gets an SSL certificate via Let's Encrypt, and starts all services.

### 3. Connect

**Browser** — Navigate to `https://your-domain.com:8001`. Create an account at `/register.html`, log in, and click **Create Room** to start a call. Share the room link with anyone you want to invite.

**Desktop app** — Build and install the app (see [Electron Desktop Client](#electron-desktop-client)), then enter your domain and port `8001` in the connection window.

### Updating

```bash
# On the server
cd /opt/freertc && git pull && docker compose up -d --build
```

### Notes

- Let's Encrypt certs expire after 90 days. Renew with `./cert.sh -r` on the server — it renews, re-copies the files, and restarts FreeRTC automatically.
- After 12 months, t3.micro costs ~$8/month. Free tier includes 100 GB/month outbound — TURN-relayed video counts against this.
- Config, certs, and the database are volume-mounted and persist across image rebuilds.

### Configuration reference

`ansible/vars.yml` (gitignored) drives the entire deployment:

| Key | Purpose |
|-----|---------|
| `domain` | Your domain or nip.io subdomain |
| `public_ip` | Elastic IP from `terraform output public_ip` |
| `letsencrypt_email` | Email for Let's Encrypt cert registration |
| `turn_user` / `turn_credential` | TURN auth — set to anything, must match each other |
| `giphy_api_key` | Optional — GIF search in chat ([developers.giphy.com](https://developers.giphy.com)) |

## Chat

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

**Emoji** — Click 😀 or type `:shortcode:` (e.g. `:wave:`) for inline autocomplete.

**GIF search** — Requires a `giphyApiKey` in `config/secrets.json`.

**Files and images** — Click 📎, drag onto the input, or paste from clipboard. Images embed inline; other files send as downloadable cards.

**Rebuilding the editor** — The chat editor is pre-bundled. If you modify `src/web/editor-src/index.js`:

```bash
npm run build:editor
```

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
