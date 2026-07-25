# Deploying Legilimens to DigitalOcean

Two paths depending on your setup:

---

## Path A — App Platform (easiest, no server management)

Best for: demo / hackathon judges, fully managed

### 1. Push to GitHub
```bash
git add -A && git commit -m "feat: production deployment setup"
git push origin main
```

### 2. Update the App Spec
Edit [`.do/app.yaml`](.do/app.yaml):
- Replace `YOUR_GITHUB_ORG/TeamTraction` with your actual repo
- Set `region` to your preferred DO region (`blr`, `sgp`, `nyc`, etc.)

### 3. Create the App
```bash
# Install doctl if needed: https://docs.digitalocean.com/reference/doctl/how-to/install/
doctl auth init
doctl apps create --spec .do/app.yaml
```

Or: DigitalOcean Console → **Apps** → **Create App** → **From Spec** → paste `.do/app.yaml`

### 4. Add Secrets in the Console
Go to **App → Settings → Environment Variables** and set (as encrypted):
| Variable | Value |
|---|---|
| `MONGODB_URI` | Your Atlas connection string |
| `JWT_SECRET` | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `GEMINI_API_KEY` | From Google AI Studio |
| `ELEVENLABS_API_KEY` | From ElevenLabs dashboard |

### Estimated Cost
| Component | Size | Price/month |
|---|---|---|
| Backend | professional-xs (1 vCPU / 1GB) | ~$12 |
| Frontend | basic-xs (512MB) | ~$5 |
| **Total** | | **~$17/month** |

> ⚠️ Actian VectorAI DB and Actian Vector SQL are **not available** on App Platform.
> Vector search and SQL analytics will return 503. For full functionality, use Path B.

---

## Path B — Droplet (full stack, ~$24/month)

Best for: production, all features including Actian VectorAI + Vector SQL

### 1. Create a Droplet
- **Image:** Ubuntu 22.04 LTS
- **Size:** 4GB RAM / 2 vCPU (`s-2vcpu-4gb`) — minimum for Actian VectorAI
- **Region:** BLR1 (Bangalore) or closest to students
- **SSH Key:** Add your public key

### 2. Create .env.prod
```bash
cp .env.prod.example .env.prod
# Edit with your real values:
nano .env.prod
```

Key values to set:
- `MONGODB_URI` — your Atlas connection string
- `JWT_SECRET` — generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"`
- `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` — your API keys
- `CORS_ORIGINS` — include your Droplet IP or domain

### 3. Deploy
```bash
./deploy.sh YOUR_DROPLET_IP [~/.ssh/id_rsa]
```

This will:
1. Install Docker + Compose on the Droplet (if not present)
2. Rsync the project (excluding .venv, node_modules, etc.)
3. Upload your `.env.prod`
4. Build and start all 5 containers: nginx, frontend, backend, vectorai-db, actian-vector

### 4. Verify
```bash
curl http://YOUR_DROPLET_IP/health
# → {"status":"ok","services":{"embedder":true,"vectorai_db":true,"actian_vector":true}}
```

### 5. Add a Domain + SSL (optional but recommended)
```bash
# SSH into the Droplet
ssh root@YOUR_DROPLET_IP

# Install certbot
apt install -y certbot python3-certbot-nginx

# Get a free Let's Encrypt cert
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Then uncomment the SSL lines in nginx/nginx.conf and restart nginx:
docker compose -f docker-compose.prod.yml restart nginx
```

---

## Updating After Deployment

```bash
# Re-deploy after code changes:
./deploy.sh YOUR_DROPLET_IP

# View logs:
ssh root@YOUR_DROPLET_IP "docker compose -f /opt/legilimens/docker-compose.prod.yml logs -f fastapi"

# Restart a specific service:
ssh root@YOUR_DROPLET_IP "docker compose -f /opt/legilimens/docker-compose.prod.yml restart fastapi"
```

---

## MongoDB Atlas — Fix Authentication

If you see `bad auth: authentication failed`:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/) → **Database Access**
2. Click your DB user → **Edit**
3. Click **Edit Password** and set a new password
4. Update `MONGODB_URI` in your `.env.prod` with the new password
5. Redeploy

The connection string format is:
```
mongodb+srv://USERNAME:PASSWORD@cluster0.fd5h7vb.mongodb.net/?appName=Cluster0
```
