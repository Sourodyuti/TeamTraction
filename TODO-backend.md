# ✅ TODO — Member 1: Backend / Actian Lead

> **Branch:** `dev/backend` · **Owns:** `backend/` (routers, models, websocket), `docker-compose.yml`, `Makefile`
> **Coordinates with:** AI lead on the embed/retrieve interface; FE lead on WebSocket + REST schema.
> **Never touch:** `frontend/`, `services/` (that's AI lead), `data-prep/` (that's AI lead).

---

## Phase 0 — Foundation & Scaffolding (Hours 0–2)

- [x] `docker-compose.yml`: VectorAI DB (`:6573`/`:6574`) + Actian Vector + FastAPI — verify Actian image tags against docs
- [x] `docker-compose up -d` brings all 3 services up cleanly
- [x] `backend/main.py`: FastAPI app factory, lifespan startup/shutdown, `/health` with dependency status
- [x] `backend/config.py`: pydantic-settings reads `.env`, CORS origins configurable
- [x] `backend/logging_config.py`: structured logging with color console output
- [x] `actian_vectorai` SDK connects to VectorAI DB
- [x] Create `lecture_chunks` collection (384-dim, Cosine)
- [x] Actian Vector answers `SELECT 1` via pyodbc/ingres
- [x] `models/database.py`: connection pool, retry decorator, DDL for all tables
- [x] Create `confusion_events`, `lectures`, `current_chunk` tables (idempotent)
- [ ] **Exit gate:** both DBs respond to a smoke query ✅

---

## Phase 2 — Capture Layer Backend (Hours 4–7)

- [x] `models/schemas.py`: all Pydantic models (StudentPing, LectureChunk, ConfusionEvent, AnalogyRequest/Response)
- [x] `routers/websocket.py`: WebSocket hub `/ws/lecture/{lecture_id}` with connection pool per lecture
- [x] Ping handler: validate schema → tag to current `concept_node` → insert row → broadcast
- [x] `routers/asr.py`: ingest-chunk endpoint updates `current_chunk` table (current concept node)
- [ ] **Exit gate:** WS ping → DB row inserted + radar_update broadcast ✅

---

## Phase 4 — Retrieval Loop / Accio Analogy (Hours 9–12)

- [x] `routers/retrieval.py`: threshold rule (≥2 lost in 20s on same node) → fire retrieval
- [x] Call AI lead's `embedder.encode()` + `vectorai_client.search_similar()` (interface defined below)
- [x] Return top-3 hits with score + latency measurement
- [x] Broadcast `latency_update` to dashboard for the on-screen badge
- [ ] **Exit gate:** retrieval returns <50ms measured ✅ 🎯

---

## Phase 6 — Voice Delivery Backend (Hours 15–17)

- [x] Targeted WebSocket delivery: route analogy audio only to lost students (not broadcast)
- [x] Binary frame protocol for audio chunks (define with FE lead)
- [x] Reliability: queue + retry on failed send
- [ ] **Exit gate:** targeted audio delivery works ✅

---

## Phase 7 — Analytics & Pensieve Backend (Hours 17–19)

- [x] `routers/analytics.py`: top-3 worst moments SQL
- [x] Rolling 60s confusion density SQL
- [x] Per-cohort heatmap SQL
- [x] REST endpoints returning clean JSON (coordinate response shape with FE lead)
- [ ] **Exit gate:** endpoints return real `confusion_events` data ✅ 🎯

---

## Phase 8 — Offline Edge Mode (Hours 19–21)

- [x] In-memory offline ping queue (simulates Actian Zen edge buffer)
- [x] Sync queue to DB on reconnect
- [x] Verify unplug → retrieval + analytics still work
- [ ] **Exit gate:** cable-pull demo succeeds ✅

---

## Phase 10 — Rehearsal & Buffer (Hours 23–27)

- [ ] Fix Docker/SDK fires
- [ ] Fix latency spikes in retrieval path
- [x] `scripts/benchmark_latency.py` full pipeline working
- [ ] **Exit gate:** demo runs clean 3× ✅

---

## 🧪 Your Tests

- [x] `tests/test_health.py`: health endpoint returns 200 + service statuses
- [x] `tests/test_schemas.py`: Pydantic model validation
- [x] `tests/test_database.py`: table creation, pool, retry
- [x] `tests/test_websocket.py`: ping → broadcast flow
- [x] `tests/test_retrieval.py`: threshold trigger + retrieval (mock AI services)
- [x] `tests/test_analytics.py`: Pensieve SQL shape (mock DB)

---

## 🔌 Interface Contracts You Define (others depend on these)

```python
# models/schemas.py — FE lead imports these as TypeScript types
class StudentPing(BaseModel): student_id, ts, signal_type, lecture_id
class ServerMessage: radar_update | analogy_audio | latency_update

# routers/websocket.py — FE lead's useWebSocket.ts depends on this
Endpoint: /ws/lecture/{lecture_id}
Inbound:  {"type": "ping", "student_id": "...", "signal_type": "lost|gotit|slower"}
Outbound: {"type": "radar_update", ...} | {"type": "analogy_audio", ...} (binary frames for audio)

# routers/analytics.py — FE lead's Pensieve page depends on this
GET /analytics/top-moments?lecture_id=1&limit=3 → [{concept_node, lost_count, total_signals, avg_density}]
GET /analytics/density?lecture_id=1            → [{ts, density}]
```