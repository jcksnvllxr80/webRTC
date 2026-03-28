# Deploying FreeRTC to AWS

Video and audio require a public server and a TURN relay — WebRTC cannot cross most home NAT routers without one. AWS Free Tier covers everything for the first 12 months.

Infrastructure is provisioned with **Terraform** (`deployment/terraform/`) and configured with **Ansible** (`deployment/ansible/`). Terraform creates the AWS resources; Ansible SSHes into the new server and sets everything up automatically — Docker, the app, coturn, and SSL certificates.

---

## Prerequisites

Terraform and the AWS CLI run on Windows. Ansible does not run natively on Windows — use **WSL2** (Windows Subsystem for Linux) for the Ansible steps.

**Install the tools:**

| Tool | Where | Install |
|------|-------|---------|
| Terraform | Windows | [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install) — download the AMD64 zip, extract `terraform.exe` to `C:\tools`, and add `C:\tools` to your PATH |
| AWS CLI | Windows | `pip install awscli` then `aws configure` |
| Ansible | WSL2 | `pip install ansible` |
| WSL2 | Windows | `wsl --install` in PowerShell (reboot required) |

> **Terraform PATH tip (Windows):** After adding `C:\tools` to your system PATH, open a new PowerShell window. If `terraform -version` still isn't recognized, run `$env:Path += ";C:\tools"` to apply it to the current session, or add that line to your PowerShell profile to make it permanent.

**AWS credentials:** Terraform uses whatever AWS CLI profile is active. If you have multiple profiles configured, make sure the right one is set before running Terraform:

```powershell
$env:AWS_PROFILE = "home"
aws sts get-caller-identity   # confirm you're on the right account
```

**AWS setup** (one-time, in the AWS console):

1. Create an IAM user with programmatic access and attach the `AmazonEC2FullAccess` policy. Run `aws configure` on Windows with its credentials.
2. In EC2 → **Key Pairs**, create a key pair and download the `.pem` file. Note the exact name shown in the console — you'll need it below. Make sure you're in the correct region (e.g. `us-east-1`) when creating it — the key pair must exist in the same region Terraform deploys to.
3. Copy the `.pem` to your WSL2 home and lock down its permissions:
   ```bash
   cp /mnt/c/Users/$USER/.ssh/your-key.pem ~/.ssh/
   chmod 400 ~/.ssh/your-key.pem
   ```

   **Windows-only alternative** (if not using WSL yet): a helper script is included:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "deployment\fix-pem.ps1" -PemFile "your-key.pem"
   ```

**secrets.json** — Before running Ansible, create `config/secrets.json` in the project root. Ansible copies it to the server. It is gitignored and never committed:

```json
{
  "turnUrl": "turn:YOUR_ELASTIC_IP:3478",
  "turnUser": "freertc",
  "turnCredential": "make-up-a-strong-password",
  "giphyApiKey": ""
}
```

`turnCredential` is a password you invent — Ansible syncs it into coturn automatically. `giphyApiKey` is optional; leave it empty to disable GIF search.

**Domain** — You need a domain name pointing to your Elastic IP before Ansible runs (Let's Encrypt needs to reach it). If you don't have one, [nip.io](https://nip.io) gives you a free subdomain — e.g. `1.2.3.4.nip.io` automatically resolves to `1.2.3.4`. Get the Elastic IP from Terraform first (step 1), then point your domain at it.

---

## Step 1 — Provision with Terraform

> Run these commands in **PowerShell** (Windows).

```powershell
cd deployment/terraform
Copy-Item terraform.tfvars.example terraform.tfvars
notepad terraform.tfvars
```

Set `key_name` to the exact name of the key pair shown in EC2 → Key Pairs. Save and close.

```powershell
terraform init
terraform apply
```

Terraform creates the EC2 instance, Elastic IP, and security group with all required ports open. At the end it prints `public_ip` — copy that value, you'll need it in the next step.

---

## Step 2 — Configure and deploy with Ansible

> Run these commands in **WSL2**.

```bash
cd deployment/ansible
cp inventory.ini.example inventory.ini
cp vars.yml.example vars.yml
```

Edit `inventory.ini` — replace `YOUR_ELASTIC_IP` with the IP from step 1 and set the path to your `.pem` file:

```ini
[freertc]
1.2.3.4 ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/your-key.pem
```

> **Key must be in WSL home, not on the Windows drive.** If your `.pem` is under `/mnt/c/...`, WSL can't set proper permissions on it and SSH will refuse it. Copy it to `~/.ssh/` inside WSL first (`cp /mnt/c/Users/yourname/.ssh/your-key.pem ~/.ssh/`) and run `chmod 400` there.

> **RSA key algorithm error** (`no mutual signature supported`): newer SSH versions disable RSA by default. Add `ansible_ssh_extra_args='-o PubkeyAcceptedAlgorithms=+ssh-rsa'` to the `inventory.ini` line if you see this error.

Edit `vars.yml` — fill in all three values:

| Key | Purpose |
|-----|---------|
| `domain` | Your domain or nip.io subdomain (e.g. `1.2.3.4.nip.io`) |
| `public_ip` | Elastic IP — run `terraform output public_ip` in PowerShell to get it |
| `letsencrypt_email` | Any email address — used by Let's Encrypt to notify you about cert expiry |

Then run the playbook:

```bash
ansible-playbook -i inventory.ini playbook.yml
```

This SSHes into the server and automatically: installs Docker, clones the repo, copies `config/secrets.json`, patches `coturn/turnserver.conf`, obtains an SSL certificate via Let's Encrypt, and starts all services. It takes a few minutes on first run.

---

## Step 3 — Connect

**Browser** — Navigate to `https://your-domain.com:8001`. Create an account at `/register.html`, log in, and click **Create Room** to start a call.

**Desktop app** — Build and install the Electron app, then enter your domain and port `8001` in the connection window. See the main README for build instructions.

---

## Updating

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

---

## Notes

- Let's Encrypt certs expire after 90 days. Renew with `./cert.sh -r` on the server — it renews, re-copies the files, and restarts FreeRTC automatically.
- After 12 months, t3.micro costs ~$8/month. Free tier includes 100 GB/month outbound — TURN-relayed video counts against this.
- Config, certs, and the database are volume-mounted and persist across container restarts and image rebuilds.
