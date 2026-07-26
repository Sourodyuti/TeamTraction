# Context Export — Legilimens Project

**Generated:** July 26, 2026 (Checkpoint 5 — Post Full Audit)
**Session Context:** Full project context for AI assistant handoff

---

## 1. PROJECT OVERVIEW

**Legilimens (TeamTraction)** — A Harry Potter themed real-time classroom confusion detection system for the Actian Hackathon (July 24–26, 2026).

**Core Flow:**
1. Students press "I'm lost" / "Got it" / "Slower" buttons on their phones (Muffliato PWA)
2. Teachers see a real-time D3 radial heatmap of concept-level confusion (Marauder's Radar)
3. When ≥2 students signal "lost" within 20s, the system auto-triggers an AI analogy pipeline
4. Analogy is rewritten by Gemini, voiced by ElevenLabs, delivered to student phones as audio
5. Teacher sees a floating Cluely-style overlay (ConfusionOverlay) with current topic + alert
6. Entire lecture is recorded in rolling audio buffer; transcribed live by faster-whisper
7. Every transcript chunk is immediately embedded and upserted into the live knowledge base

---

## 2. PROJECT STRUCTURE

```
TeamTraction/
├── backend/
│   ├── main.py                    # FastAPI app entry, health endpoint
│   ├── config.py                  # Settings (VECTORAI_PORT=6574, BACKEND_PORT=8001)
│   ├── dependencies.py            # FastAPI dependency injection
│   ├── logging_config.py          # Structured logging
│   ├── requirements.txt           # Dependencies (incl. faster-whisper, aiofiles)
│   ├── .env                       # API keys + MongoDB URI + JWT secret
│   ├── models/
│   │   ├── schemas.py             # Pydantic models (StudentPing, AnalogyResponse, RecordingChunk, etc.)
│   │   └── database.py            # Actian Vector connection pool
│   ├── routers/
│   │   ├── websocket.py           # /ws/lecture/{id} WebSocket hub
│   │   ├── retrieval.py           # /retrieval/accio + /retrieval/audio/{job_id}
│   │   ├── analytics.py           # /analytics/* (real Actian Vector SQL, 503 if pyodbc unavailable)
│   │   ├── asr.py                 # /asr/ingest-chunk, /asr/current-chunk
│   │   ├── auth.py                # /auth/register, /auth/login, /auth/me (MongoDB + JWT)
│   │   ├── recording.py           # /recording/{lecture_id}/chunk, /manifest, WebSocket stream
│   │   └── transcription.py       # /transcription/upload, /transcription/live/{lecture_id} (WebSocket)
│   ├── services/
│   │   ├── vectorai_client.py     # Actian VectorAI DB (actian-vectorai-client SDK)
│   │   ├── vector_client.py       # Actian Vector analytics client
│   │   ├── embedder.py            # bge-small-en (384-dim)
│   │   ├── gemini_client.py       # Gemini API (gemini-2.5-flash)
│   │   ├── gemini_vision.py       # Gemini Vision for screen context
│   │   ├── elevenlabs_client.py   # ElevenLabs TTS (eleven_flash_v2_5) + get_audio_url()
│   │   ├── offline_cache.py       # Pre-cached analogies for cable-pull demo
│   │   ├── whisper_service.py     # faster-whisper (base.en, CPU, int8)
│   │   ├── recording_service.py   # Rolling 5-min audio buffer, manifest, disk persistence
│   │   ├── knowledge_base.py      # Live knowledge base: in-memory index + VectorAI upsert
│   │   └── mongodb_client.py      # MongoDB Atlas client (auth/user storage)
│   └── tests/                     # Pytest test suite
├── frontend/
│   ├── package.json               # Next.js 14, React 18, D3, Recharts
│   ├── .env.local                 # NEXT_PUBLIC_API_URL=http://localhost:8001
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Landing page (Harry Potter themed)
│       │   ├── login/page.tsx     # Login (redirects teacher→/dashboard, student→/muffliato)
│       │   ├── register/page.tsx  # Register with role selector
│       │   ├── muffliato/         # Student PWA (thumb buttons + analogy display + toast)
│       │   ├── overlay/           # Stealth overlay page (loaded by Electron)
│       │   └── dashboard/
│       │       ├── page.tsx       # Teacher dashboard (radar + ConfusionOverlay + REC badge)
│       │       ├── pensieve/      # Analytics (density chart + cohort heatmap + Re-teach)
│       │       └── review/        # Lecture recording review (real API + audio playback)
│       ├── components/
│       │   ├── landing/           # Hero, Architecture, Team, Sponsors, LiveDemo, etc.
│       │   ├── radar/             # RadarHeatmap (D3)
│       │   ├── timeline/          # Timeline (Recharts)
│       │   ├── capture/           # ScreenCapturePanel
│       │   ├── overlay/           # ConfusionOverlay, ScreenShare, TeacherAlert, StudentAnalogy
│       │   └── ui/                # Badge, Button, Card, ScrollReveal, Section
│       ├── hooks/
│       │   ├── useWebSocket.ts    # WebSocket hook with role param
│       │   ├── useRadarData.ts    # Radar + confusion_alert + analogy_ready + transcript_update
│       │   ├── useScreenCapture.ts # getDisplayMedia + MediaRecorder → /transcription/live WS
│       │   ├── useScreenShare.ts  # Re-export of useScreenCapture (deduplication)
│       │   ├── useOverlayState.ts # Overlay position/opacity persisted to localStorage
│       │   └── useAuth.ts         # JWT auth hook (read/store legilimens_token)
│       └── lib/
│           ├── api.ts             # REST client — all endpoints, JWT auth headers, error extraction
│           ├── types.ts           # TypeScript types (mirrors Pydantic schemas)
│           └── design-tokens.ts   # Hogwarts theme
├── stealth-client/
│   ├── main.js                    # Electron main — transparent, frameless, alwaysOnTop window
│   ├── package.json               # electron devDep
│   └── README.md                  # How to run the overlay
├── scripts/
│   ├── start_demo.sh              # One-command startup
│   ├── benchmark_latency.py       # Latency tests
│   └── seed_chunks.py             # Seeds 5 lecture chunks into VectorAI DB
├── docker-compose.yml             # Dev compose (port 8001, VectorAI)
├── docker-compose.prod.yml        # Production compose (DigitalOcean)
├── DEPLOY.md                      # DigitalOcean deployment guide
├── handoff.md                     # Handoff doc (always keep current)
├── context.md                     # This file
└── README.md
```

---

## 3. KEY ARCHITECTURE DECISIONS

### Auth (MongoDB Atlas + JWT)
- `bcrypt` used directly (NOT passlib — passlib 1.7.4 crashes on Python 3.14 with bcrypt 4.x)
- JWT secret: `LEGILIMENS_SECRET` env var
- Token stored in browser `localStorage` as `legilimens_token`
- All API calls send `Authorization: Bearer <token>` header
- Student ID persisted to `localStorage` as `legilimens_student_id`

### Screen Capture + Overlay (Cluely-style)
- **Electron stealth client** (`stealth-client/`) loads `http://localhost:3000/overlay` in a transparent, frameless, always-on-top Electron window
- On **Windows/macOS**: auto-selects primary screen via `setDisplayMediaRequestHandler` (no popup)
- On **Linux Wayland**: uses PipeWire (`--enable-features=WebRTCPipeWireCapturer`), shows native portal dialog
- On **Linux X11**: auto-selects like Windows
- **Frontend `useScreenCapture` hook**: sends audio chunks every 3s via WebSocket to `/transcription/live/{lectureId}`

### Live Knowledge Base
- Every transcript chunk → `knowledge_base.index_chunk()` → embed → VectorAI upsert (synchronous)
- In-memory reverse index: `{lecture_id: [{chunk_id, topic_node, ts, text_preview}]}`
- Students can query late: `search_knowledge(query, lecture_id)` returns most relevant past chunks

### Recording Buffer
- Rolling 5-min in-memory deque + disk persistence to `backend/recordings/{lecture_id}/{ts}.webm`
- Manifest: `backend/recordings/{lecture_id}/manifest.json`
- Served via `/recording/{lecture_id}/chunk/{chunk_id}`

### Faster-Whisper
- Model: `base.en`, device: `cpu`, compute_type: `int8`
- `transcribe_stream_chunk(audio_bytes) -> str` for live WebSocket transcription
- Auto-injects each transcript into ASR pipeline → knowledge base → dashboard broadcast

---

## 4. CONFIGURATION

### backend/.env
```bash
VECTORAI_HOST=localhost
VECTORAI_PORT=6574
VECTORAI_COLLECTION=lecture_chunks
VECTORAI_DIM=384

GEMINI_API_KEY=<your_key>
ELEVENLABS_API_KEY=<your_key>

MONGODB_URI=mongodb+srv://***REDACTED_MONGO_USER***:<password>@***REDACTED_MONGO_HOST***/?appName=Cluster0
MONGODB_DB_NAME=legilimens
LEGILIMENS_SECRET=<jwt_secret>
LEGILIMENS_PASSWORD=Legilimens2026

CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
```

### frontend/.env.local
```bash
NEXT_PUBLIC_API_URL=http://localhost:8001
```

---

## 5. RUNNING COMMANDS

```bash
# Terminal 1: VectorAI DB
docker start vectorai
# First time: docker run -d --name vectorai -p 6573-6575:6573-6575 \
#   -e ACTIAN_VECTORAI_ACCEPT_EULA=YES actian/vectorai:latest

# Terminal 2: Backend
cd /home/souro/Downloads/TeamTraction/backend
source ../.venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001

# Terminal 3: Frontend
cd /home/souro/Downloads/TeamTraction/frontend
npm run dev

# Terminal 4: Stealth Electron Overlay (optional, teacher-side)
cd /home/souro/Downloads/TeamTraction/stealth-client
npm start

# One-time seed (run after docker restart)
cd /home/souro/Downloads/TeamTraction
source .venv/bin/activate
python scripts/seed_chunks.py
```

---

## 6. API ENDPOINTS (COMPLETE)

### Backend (port 8001)
| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /health | Health check + services map | ✅ Working |
| WS | /ws/lecture/{id}?role={role} | WebSocket hub | ✅ Working |
| POST | /auth/register | Register user (teacher/student) | ✅ Working |
| POST | /auth/login | Login → JWT token | ✅ Working |
| GET | /auth/me | Get current user | ✅ Working |
| POST | /asr/ingest-chunk | Ingest transcript chunk | ✅ Working |
| GET | /asr/current-chunk | Get latest chunk | ✅ Working |
| POST | /retrieval/accio | Full analogy pipeline | ✅ Working |
| GET | /retrieval/accio/demo | Demo with defaults | ✅ Working |
| GET | /retrieval/audio/{job_id} | Serve generated audio | ✅ Working |
| GET | /analytics/top-moments | Top confusing moments | ⚠️ 503 without pyodbc |
| GET | /analytics/density | Confusion density timeline | ⚠️ 503 without pyodbc |
| GET | /analytics/cohort-heatmap | Cohort heatmap | ⚠️ 503 without pyodbc |
| GET | /analytics/summary | Lecture summary | ⚠️ 503 without pyodbc |
| POST | /recording/{id}/chunk | Store audio chunk | ✅ Working |
| GET | /recording/{id}/manifest | List all chunks | ✅ Working |
| GET | /recording/{id}/chunk/{cid} | Serve audio chunk | ✅ Working |
| WS | /recording/{id}/stream | Live recording stream | ✅ Working |
| POST | /transcription/upload | Upload audio file → Whisper | ✅ Working |
| WS | /transcription/live/{id} | Live audio → Whisper → KB | ✅ Working |
| GET | /transcription/status | Whisper model status | ✅ Working |

### Frontend (port 3000)
| Path | Description | Auth |
|------|-------------|------|
| / | Landing page | None |
| /login | Login form | None |
| /register | Register with role | None |
| /muffliato | Student PWA | student |
| /dashboard | Teacher dashboard + overlay | teacher |
| /dashboard/pensieve | Analytics charts | teacher |
| /dashboard/review | Recording review + search | teacher |
| /overlay | Stealth Electron overlay page | None |

---

## 7. FRONTEND lib/api.ts — ALL METHODS

```typescript
api.health()
api.getTopMoments(lectureId, limit?)
api.getDensity(lectureId)
api.getCohortHeatmap(lectureId)
api.getSummary(lectureId)
api.getManifest(lectureId)
api.getChunkAudioUrl(lectureId, chunkId)   // Returns URL string (no fetch)
api.triggerAnalogy(lectureId, conceptNode, chunkText?, avatar?)
api.triggerAccio(conceptNode, chunkText)    // Legacy alias
api.ingestChunk({ text, topic_node?, lecture_id?, ts?, difficulty?, source? })
```
All methods auto-attach `Authorization: Bearer <token>` from `localStorage.legilimens_token`.

---

## 8. KNOWN ISSUES & RESOLUTIONS

| Issue | Resolution |
|-------|-----------|
| `passlib` crashes on Python 3.14 + bcrypt 4.x | Use `bcrypt` library directly in auth.py |
| `pyodbc` / `unixodbc` not installed locally | analytics.py raises 503; acceptable for local dev |
| Wayland screen capture dialog | `--enable-features=WebRTCPipeWireCapturer` in Electron |
| Review page had hardcoded mock data | Fixed — real API fetch + real audio playback |
| Pensieve page had TODO comments | Fixed — full rewrite with SVG charts |
| `useScreenShare` was a duplicate hook | Fixed — re-exports `useScreenCapture` |
| Missing CSS vars (`--gryffindor-gold` etc.) | Fixed in globals.css |
| `api.ts` missing JWT auth + 6 endpoints | Fixed — complete rewrite |
| `types.ts` missing `chunk_update` ServerMessage | Fixed |
| Debug JSON footer visible to students | Fixed in muffliato/page.tsx |
| Student ID regenerated on each render | Fixed — persisted via localStorage |

---

## 9. TESTING STATUS

### Backend
- ✅ Auth: register + login verified (MongoDB Atlas)
- ✅ Embedder: 384-dim vectors
- ✅ VectorAI: 5 seed chunks loaded
- ✅ Retrieval pipeline: embed→retrieve→Gemini→ElevenLabs verified
- ✅ Recording service: chunk storage + manifest
- ✅ Transcription: faster-whisper base.en
- ⚠️ Analytics SQL: 503 locally (no unixodbc); works on full Docker stack

### Frontend
- ✅ TypeScript: 0 errors (`npm run typecheck` clean)
- ✅ All 11 pages/routes compile
- ✅ Auth flow: login/register/redirect by role
- ✅ Student PWA: WebSocket, signal buttons, toast, audio playback
- ✅ Teacher Dashboard: radar, overlay always-visible, REC badge, lecture selector
- ✅ Pensieve: SVG bar chart, cohort heatmap, shimmer skeletons, Re-teach
- ✅ Recording Review: real manifest fetch, real audio playback, semantic search
- ✅ Overlay page: loads in Electron stealth window

---

## 10. SPONSOR REQUIREMENTS

| Sponsor | Requirement | Implementation | Status |
|---------|-------------|----------------|--------|
| Actian VectorAI | Vector search | `actian-vectorai-client`, port 6574, 384-dim | ✅ 2ms retrieval |
| Actian Vector SQL | Columnar analytics | pyodbc SQL queries in analytics.py | ⚠️ 503 locally |
| Google Gemini | Analogy rewrite | `gemini-2.5-flash`, rewrite_analogy() | ✅ Verified |
| ElevenLabs | TTS voice | `eleven_flash_v2_5`, base64 audio URI | ✅ Verified |

---

## 11. DEPLOYMENT (DIGITALOCEAN)

- `docker-compose.prod.yml` ready with Nginx proxy + SSL
- `DEPLOY.md` has full DigitalOcean Droplet instructions
- `backend/.env.prod.example` has production env template
- **User confirmed:** run locally first, deploy later

---

## 12. NEXT TASKS

1. [ ] Pre-cache one analogy for cable-pull demo: `python scripts/demo_setup.sh`
2. [ ] Switch Gemini model to `gemini-2.0-flash-lite` to reduce 12s → ~800ms latency
3. [ ] Test WebSocket confusion threshold trigger end-to-end (2 students → auto Accio)
4. [ ] Test stealth Electron overlay on Windows
5. [ ] Seed VectorAI DB before each demo: `python scripts/seed_chunks.py`
6. [ ] Practice 3-minute demo script

---

## END OF CONTEXT
