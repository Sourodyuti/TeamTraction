#!/bin/bash
# Legilimens Startup Script
# Starts all required services for the hackathon demo

set -e

PROJECT_ROOT="/home/souro/Downloads/TeamTraction"
cd "$PROJECT_ROOT"

echo "═══════════════════════════════════════════════════════════════"
echo "  🧙 Legilimens - Real-time Classroom Mind Reading"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi
echo "✅ Docker is running"

# Start Actian VectorAI DB
echo ""
echo "📦 Starting Actian VectorAI DB..."
if docker ps | grep -q vectorai; then
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

# Activate virtual environment and install deps if needed
echo ""
echo "🐍 Setting up Python environment..."
if [ ! -d "$PROJECT_ROOT/.venv" ]; then
    python3 -m venv "$PROJECT_ROOT/.venv"
fi
source "$PROJECT_ROOT/.venv/bin/activate"

# Install dependencies
echo "   Installing backend dependencies..."
pip install -q actian-vectorai-client sentence-transformers pydantic-settings google-genai elevenlabs fastapi uvicorn httpx

echo "   ✅ Python environment ready"

# Start Backend
echo ""
echo "🚀 Starting FastAPI backend..."
cd "$PROJECT_ROOT/backend"

# Kill any existing uvicorn on port 8000
pkill -f "uvicorn main:app" 2>/dev/null || true

# Start backend in background
source "$PROJECT_ROOT/.venv/bin/activate"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload > /tmp/legilimens-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Waiting for backend to start..."

# Wait for backend
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Backend running on http://localhost:8000"
else
    echo "   ⚠️ Backend may still be starting (check /tmp/legilimens-backend.log)"
fi

# Start Frontend
echo ""
echo "⚡ Starting Next.js frontend..."
cd "$PROJECT_ROOT/frontend"

# Install npm deps if needed
if [ ! -d "node_modules" ]; then
    npm install --silent
fi

# Start frontend in background
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
echo "     • Frontend (Student):   http://localhost:3000/muffliato"
echo "     • Frontend (Teacher):   http://localhost:3000/dashboard"
echo ""
echo "  📋 Quick Test:"
echo "     curl -s http://localhost:8000/health"
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
