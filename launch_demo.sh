#!/bin/bash
set -euo pipefail

BACKEND_DIR="/home/souro/Downloads/TeamTraction/backend"
FRONTEND_DIR="/home/souro/Downloads/TeamTraction/frontend"
STEALTH_DIR="/home/souro/Downloads/TeamTraction/stealth-client"
FRONTEND_PORT=3000
BACKEND_PORT=8000
HEALTH_TIMEOUT=60  # seconds before giving up on a service

log() { echo "$(date +%T) ► $*"; }
die() { echo "$(date +%T) ✖ $*" >&2; exit 1; }

# ── Graceful teardown on any exit path ──────────────────────
cleanup() {
  log "Shutting down all services..."
  [[ -n "${ELECTRON_PID:-}" ]] && kill "$ELECTRON_PID"  2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID"  2>/dev/null || true
  [[ -n "${BACKEND_PID:-}"  ]] && kill "$BACKEND_PID"   2>/dev/null || true
  # Catch any child processes that escaped PID tracking
  pkill -f "uvicorn main:app"  2>/dev/null || true
  pkill -f "next-server"       2>/dev/null || true
  log "Done."
}
trap cleanup EXIT INT TERM

# ── Health-check with timeout ────────────────────────────────
wait_for_url() {
  local url="$1" label="$2" waited=0
  log "Waiting for $label ($url)..."
  until curl -sf "$url" > /dev/null 2>&1; do
    sleep 1
    waited=$(( waited + 1 ))
    if [[ $waited -ge $HEALTH_TIMEOUT ]]; then
      die "$label did not become healthy within ${HEALTH_TIMEOUT}s — check logs above."
    fi
  done
  log "✅ $label is UP!"
}

# ── 1. Backend ───────────────────────────────────────────────
log "Starting backend on :${BACKEND_PORT}..."
cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!
wait_for_url "http://127.0.0.1:${BACKEND_PORT}/health" "Backend"

# ── 2. Frontend ──────────────────────────────────────────────
log "Starting frontend on :${FRONTEND_PORT}..."
cd "$FRONTEND_DIR"
# Force Next.js to the exact port so Electron's hardcoded URL is always correct
PORT=$FRONTEND_PORT npm run dev &
FRONTEND_PID=$!
wait_for_url "http://127.0.0.1:${FRONTEND_PORT}" "Frontend"

# ── 3. Stealth Electron overlay ──────────────────────────────
log "Launching Stealth Overlay (Electron)..."
cd "$STEALTH_DIR"
# Ensure a display is available (Wayland / headless fallback)
[[ -z "${DISPLAY:-}" ]] && export DISPLAY=:0
npm start &
ELECTRON_PID=$!

log ""
log "✅ All systems running!"
log "   Backend  → http://localhost:${BACKEND_PORT}"
log "   Frontend → http://localhost:${FRONTEND_PORT}"
log "   Overlay  → http://localhost:${FRONTEND_PORT}/overlay  (Electron)"
log ""
log "Press Ctrl+C to shut everything down."

wait "$ELECTRON_PID"
