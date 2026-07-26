# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Legilimens** (TeamTraction) — A real-time "mind-reading" layer for live classrooms that detects where/when students collectively get lost, then instantly re-explains that exact moment using a freshly-generated analogy pulled from each student's interest graph. All retrieval runs on-prem on Actian VectorAI DB so student data never leaves the building.

This is a hackathon project built for a Harry-Potter-themed competition. The system uses a "spell" naming convention:
- **Muffliato** — Confusion capture agent (student phone buttons: "I'm lost" / "Got it" / "Slower")
- **Marauder's Radar** — Real-time radar visualization (D3 radial heatmap + timeline)
- **Accio Analogy** — Retrieval engine (Actian VectorAI DB semantic search)
- **Gemino** — Analogy rewriter (Gemini API rewrites explanations per student interest)
- **Sonorus** — Voice re-delivery (ElevenLabs TTS)
- **Pensieve** — Teacher analytics dashboard (Actian Vector columnar analytics)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ EDGE / CLASSROOM (Student phones + 1 Pi/laptop)                              │
│  📱 Student Phone: Muffliato PWA (Next.js) — "I'm lost" / "Got it" buttons  │
│  🎤 Whisper.cpp — Local ASR of lecture audio (~15s chunks)                   │
│  🍓 Pi 4 / laptop: Actian Zen buffer (offline ping queue)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ON-PREM "SCHOOL SERVER" (1 laptop, Docker Compose)                          │
│  🧠 Actian VectorAI DB  :6573 REST / :6574 gRPC  — Semantic retrieval       │
│  📊 Actian Vector       — Columnar SQL (confusion time-series analytics)    │
│  ⚡ FastAPI             — WebSocket hub + REST orchestrator                 │
│  🔢 bge-small embedder  — Local 384-dim embeddings (CPU)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (only anonymized text leaves)
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLOUD (Generative step only)                                                │
│  🤖 Gemini API      — Analogy rewrite per student interest profile          │
│  🔊 ElevenLabs API  — Calm tutor voice TTS                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TEACHER DASHBOARD (Next.js)                                                 │
│  📡 Marauder's Radar — D3 radial heatmap + timeline (live WebSocket)       │
│  📜 Pensieve — Post-lecture "worst moments" report (Actian Vector SQL)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow (~1.5s loop)

1. **Lecturer talks** → Whisper.cpp transcribes → chunked ~15s → embedded (bge-small) → upserted to VectorAI DB `lecture_chunks` collection with payload `{topic_node, ts, diff}`
2. **Student hits "🪄 I'm lost"** → WebSocket ping `{student_id, ts}` hits FastAPI
3. **FastAPI** tags ping to current `concept_node`, writes row to Actian Vector `confusion_events`, pushes to radar via WebSocket
4. **Threshold trigger** (≥2 students lost in 20s) → **Accio Analogy**: embed confusing chunk → VectorAI DB similarity search (top-3 past explanations)
5. **Retrieved context + student interest profile** → Gemini prompt: *"Rewrite as 2-sentence analogy for a {cricketer/gamer/cook}."*
6. **Gemini output** → ElevenLabs TTS → audio streamed back to lost students' phones
7. **Actian Vector** accumulates rows; Pensieve dashboard queries for "worst 3 moments" report

**Latency budget** (display live): ping→radar <100ms · retrieval <50ms · Gemini ~800ms · ElevenLabs ~600ms · **total ~1.5s**

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Retrieval DB | Actian VectorAI DB (Docker) | On-prem, air-gapped-capable, 22× faster vector search |
| Analytics DB | Actian Vector Community (Docker) | Columnar SQL for time-series rollups |
| Edge Buffer | In-memory queue (simulates Actian Zen) | Tiny-footprint embedded buffer for offline pings |
| Backend | FastAPI + Python 3.11 | Async WebSocket hub; Actian's own tutorial uses FastAPI |
| Embeddings | bge-small-en (sentence-transformers) | 384-dim, runs on CPU, fast enough for live |
| ASR | Whisper.cpp (base.en) | Local, no API key, ~real-time on laptop |
| LLM | Google Gemini API (gemini-2.5-flash) | Sponsor track; cheap + fast for analogy rewrite |
| TTS | ElevenLabs API | Sponsor track; calm tutor voice |
| Frontend | Next.js 14 + TypeScript | PWA for student phones + teacher dashboard in one |
| Viz | D3.js (radial heatmap) + Recharts (timeline) | Custom radar is the "wow" visual |
| Realtime | WebSockets via FastAPI | Sub-second ping→radar latency |
| Infra | Docker Compose | One-command bring-up; judge-visible "school server" laptop |

## Development Commands

