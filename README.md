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

Infrastructure is provisioned with **Terraform** and configured with **Ansible**. Terraform creates the AWS resources; Ansible SSHes into the new server and sets everything up automatically — Docker, the app, coturn, and SSL certificates.

### Prerequisites

**Install the tools** (one-time, on your local machine):

| Tool | Install |
|------|---------|
| Terraform | [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install) |
| Ansible | `pip install ansible` or see [docs](https://docs.ansible.com/ansible/latest/installation_guide/) |
| AWS CLI | `pip install awscli` then `aws configure` |

**AWS setup** (one-time, in the AWS console):

1. Create an IAM user with programmatic access and attach the `AmazonEC2FullAccess` policy. Run `aws configure` with its credentials.
2. In EC2 → **Key Pairs**, create a key pair and download the `.pem` file. Note the name — you'll need it in the next step.
3. Make sure your `.pem` file has the right permissions: `chmod 400 your-key.pem`

**Domain** — You need a domain name pointing to your Elastic IP before Ansible runs (Let's Encrypt needs to reach it). If you don't have one, [nip.io](https://nip.io) gives you a free subdomain — e.g. `1.2.3.4.nip.io` automatically resolves to `1.2.3.4`. Get the Elastic IP from Terraform first (step 1), then point your domain at it.

### 1. Provision with Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — set key_name to your AWS key pair name
terraform init
terraform apply
```

Terraform creates the EC2 instance, Elastic IP, and security group. At the end it prints `public_ip` — copy that value, you'll use it in the next step.

### 2. Configure and deploy with Ansible

```bash
cd ansible
cp inventory.ini.example inventory.ini
cp vars.yml.example vars.yml
```

Edit `inventory.ini` — replace `YOUR_ELASTIC_IP` with the IP from step 1 and set the path to your `.pem` file:

```ini
[freertc]
1.2.3.4 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/your-key.pem
```

Edit `vars.yml` — fill in all values (see [Configuration reference](#configuration-reference) below).

Then run the playbook:

```bash
ansible-playbook -i inventory.ini playbook.yml
```

This SSHes into the server and automatically: installs Docker, clones the repo, writes `config/secrets.json`, patches `coturn/turnserver.conf`, obtains an SSL certificate via Let's Encrypt, and starts all services. It takes a few minutes on first run.

### 3. Connect

**Browser** — Navigate to `https://your-domain.com:8001`. Create an account at `/register.html`, log in, and click **Create Room** to start a call. Share the room link with anyone you want to invite.

**Desktop app** — Build and install the app (see [Electron Desktop Client](#electron-desktop-client)), then enter your domain and port `8001` in the connection window.

### Updating

Every push to `master` triggers a GitHub Actions workflow that:

- Creates a git tag matching the version in `package.json` (e.g. `v0.13.1`)
- Builds and publishes a Docker image to the GitHub Container Registry tagged as `latest`, `v0.13.1`, and the commit SHA
- PRs trigger a build-only run to catch broken Dockerfiles before merge — no tag or publish

To deploy the latest image on your server:

```bash
cd /opt/freertc && docker compose pull && docker compose up -d
```

**First push:** GitHub marks the package as private by default. Go to your repo on GitHub → **Packages** → select `freertc` → **Package settings** → change visibility to **Public** so the server can pull without credentials.

**Forks:** Update the image name in `docker-compose.yml` to match your GitHub username:

```yaml
image: ghcr.io/your-github-username/freertc:latest
```

### Notes

- Let's Encrypt certs expire after 90 days. Renew with `./cert.sh -r` on the server — it renews, re-copies the files, and restarts FreeRTC automatically.
- After 12 months, t3.micro costs ~$8/month. Free tier includes 100 GB/month outbound — TURN-relayed video counts against this.
- Config, certs, and the database are volume-mounted and persist across image rebuilds.

### Configuration reference <a name="configuration-reference"></a>

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
