#!/usr/bin/env bash
# Legilimens — Demo data setup script.
#
# Pre-loads the demo data into VectorAI DB and Actian Vector so the 3-minute
# demo runs deterministically. Run this after `docker-compose up -d`.
#
# Usage: bash scripts/demo_setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "🔮 Legilimens — Demo Setup"
echo "=========================="

# 1. Wait for services to be healthy
echo "1. Waiting for FastAPI to be healthy..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "   ✓ FastAPI is up"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "   ✗ FastAPI not responding after 60s — continuing anyway"
    fi
    sleep 2
done

PYTHON_BIN="python"
if [ -d ".venv/bin" ]; then
    PYTHON_BIN=".venv/bin/python"
fi

# 2. Load lecture transcript into VectorAI DB
echo "2. Loading lecture transcript (chunk + embed + upsert)..."
PYTHONPATH=backend "$PYTHON_BIN" data-prep/chunk_lecture.py \
    --transcript data-prep/sample_lecture.txt \
    --lecture-id 1

# 3. Load textbook chapter into VectorAI DB (knowledge vault)
echo "3. Loading textbook chapter (knowledge vault)..."
PYTHONPATH=backend "$PYTHON_BIN" data-prep/load_textbook.py \
    --textbook data-prep/backprop_notes.txt \
    --source "3B1B"

# 4. Pre-cache one analogy for the offline/cable-pull demo
echo "4. Pre-caching analogy for offline demo (chain_rule, cricketer)..."
PYTHONPATH=backend "$PYTHON_BIN" -c "
from services.offline_cache import pre_cache_analogy
success = pre_cache_analogy(
    concept_node='chain_rule',
    chunk_text='The chain rule in backpropagation multiplies gradients layer by layer. '
               'Each layer gradient depends on the gradient of the layer above it.',
    avatar_str='cricketer',
)
print('Pre-cache:', 'success' if success else 'FAILED (cloud APIs may be unavailable)')
"

echo ""
echo "✅ Demo data loaded. Ready for the 3-minute demo."
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:8000/health"
echo "   Cache:    backend/cache/"