### Docker / Infrastructure
```bash
# Start all services (VectorAI DB, Actian Vector, FastAPI)
docker-compose up -d

# View logs
docker-compose logs -f fastapi
docker-compose logs -f vectorai-db

# Stop everything
docker-compose down -v
```

### Backend (FastAPI)
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run dev server (auto-reload)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest -v

# Run specific test file
pytest tests/test_websocket.py -v

# Type check
mypy .

# Lint
ruff .
```

### Frontend (Next.js)
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Type check
npm run typecheck
```

### Embedding / ML
```bash
# Download bge-small model (first run)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"

# Test embedding
python -c "from sentence_transformers import SentenceTransformer; m=SentenceTransformer('BAAI/bge-small-en-v1.5'); print(m.encode('test').shape)"
```

### Whisper.cpp (ASR - stretch goal)
```bash
# Build whisper.cpp (run once)
cd whisper.cpp && make base.en

# Test transcription
./main -m models/ggml-base.en.bin -f audio.wav
```

### Data Prep
```bash
# Chunk + embed lecture transcript (from project root)
PYTHONPATH=backend python data-prep/chunk_lecture.py --transcript data-prep/sample_lecture.txt --lecture-id 1

# Dry run (print chunks only)
PYTHONPATH=backend python data-prep/chunk_lecture.py --transcript data-prep/sample_lecture.txt --lecture-id 1 --dry-run
```

## Current Project Structure

```
TeamTraction/
├── docker-compose.yml           # VectorAI DB + Actian Vector + FastAPI
├── CLAUDE.md                    # This file
├── README.md                    # Project overview
├── PLAN.md                      # 12-phase 35-hour plan with exit gates
├── TODO.md                      # Master checklist with phase tracking
├── TODO-backend.md              # Backend lead tasks
├── TODO-ai-ml.md                # AI/ML lead tasks
├── TODO-frontend.md             # Frontend lead tasks
├── TODO-pm.md                   # PM/Demo lead tasks
├── BRANCHES.md                  # Branch strategy for 4-person parallel work
├── GOAL.md                      # North star, success criteria, self-audit
├── WALKTHROUGH.md               # Technical walkthrough
├── mcp.json                     # MCP server definitions for AI services
├── mcp/                         # MCP server implementations
│   ├── vectorai_db_mcp.py
│   ├── vector_analytics_mcp.py
│   ├── embedder_mcp.py
│   ├── gemini_mcp.py
│   └── elevenlabs_mcp.py
├── backend/
│   ├── main.py                  # FastAPI app entry with lifespan, health check
│   ├── config.py                # Pydantic settings (.env support)
│   ├── logging_config.py        # Structured logging setup
│   ├── dependencies.py          # FastAPI dependency injection (singletons)
│   ├── requirements.txt
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py           # Pydantic models (StudentPing, ConfusionEvent, AnalogyRequest/Response, etc.)
│   │   └── database.py          # Actian Vector connection pool, retry decorator, DDL
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── websocket.py         # WebSocket hub: /ws/lecture/{lecture_id}
│   │   ├── retrieval.py         # Accio Analogy: /retrieval/accio, /demo, /cached
│   │   ├── analytics.py         # Pensieve: /analytics/top-moments, /density, /cohort-heatmap, /summary
│   │   └── asr.py               # Transcript chunk ingestion: /asr/ingest-chunk
│   ├── services/
│   │   ├── __init__.py
│   │   ├── embedder.py          # bge-small wrapper (singleton, encode_with_latency)
│   │   ├── vectorai_client.py   # Actian VectorAI DB (Qdrant) client
│   │   ├── vector_client.py     # Actian Vector analytics client (SQL)
│   │   ├── gemini_client.py     # Gemini analogy rewrite
│   │   ├── elevenlabs_client.py # ElevenLabs TTS
│   │   ├── whisper_service.py   # Whisper.cpp integration (stretch)
│   │   └── offline_cache.py     # Pre-cached analogy for offline demo
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_health.py
│       ├── test_schemas.py
│       ├── test_database.py
│       ├── test_websocket.py
│       ├── test_retrieval.py
│       ├── test_analytics.py
│       ├── test_embedder.py
│       ├── test_gemini_client.py
│       ├── test_elevenlabs_client.py
│       ├── test_vectorai_client.py
│       ├── test_vector_client.py
│       ├── test_asr.py
│       └── test_data_prep.py
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── next-env.d.ts
│   ├── public/
│   │   └── manifest.json        # PWA manifest
│   └── src/
│       ├── app/
│       │   ├── layout.tsx       # Global styles, fonts, design tokens
│       │   ├── page.tsx         # Landing page (Legilimens marketing)
│       │   ├── muffliato/
│       │   │   └── page.tsx     # Student PWA (Muffliato buttons + avatar picker)
│       │   └── dashboard/
│       │       ├── page.tsx     # Marauder's Radar (live D3 + Recharts)
│       │       └── pensieve/
│       │           └── page.tsx # Pensieve analytics dashboard
│       ├── components/
│       │   ├── landing/         # Landing page sections (Hero, ProblemSolution, etc.)
│       │   ├── radar/
│       │   │   └── RadarHeatmap.tsx  # D3 radial heatmap
│       │   ├── timeline/
│       │   │   └── Timeline.tsx    # Recharts confusion timeline
│       │   ├── overlay/         # Screen share + teacher alert overlays
│       │   └── ui/              # Shared UI (Button, Card, Badge, Section, ScrollReveal)
│       ├── hooks/
│       │   ├── useWebSocket.ts      # WebSocket connection + reconnect
│       │   ├── useRadarData.ts      # Aggregates WS messages for radar/timeline
│       │   └── useScreenShare.ts    # Screen capture API
│       ├── lib/
│       │   ├── api.ts               # FastAPI REST client
│       │   ├── types.ts             # TypeScript types (ConceptNode, TimelinePoint, etc.)
│       │   └── design-tokens.ts     # CSS custom properties (Hogwarts theme)
│       └── styles/
├── data-prep/
│   ├── chunk_lecture.py         # Timestamp-aware transcript chunking + embedding
│   ├── load_textbook.py         # Load textbook chapters to VectorAI DB
│   ├── sample_lecture.txt       # Pre-recorded backprop lecture transcript
│   └── backprop_notes.txt       # Textbook content for knowledge vault
├── scripts/
│   ├── benchmark_latency.py     # End-to-end latency measurement
│   └── test_mcp_servers.py      # MCP server test runner
└── whisper.cpp/                 # Git submodule or local build (stretch)
```

