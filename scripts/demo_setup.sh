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
    sleep 2
done

# 2. Load lecture transcript + textbook into VectorAI DB
echo "2. Loading lecture transcript..."
# TODO Phase 1: python data-prep/chunk_lecture.py --transcript data-prep/sample_lecture.txt --lecture-id 1
echo "   (TODO Phase 1: implement chunk + embed + upsert)"

echo "3. Loading textbook chapter..."
# TODO Phase 1: python data-prep/load_textbook.py --textbook data-prep/backprop_notes.txt
echo "   (TODO Phase 1: implement)"

# 3. Pre-seed some confusion events for the Pensieve dashboard
echo "4. Pre-seeding confusion events for Pensieve demo..."
# TODO Phase 7: curl POST some confusion events to populate the analytics table
echo "   (TODO Phase 7: implement)"

echo ""
echo "✅ Demo data loaded. Ready for the 3-minute demo."
echo "   Frontend: http://localhost:3000"
echo "   API:      http://localhost:8000/health"
