#!/usr/bin/env bash
# Legilimens Startup Script
# Starts all required services for the hackathon demo.
#
# Usage: bash scripts/start_demo.sh
# Works from any directory — resolves paths relative to repo root.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════════════════════════════"
echo "  🧙 Legilimens - Real-time Classroom Mind Reading"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── 0. Pre-flight checks ───────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi
echo "✅ Docker is running"

if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
    echo "⚠️  backend/.env not found — copying from .env.example"
    echo "   Edit backend/.env and add your GEMINI_API_KEY and ELEVENLABS_API_KEY."
    cp "$PROJECT_ROOT/backend/.env.example" "$PROJECT_ROOT/backend/.env"
fi

# ─── 1. Actian VectorAI DB ──────────────────────────────────────────
echo ""
echo "📦 Starting Actian VectorAI DB..."
if docker ps --format '{{.Names}}' | grep -q '^vectorai$'; then
    echo "   VectorAI DB already running"
else
    docker rm -f vectorai 2>/dev/null || true
    docker run -d --name vectorai \
        -p 6573-6575:6573-6575 \
        -e ACTIAN_VECTORAI_ACCEPT_EULA=YES \
        actian/vectorai:latest > /dev/null
    echo "   Waiting for VectorAI to start..."
    sleep 10
fi
echo "   ✅ VectorAI DB running on ports 6573-6575"
echo "   🌐 LocalUI: http://localhost:6575"

# ─── 2. Python venv + backend deps ───────────────────────────────────
echo ""
echo "🐍 Setting up Python environment..."
if [ ! -d "$PROJECT_ROOT/.venv" ]; then
    python3 -m venv "$PROJECT_ROOT/.venv"
fi
# shellcheck disable=SC1091
source "$PROJECT_ROOT/.venv/bin/activate"

# Use requirements.txt as the single source of truth.
# (Previously this line had 'actian-vectorai-client' which is the wrong
# package name — the correct one is 'actian-vectorai', fixed in requirements.txt)
pip install -q -r "$PROJECT_ROOT/backend/requirements.txt"
echo "   ✅ Python environment ready"

# ─── 3. Backend ────────────────────────────────────────────────────
echo ""
echo "🚀 Starting FastAPI backend..."
cd "$PROJECT_ROOT/backend"
pkill -f "uvicorn main:app" 2>/dev/null || true

source "$PROJECT_ROOT/.venv/bin/activate"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload \
    > /tmp/legilimens-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Backend running on http://localhost:8000"
else
    echo "   ⚠️  Backend may still be starting — check /tmp/legilimens-backend.log"
fi

# ─── 4. Demo data (seed + pre-cache) ─────────────────────────────────
echo ""
echo "🔮 Loading demo data..."
cd "$PROJECT_ROOT"
bash scripts/demo_setup.sh

# ─── 5. Frontend ────────────────────────────────────────────────────
echo ""
echo "⚡ Starting Next.js frontend..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
npm run dev > /tmp/legilimens-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✨ All services started!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  📊 Services:"
echo "     • Actian VectorAI DB:  http://localhost:6575 (LocalUI)"
echo "     • Backend API:         http://localhost:8000/docs"
echo "     • Frontend (Student):  http://localhost:3000/muffliato"
echo "     • Frontend (Teacher):  http://localhost:3000/dashboard"
echo "     • Overlay:             http://localhost:3000/overlay"
echo ""
echo "  📋 Quick test:"
echo "     curl -s http://localhost:8000/health | python3 -m json.tool"
echo ""
echo "  📝 Logs:"
echo "     Backend:  /tmp/legilimens-backend.log"
echo "     Frontend: /tmp/legilimens-frontend.log"
echo ""
echo "  🛑 To stop all services:"
echo "     pkill -f 'uvicorn main:app'"
echo "     pkill -f 'next dev'"
echo "     docker stop vectorai"
echo ""
