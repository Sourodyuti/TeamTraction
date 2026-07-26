#!/bin/bash
set -e

echo "🚀 Launching Legilimens Full Stack..."

# 1. Start Backend
echo "Starting Backend (Port 8000)..."
cd /home/souro/Downloads/TeamTraction/backend
source .venv/bin/activate
uvicorn main:app --port 8000 &
BACKEND_PID=$!

# Wait for backend to be healthy
echo "Waiting for backend to initialize..."
while ! curl -s http://127.0.0.1:8000/health > /dev/null; do
  sleep 1
done
echo "✅ Backend is UP!"

# 2. Start Frontend
echo "Starting Frontend (Port 3000)..."
cd /home/souro/Downloads/TeamTraction/frontend
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to compile and respond
echo "Waiting for frontend to initialize..."
while ! curl -s http://127.0.0.1:3000 > /dev/null; do
  sleep 1
done
echo "✅ Frontend is UP!"

# 3. Start Stealth Client (Electron)
echo "Launching Stealth Overlay..."
cd /home/souro/Downloads/TeamTraction/stealth-client
npm start &
ELECTRON_PID=$!

echo "✅ All systems running! The overlay should now appear on your screen."
echo "Close this terminal or press Ctrl+C to shut everything down."

# Wait for all background processes
wait $ELECTRON_PID

# Cleanup on exit
kill $BACKEND_PID
kill $FRONTEND_PID
