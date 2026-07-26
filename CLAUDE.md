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
                                feat: implement timestamp-aware transcript chunking and add comprehensive unit testing for    ▼ (only anonymized text leaves)
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
| Edge Buffer | Actian Zen | Tiny-footprint embedded buffer for offline pings |
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

Since this is a greenfield project, here are the commands you'll use once the codebase is scaffolded:

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

# Run dev server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest -v

# Type check
mypy .
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
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en')"

# Test embedding
python -c "from sentence_transformers import SentenceTransformer; m=SentenceTransformer('BAAI/bge-small-en'); print(m.encode('test').shape)"
```

### Whisper.cpp (ASR)
```bash
# Build whisper.cpp (run once)
cd whisper.cpp && make base.en

# Test transcription
./main -m models/ggml-base.en.bin -f audio.wav
```

## Project Structure

```
TeamTraction/
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt        # Dependencies (actian-vectorai-client, etc.)
│   ├── config.py               # Settings via pydantic-settings
│   ├── dependencies.py         # FastAPI dependency injection
│   ├── logging_config.py       # Structured logging setup
│   ├── models/
│   │   ├── schemas.py          # Pydantic models
│   │   └── database.py         # Actian connection helpers
│   ├── routers/
│   │   ├── websocket.py        # WebSocket hub for live pings
│   │   ├── retrieval.py        # Accio Analogy endpoint
│   │   ├── analytics.py        # Pensieve SQL queries
│   │   └── asr.py              # Whisper transcript ingestion
│   ├── services/
│   │   ├── vectorai_client.py  # Actian VectorAI DB client
│   │   ├── vector_client.py    # Actian Vector (analytics) client
│   │   ├── embedder.py         # bge-small wrapper (384-dim)
│   │   ├── gemini_client.py    # Analogy rewrite (gemini-2.5-flash)
│   │   ├── gemini_vision.py    # Screen context detection
│   │   ├── elevenlabs_client.py # TTS (eleven_flash_v2_5)
│   │   ├── offline_cache.py    # Pre-cached analogies for demo
│   │   └── whisper_service.py  # ASR integration
│   └── tests/                  # Pytest test suite
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── muffliato/            # Student PWA
│   │   │   └── dashboard/            # Teacher dashboard
│   │   │       ├── page.tsx          # Marauder's Radar
│   │   │       └── pensieve/         # Pensieve analytics
│   │   ├── components/
│   │   │   ├── landing/              # Landing page components
│   │   │   ├── radar/                # D3 radial heatmap
│   │   │   ├── timeline/             # Recharts timeline
│   │   │   ├── overlay/              # Screen share overlays
│   │   │   └── ui/                   # Shared UI components
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useRadarData.ts
│   │   │   └── useScreenShare.ts
│   │   └── lib/
│   │       ├── api.ts                # FastAPI client
│   │       ├── types.ts              # TypeScript types
│   │       └── design-tokens.ts      # Hogwarts theme colors
│   └── public/
├── data-prep/
│   └── sample_lecture.txt            # Pre-recorded lecture transcript
├── scripts/
│   ├── start_demo.sh               # One-command demo start
│   └── demo_setup.sh               # Pre-load demo data
└── docker-compose.yml               # Docker orchestration
```

## Key Implementation Notes

### Actian VectorAI DB
- REST on port 6573, gRPC on 6574, LocalUI on 6575
- Docker: `docker run -d --name vectorai -p 6573-6575:6573-6575 -e ACTIAN_VECTORAI_ACCEPT_EULA=YES actian/vectorai:latest`
- Python SDK: `actian-vectorai-client` (pip install)
- No auth required for local dev
- Collection: `lecture_chunks` with 384-dim vectors (Cosine distance)
- Payload schema: `{topic: str, subtopic: str, difficulty: int, source: str, timestamp: float}`
- License Key: Apply via LocalUI at http://localhost:6575 (Community Edition: 5,000 vectors, Trial: 1M vectors)

### Actian Vector (Analytics)
- Community Docker image: `actian/vector5.0:community`
- Columnar SQL via pyodbc/ingres
- Table: `confusion_events` with columns: `event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort`
- Key queries: top-3 confusing moments, rolling 60s confusion density, per-cohort heatmaps

### FastAPI WebSocket Hub
- Endpoint: `/ws/lecture/{lecture_id}`
- Message types: `ping` (student), `radar_update` (broadcast), `analogy_audio` (targeted)
- Manages connection pools per lecture

### Latency Targets (for demo visibility)
- Ping → Radar: <100ms
- VectorAI DB search: <50ms
- Gemini rewrite: ~800ms
- ElevenLabs TTS: ~600ms
- **Total: ~1.5s** (display these live on dashboard)

### Demo Script (3 minutes)
1. **0:00-0:20** — Hook: "Professors, 40% silently drown — watch the radar catch it." Show empty radar.
2. **0:20-1:20** — Live play: 90s dense lecture (backprop). Judges press "🪄 I'm lost" at confusing moment. Radar flares red on "chain rule".
3. **1:20-2:00** — Actian moment: Badge shows "edge retrieval: 38ms · 0 cloud calls." VectorAI DB returns best explanation; Gemini rewrites for "cricketer"; ElevenLabs speaks it.
4. **2:00-2:40** — Pensieve: Confusion heatmap timeline, top-3 worst moments ranked by "students lost × minutes wasted", one-click "re-teach plan".
5. **2:40-3:00** — Punchline + unplug: "Runs entirely on school's server." Pull Ethernet cable. Radar still updates, retrieval still 38ms, analytics still query. Plug back in.

## Environment Variables

Create `.env` file in `backend/`:

```bash
# backend/.env
# Actian VectorAI DB (retrieval brain)
VECTORAI_HOST=localhost
VECTORAI_PORT=6574
VECTORAI_COLLECTION=lecture_chunks
VECTORAI_DIM=384

