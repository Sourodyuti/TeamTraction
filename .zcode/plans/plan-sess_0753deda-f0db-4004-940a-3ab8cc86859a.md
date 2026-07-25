# Legilimens — Planning Artifacts + Repository Scaffolding

## What I'm producing
Two deliverables: **(A) three planning docs** (`GOAL.md`, `PLAN.md`, `TODO.md`) and **(B) the code repository scaffold** so the team can start building immediately. Logical milestone phases, each tagged with the hour budget from the blueprint so you keep time awareness.

---

## A. Planning Documents

### `GOAL.md` — North star + success criteria
- Problem statement ("40% silently drown — and you never knew")
- One-line pitch / tagline
- The single judge-memorable moment (Ethernet-pull demo)
- Explicit success criteria / definition of "done"
- What's in-scope vs. stretch goals
- Sponsor tracks to tag (Actian primary; Gemini, ElevenLabs, DigitalOcean, GitHub)
- Self-audit against the 5 judging criteria (Completion, Creativity, Technical Complexity, UX, Impact/Feasibility)

### `PLAN.md` — Phase-by-phase plan (logical milestones + hour budgets)
Restructures the blueprint's 35-hour timeline into 12 milestone phases, each with: goal, components, deliverables, exit criterion, and hour budget:

| # | Phase | Hours | Exit criterion |
|---|---|---|---|
| 0 | Foundation & Scaffolding | 0–2 | Both Actian DBs respond to a test query |
| 1 | Data Foundation | 2–4 | `search()` returns sensible hits |
| 2 | Capture Layer (Muffliato) | 4–7 | Phone button lights up radar dot |
| 3 | Radar Viz (Marauder's Radar) | 7–9 | Judge sees confusion flare on cue |
| 4 | Retrieval Loop (Accio Analogy) | 9–12 | Retrieval returns <50ms on screen |
| 5 | Generative Rewrite (Gemini/Gemino) | 12–15 | Analogy reads naturally |
| 6 | Voice Re-delivery (Sonorus) | 15–17 | Student hears the analogy |
| 7 | Analytics & Pensieve | 17–19 | Dashboard renders real queries |
| 8 | Offline Edge Mode | 19–21 | Cable-pull demo succeeds |
| 9 | Polish & HP Theme | 21–23 | Demo looks magical |
| 10 | Rehearsal & Buffer | 23–27 | Demo runs clean 3× |
| 11 | Submission & Final Demo | 27–35 | Submitted; team rested |

Each phase maps to the role split (Backend/Actian lead, AI/ML lead, Frontend lead, Demo/PM lead) and notes the stretch-goal dependencies.

### `TODO.md` — Granular actionable checklist
Checkbox tasks grouped by phase, plus a "Pre-hackathon prep" section (pre-install SDK on USB, pre-record lecture, API keys) and a "Devfolio submission" checklist pulled straight from the blueprint (§13).

---

## B. Repository Scaffolding

Per the planned structure in `CLAUDE.md`. Every file is a working stub (real imports, real signatures, TODO markers where logic lands) — not a 0-byte placeholder — so `docker-compose up` and `uvicorn main:app` boot immediately.

### Root
- `README.md` — overview + "bring-up in 2 commands" + architecture diagram (the Mermaid from the blueprint)
- `docker-compose.yml` — Actian VectorAI DB (`:6573`/`:6574`), Actian Vector Community, FastAPI service. *Note: I'll use the documented ports and mark the exact VectorAI DB Docker image name as a `# TODO VERIFY` line, since the blueprint doesn't state it verbatim — the team must confirm against Actian's docs.*
- `.env.example` — consolidated env template

### `backend/` (FastAPI + Python 3.11)
- `main.py` — app factory, CORS, mounts routers, `/health`
- `config.py` — `pydantic-settings` Settings
- `requirements.txt` — fastapi, uvicorn, actian_vectorai, pyodbc, sentence-transformers, google-genai, elevenlabs, websockets, pydantic-settings
- `routers/` — `websocket.py` (hub `/ws/lecture/{id}`), `retrieval.py` (Accio Analogy), `analytics.py` (Pensieve SQL), `asr.py` (Whisper ingest)
- `services/` — `vectorai_client.py`, `vector_client.py`, `embedder.py` (bge-small), `gemini_client.py`, `elevenlabs_client.py`, `whisper_service.py` — each with a thin client class + method stubs
- `models/schemas.py` — Pydantic models for ping, chunk, confusion event, analogy request
- `models/database.py` — Actian connection helpers
- `tests/test_health.py` — smoke test
- `.env.example`

### `frontend/` (Next.js 14 + TypeScript)
- `package.json`, `next.config.js`, `tsconfig.json`
- `src/app/page.tsx` — Muffliato PWA landing (big 🪄/✅/⏩ buttons)
- `src/app/dashboard/page.tsx` — Marauder's Radar shell
- `src/app/dashboard/pensieve/page.tsx` — Pensieve shell
- `src/components/radar/RadarHeatmap.tsx` — D3 radial heatmap stub
- `src/components/timeline/Timeline.tsx` — Recharts timeline stub
- `src/hooks/useWebSocket.ts`, `src/hooks/useRadarData.ts`
- `src/lib/api.ts` (FastAPI client), `src/lib/types.ts`
- `.env.example`

### `data-prep/`
- `chunk_lecture.py` — chunk + embed transcript → VectorAI DB
- `load_textbook.py` — load textbook chapter → VectorAI DB
- `sample_lecture.txt` — placeholder for the pre-recorded backprop lecture

### `scripts/`
- `demo_setup.sh` — pre-load demo data
- `benchmark_latency.py` — latency measurement for the on-screen badge

### Updates
- `.gitignore` — ensure `node_modules/`, `__pycache__/`, `.env`, `whisper.cpp/models/`, `*.bin` are covered (verify against existing file)
- `CLAUDE.md` — no changes needed; it already documents the structure I'm following

---

## Honest caveats (so there are no surprises)
1. **Exact Docker image names** for the two Actian products aren't stated verbatim in the blueprint. I'll scaffold with documented ports and clearly-marked `# TODO VERIFY` comments rather than guess an image tag that could fail to pull.
2. **`whisper.cpp/`** — I'll reference it in `.gitignore` and the README as a build step rather than vendoring a large binary; the team runs `git clone` + `make base.en` per the CLAUDE.md instructions.
3. All code is **stubs that compile/boot**, not full implementations — the phases in `PLAN.md` describe where the real logic goes.

## Tools I'll use
- `Write` for all new files (planning docs + scaffold)
- `Read` + `Edit` only if `.gitignore` needs additions
- No bash/build/test runs in this step — you can run `docker-compose up` / `npm install` yourself once scaffolding lands.