## Key Implementation Notes

### Actian VectorAI DB (Retrieval)
- **Protocol**: Qdrant-compatible gRPC on port 6574 (REST on 6573)
- **Python SDK**: `qdrant-client` (installed as `actian-vectorai` in requirements)
- **Collection**: `lecture_chunks` with 384-dim vectors (Cosine distance)
- **Payload schema**: `{topic: str, subtopic: str, difficulty: int, source: str, timestamp: float, text: str}`
- **Client**: `backend/services/vectorai_client.py` — `connect()`, `create_lecture_chunks_collection()`, `upsert_chunks()`, `search_similar()`, `health()`

### Actian Vector (Analytics)
- **Protocol**: ODBC/pyodbc on port 5432 (community Docker image)
- **Table**: `confusion_events` — columns: `event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort`
- **Key queries**: 
  - Top-3 confusing moments (`SUM(CASE WHEN signal_type='lost') GROUP BY concept_node ORDER BY lost_count DESC`)
  - Rolling 60s confusion density (window function)
  - Per-cohort heatmap (`GROUP BY cohort, concept_node`)
- **Client**: `backend/services/vector_client.py` — `insert_confusion_event()`, `get_top_confusing_moments()`, `get_confusion_density_timeline()`, `get_cohort_heatmap()`

### FastAPI WebSocket Hub
- **Endpoint**: `/ws/lecture/{lecture_id}?role=student|teacher`
- **Inbound message**: `{"type": "ping", "student_id": "...", "signal_type": "lost|gotit|slower"}`
- **Outbound broadcasts**:
  - `radar_update` — to all connections in lecture
  - `analogy_audio` — targeted to lost students (binary audio frames)
  - `confusion_alert` — to teacher connections
  - `latency_update` — retrieval latency for on-screen badge
- **Threshold logic**: ≥2 "lost" signals in 20s window on same `concept_node` → triggers Accio Analogy (30s cooldown per concept)
- **State**: In-memory per-lecture connection pools, sliding window for threshold

### Latency Targets (for demo visibility)
- Ping → Radar broadcast: **<100ms**
- VectorAI DB search: **<50ms**
- Embedding (bge-small): **<20ms** CPU
- Gemini rewrite: **~800ms**
- ElevenLabs TTS: **~600ms**
- **Total end-to-end: ~1.5s** (display live on dashboard badge)

### Demo Script (3 minutes)
1. **0:00-0:20** — Hook: "Professors, 40% silently drown — watch the radar catch it." Show empty radar.
2. **0:20-1:20** — Live play: 90s dense lecture (backprop). Judges press "🪄 I'm lost" at confusing moment. Radar flares red on "chain rule".
3. **1:20-2:00** — Actian moment: Badge shows "edge retrieval: 38ms · 0 cloud calls." VectorAI DB returns best explanation; Gemini rewrites for "cricketer"; ElevenLabs speaks it.
4. **2:00-2:40** — Pensieve: Confusion heatmap timeline, top-3 worst moments ranked by "students lost × minutes wasted", one-click "re-teach plan".
5. **2:40-3:00** — Punchline + unplug: "Runs entirely on school's server." Pull Ethernet cable. Radar still updates, retrieval still 38ms, analytics still query. Plug back in.

