# Deploying FreeRTC to AWS

Video and audio require a public server and a TURN relay — WebRTC cannot cross most home NAT routers without one. AWS Free Tier covers everything for the first 12 months.

Infrastructure is provisioned with **Terraform** (`deployment/terraform/`) and configured with **Ansible** (`deployment/ansible/`). Terraform creates the AWS resources; Ansible SSHes into the new server and sets everything up automatically — Docker, the app, coturn, and SSL certificates.

---

## Prerequisites

**Install the tools** (one-time, on your local machine):

| Tool | Install |
|------|---------|
| Terraform | [developer.hashicorp.com/terraform/install](https://developer.hashicorp.com/terraform/install) |
| Ansible | `pip install ansible` or see [docs](https://docs.ansible.com/ansible/latest/installation_guide/) |
| AWS CLI | `pip install awscli` then `aws configure` |

**AWS setup** (one-time, in the AWS console):

1. Create an IAM user with programmatic access and attach the `AmazonEC2FullAccess` policy. Run `aws configure` with its credentials.
2. In EC2 → **Key Pairs**, create a key pair and download the `.pem` file. Note the name — you'll need it below.
3. Set the right permissions on your `.pem` file: `chmod 400 your-key.pem`

**Domain** — You need a domain name pointing to your Elastic IP before Ansible runs (Let's Encrypt needs to reach it). If you don't have one, [nip.io](https://nip.io) gives you a free subdomain — e.g. `1.2.3.4.nip.io` automatically resolves to `1.2.3.4`. Get the Elastic IP from Terraform first (step 1), then point your domain at it.

---

## Step 1 — Provision with Terraform

```bash
cd deployment/terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars — set key_name to your AWS key pair name
terraform init
terraform apply
```

Terraform creates the EC2 instance, Elastic IP, and security group with all required ports open. At the end it prints `public_ip` — copy that value, you'll need it in the next step.

---

## Step 2 — Configure and deploy with Ansible

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

Edit `vars.yml` — fill in all values:

| Key | Purpose |
|-----|---------|
| `domain` | Your domain or nip.io subdomain |
| `public_ip` | Elastic IP from `terraform output public_ip` |
| `letsencrypt_email` | Email for Let's Encrypt cert registration |
| `turn_user` / `turn_credential` | TURN auth — set to anything, must match each other |
| `giphy_api_key` | Optional — GIF search in chat ([developers.giphy.com](https://developers.giphy.com)) |

Then run the playbook:

```bash
ansible-playbook -i inventory.ini playbook.yml
```

This SSHes into the server and automatically: installs Docker, clones the repo, writes `config/secrets.json`, patches `coturn/turnserver.conf`, obtains an SSL certificate via Let's Encrypt, and starts all services. It takes a few minutes on first run.

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
