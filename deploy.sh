#!/usr/bin/env bash
# Legilimens — One-command DigitalOcean Droplet deploy
#
# Usage:
#   ./deploy.sh <DROPLET_IP> [SSH_KEY_PATH]
#
# What it does:
#   1. SSH into the Droplet and install Docker + Compose if needed
#   2. Copies .env.prod to the Droplet
#   3. Pulls latest code (git pull) on the Droplet
#   4. Rebuilds and restarts all containers
#   5. Optionally sets up Let's Encrypt SSL via Certbot
#
# Prerequisites on your local machine:
#   - SSH access to the Droplet (root or sudo user)
#   - .env.prod file exists in project root (never committed)
#   - git remote `origin` points to your GitHub repo

set -euo pipefail

DROPLET_IP="${1:?Usage: ./deploy.sh <DROPLET_IP> [SSH_KEY]}"
SSH_KEY="${2:-$HOME/.ssh/id_rsa}"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"
REMOTE_DIR="/opt/legilimens"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Deploying Legilimens to $DROPLET_IP..."

# ─── 1. Bootstrap Docker on the Droplet ───────────────────────────
echo "→ Ensuring Docker is installed..."
ssh $SSH_OPTS root@"$DROPLET_IP" bash -s << 'EOF'
  if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
    systemctl enable --now docker
  fi
  if ! command -v docker-compose &> /dev/null && ! docker compose version &>/dev/null; then
    apt-get install -y docker-compose-plugin
  fi
  echo "Docker: $(docker --version)"
EOF

# ─── 2. Sync project files ────────────────────────────────────────
echo "→ Syncing project files..."
ssh $SSH_OPTS root@"$DROPLET_IP" "mkdir -p $REMOTE_DIR"

# Rsync everything except .venv, .git, node_modules, __pycache__
rsync -avz --progress \
  --exclude='.venv' \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.next' \
  --exclude='local_data' \
  --exclude='website_clones' \
  -e "ssh $SSH_OPTS" \
  . root@"$DROPLET_IP":"$REMOTE_DIR/"

# ─── 3. Copy production secrets ───────────────────────────────────
echo "→ Uploading .env.prod..."
if [[ -f ".env.prod" ]]; then
  scp $SSH_OPTS .env.prod root@"$DROPLET_IP":"$REMOTE_DIR/.env.prod"
else
  echo "⚠️  WARNING: .env.prod not found — skipping. Make sure it exists on the Droplet."
fi

# ─── 4. Build & restart containers ───────────────────────────────
echo "→ Building and starting containers..."
ssh $SSH_OPTS root@"$DROPLET_IP" bash -s << ENDSSH
  cd $REMOTE_DIR
  docker compose -f $COMPOSE_FILE pull --quiet vectorai-db actian-vector nginx 2>/dev/null || true
  docker compose -f $COMPOSE_FILE build --no-cache fastapi frontend
  docker compose -f $COMPOSE_FILE up -d --remove-orphans
  docker compose -f $COMPOSE_FILE ps
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo "   Frontend: http://$DROPLET_IP"
echo "   Backend:  http://$DROPLET_IP/health"
echo "   API Docs: http://$DROPLET_IP/docs"
echo ""
echo "📌 Next steps:"
echo "   1. Point your domain DNS → $DROPLET_IP"
echo "   2. SSH in and run: certbot --nginx -d YOUR_DOMAIN"
echo "   3. Uncomment SSL lines in nginx/nginx.conf"