# Actian Vector (columnar analytics)
VECTOR_HOST=localhost
VECTOR_PORT=5432
VECTOR_DATABASE=actian
VECTOR_USER=admin
VECTOR_PASSWORD=password

# Cloud generative step
GEMINI_API_KEY=your_gemini_key
ELEVENLABS_API_KEY=your_elevenlabs_key

# Whisper.cpp (ASR — stretch goal)
WHISPER_MODEL_PATH=./models/ggml-base.en.bin

# CORS origins for frontend
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

## Important Implementation Order (35-hour plan)

1. **Hours 0-2**: Docker Compose up (VectorAI DB + Actian Vector + FastAPI skeleton), verify SDK connects, create `lecture_chunks` collection
2. **Hours 2-4**: Data prep — pre-record 5-min dense lecture, chunk + embed, pre-load textbook chapter into VectorAI DB
3. **Hours 4-7**: Capture — Muffliato PWA + WebSocket pipeline; pings land in FastAPI → Actian Vector
4. **Hours 7-9**: Radar viz — D3 radial heatmap + timeline; live WebSocket feed
5. **Hours 9-12**: Retrieval loop — Accio Analogy threshold trigger → VectorAI DB search → top-3 retrieval with latency badge
6. **Hours 12-15**: Generative — Gemini analogy rewrite with student interest profile
7. **Hours 15-17**: Voice — ElevenLabs TTS streaming back to phone
8. **Hours 17-19**: Analytics — Actian Vector SQL for top-3 worst moments, per-cohort heatmap; Pensieve dashboard
9. **Hours 19-21**: Offline mode — Pre-cache one analogy; verify "unplug Ethernet" → retrieval+radar+analytics still work
10. **Hours 21-23**: Polish + HP theme — Spell names, golden snitch loader, Hogwarts CSS; landing page
11. **Hours 23-25**: Rehearsal — 3 dry runs of 3-min demo; fix latency spikes
12. **Hours 25-27**: Buffer / bug fix
13. **Hours 27-30**: Devfolio submission — README, architecture diagram, 90-sec demo video, deploy dashboard
14. **Hours 30-35**: Sleep + final demo prep

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