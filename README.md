# Legilimens 🔮

> A real-time "mind-reading" layer for live classrooms. It detects *where* and *when* students collectively get lost, then instantly re-explains that exact moment using a freshly-generated analogy pulled from each student's own interest graph — with all retrieval running **on-prem on Actian VectorAI DB** so student data never leaves the building.

*"Professors, you've all taught a room where 40% silently drowned — and you never knew. **Legilimens** is the radar that catches it, and the spell that fixes it, in under a second, on the school's own server."*

Built for a Harry-Potter-themed hackathon. Every component carries a spell name:

| Spell | Component | What it does |
|---|---|---|
| **Muffliato** | Confusion capture | Quietly listens to "I'm lost" pings without disrupting class |
| **Marauder's Radar** | Real-time viz | Shows where minds are wandering, live (D3 radial heatmap) |
| **Accio Analogy** | Retrieval engine | Summons the best past explanation from the school's knowledge vault (Actian VectorAI DB) |
| **Gemino** | Analogy rewriter | Reshapes the explanation in the student's language (Gemini) |
| **Sonorus** | Voice re-delivery | Speaks the analogy back, calmly (ElevenLabs) |
| **Pensieve** | Teacher analytics | Re-view the lecture's worst moments and re-teach plans (Actian Vector) |

---

## Architecture

```mermaid
flowchart LR
  subgraph EDGE["Edge / Classroom (student phones + 1 Pi)"]
    P1["📱 Student Phone<br/>Muffliato web-buttons"]
    P2["🎤 Whisper.cpp<br/>local ASR"]
    P3["🍓 Pi / laptop<br/>Actian Zen buffer"]
  end
  subgraph CORE["On-Prem 'School Server' (1 laptop, Docker)"]
    ADB["Actian VectorAI DB<br/>:6573 REST / :6574 gRPC<br/>semantic retrieval + agent memory"]
    AVEC["Actian Vector Analytics<br/>columnar SQL<br/>confusion time-series analytics"]
    API["FastAPI orchestrator<br/>WebSocket + REST"]
    EMB["bge-small embedder<br/>local, 384-dim"]
  end
  subgraph CLOUD["Cloud (generative step only)"]
    GEM["Gemini API<br/>analogy rewrite"]
    ELE["ElevenLabs<br/>voice re-delivery"]
  end
  subgraph UI["Teacher Dashboard"]
    RAD["Marauder's Radar<br/>D3 radial heatmap + timeline"]
    PEN["Pensieve analytics<br/>top confusing moments"]
  end
  P1 -- WebSocket pings --> API
  P2 -- transcript chunks --> EMB
  P3 -- sync when online --> API
  EMB -- vectors --> ADB
  API -- semantic search --> ADB
  API -- SQL analytics --> AVEC
  API -- analogy prompt --> GEM
  GEM -- rewritten analogy --> API
  API -- TTS text --> ELE
  ELE -- audio --> P1
  API -- live radar feed --> RAD
  AVEC -- aggregated stats --> PEN
```

The defining structural choice: **the entire student-data path (capture → embed → retrieve → analytics) lives inside the "school server" laptop.** Only the final analogy rewrite + voice cross the network, and that payload is anonymized text. Pull the Ethernet cable and the radar, retrieval, and analytics still work — that's the Actian edge thesis made physical.

---

## Bring-up (2 commands)

```bash
# 1. Start all services (Actian VectorAI DB, Actian Vector, FastAPI)
docker-compose up -d

# 2. Run the dev servers
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --host 0.0.0.0 --port 8000
# in another terminal:
cd frontend && npm install && npm run dev
```

Whisper.cpp (local ASR) is optional for the core demo — see `whisper.cpp/` build instructions below.

> ⚠️ **Verify Docker images:** The exact Actian Docker image names must be confirmed against Actian's docs before first `docker-compose up`. See the `# TODO VERIFY` markers in `docker-compose.yml`.

---

## Project Structure

```
TeamTraction/
├── docker-compose.yml        # VectorAI DB + Actian Vector + FastAPI
├── backend/                  # FastAPI orchestrator (WebSocket hub, retrieval, analytics)
├── frontend/                 # Next.js 14 PWA (Muffliato) + Teacher Dashboard (Radar, Pensieve)
├── data-prep/                # Chunk + embed lecture / textbook into VectorAI DB
├── scripts/                  # Demo setup + latency benchmarking
└── whisper.cpp/              # Local ASR (clone + build — see below)
```

---

## Whisper.cpp (optional, for the ASR stretch goal)

```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp && make base.en
# Test:
./main -m models/ggml-base.en.bin -f audio.wav
```

The core demo uses a **pre-recorded, pre-transcribed** lecture, so Whisper is a stretch goal, not a dependency.

---

## Planning Docs

- [`GOAL.md`](./GOAL.md) — north star, success criteria, scope, self-audit
- [`PLAN.md`](./PLAN.md) — 12 milestone phases with hour budgets
- [`TODO.md`](./TODO.md) — granular actionable checklist
- [`CLAUDE.md`](./CLAUDE.md) — AI-assistant guidance + full technical detail
- [`# Legilimens — Full Build Blueprint.md`](./#%20Legilimens%20—%20Full%20Build%20Blueprint.md) — the original spec

---

## Sponsor Tracks

**Actian** (primary) · Gemini · ElevenLabs · DigitalOcean · GitHub — **Education** track.

## License

MIT License — Copyright (c) 2026 Sourodyuti Biswas Sanyal. See [`LICENSE`](./LICENSE).