## Environment Variables

Create `.env` in `backend/` and `frontend/`:

```bash
# backend/.env
VECTORAI_HOST=localhost
VECTORAI_PORT=6574
VECTOR_HOST=localhost
VECTOR_PORT=5432
VECTOR_DATABASE=actian
VECTOR_USER=admin
VECTOR_PASSWORD=password
GEMINI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
WHISPER_MODEL_PATH=./models/ggml-base.en.bin

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Current Implementation Status (Phase Exit Gates)

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Foundation: Docker Compose, both DBs responding | ✅ **Done** |
| 1 | Data: Embedded content in VectorAI DB, search works | ✅ **Done** |
| 2 | Capture: Phone button → DB row + broadcast | ✅ **Done** |
| 3 | Radar: Two pings flare radar within ~1s | ✅ **Done** |
| 4 | Retrieval: <50ms measured (on-screen badge) | ✅ **Done** |
| 5 | Gemini: Analogy reads naturally for ≥2 avatars | ✅ **Done** |
| 6 | Voice: Student hears analogy within ~1.5s | 🟡 **In Progress** |
| 7 | Analytics: Pensieve renders real SQL data | ✅ **Done** |
| 8 | Offline: Cable-pull demo succeeds | 🟡 **In Progress** |
| 9 | Polish: Demo looks magical (HP theme) | ✅ **Done** |
| 10 | Rehearsal: Demo runs clean 3× | ⏳ **Pending** |
| 11 | Submission: Devfolio submitted | ⏳ **Pending** |

## Key Files for Common Tasks

| Task | File(s) |
|------|---------|
| Add new WebSocket message type | `backend/routers/websocket.py`, `frontend/src/lib/types.ts` |
| Modify retrieval pipeline | `backend/routers/retrieval.py`, `backend/services/vectorai_client.py` |
| Change radar visualization | `frontend/src/components/radar/RadarHeatmap.tsx` |
| Add Pensieve SQL query | `backend/routers/analytics.py`, `backend/services/vector_client.py` |
| Modify embedding model | `backend/services/embedder.py` |
| Change Gemini prompt | `backend/services/gemini_client.py` |
| Change TTS voice | `backend/services/elevenlabs_client.py` |
| Add test for WebSocket flow | `backend/tests/test_websocket.py` |
| Add frontend component test | `frontend/` (Jest/React Testing Library not yet configured) |

## Testing

### Backend
```bash
cd backend
pytest -v                    # All tests
pytest tests/test_websocket.py -v  # WebSocket tests
pytest tests/test_retrieval.py -v  # Retrieval pipeline tests
pytest tests/test_analytics.py -v  # Analytics SQL tests
```

### Frontend
```bash
cd frontend
npm run typecheck   # TypeScript compilation check
npm run lint        # ESLint
```

## Branch Strategy (4-person team)

| Member | Role | Branch | Owns |
|--------|------|--------|------|
| M1 | Backend / Actian | `dev/backend` | `backend/routers/*`, `backend/models/*`, `docker-compose.yml` |
| M2 | AI / ML | `dev/ai-ml` | `backend/services/*`, `data-prep/*`, `scripts/*` |
| M3 | Frontend | `dev/frontend` | `frontend/**`, `public/**` |
| M4 | Demo / PM | `dev/pm` | `README.md`, landing page, Devfolio, demo script |

See `BRANCHES.md` for merge/rebase workflow.

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `actian_vectorai` SDK install fails | Pre-install on all laptops; carry wheel on USB |
| Live ASR drifts / noisy room | Pre-record + pre-transcribe demo lecture; ASR is stretch, not core |
| Gemini/ElevenLabs latency spikes | Pre-cache one analogy for "unplug" moment; show latency badge |
| Actian Vector Docker slow to start | Bring up first (hour 0); verify with smoke query |
| "Just an engagement dashboard" perception | Lead demo with retrieval+rewrite loop; radar is hook, analogy is magic |

## Sponsor Tracks to Tag (Devfolio)
- **Actian** (primary) — Dual Actian DB architecture
- **Gemini** — Analogy rewrite
- **ElevenLabs** — Voice re-delivery
- **DigitalOcean** — Optional droplet for multi-school view
- **GitHub** — GitHub Pages landing page

## License

MIT License — Copyright (c) 2026 Sourodyuti Biswas Sanyal