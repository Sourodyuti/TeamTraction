# ✅ TODO — Legilimens

> The actionable checklist. Phases mirror `PLAN.md`. Check things off as you go; if a box stays unchecked past its hour budget, escalate. Owners: **BE** = Backend/Actian, **AI** = AI/ML, **FE** = Frontend, **PM** = Demo/PM.

---

## 🎒 Pre-Hackathon Prep (do BEFORE the clock starts)

- [ ] **API keys secured:** Gemini API key, ElevenLabs API key (PM)
- [ ] **`actian_vectorai` wheel on a USB** in case venue Wi-Fi blocks pip (BE)
- [ ] **All laptops have Python 3.11 + Node 20 + Docker** installed and verified (all)
- [ ] **Pre-recorded 5-min backprop lecture** audio + transcript ready (PM)
- [ ] **Textbook chapter** (3B1B-style backprop notes) sourced and cleaned (PM)
- [ ] **`whisper.cpp` cloned + `make base.en`** run on at least one laptop (AI)
- [ ] **`bge-small-en` model pre-downloaded** so first embed isn't a venue-Wi-Fi gamble (AI)
- [ ] **GitHub repo created**, all members have push access (PM)
- [ ] **Devfolio account + team registered** (PM)
- [ ] **Physical props:** 3 buzzers (or a phone page), an Ethernet cable for the unplug demo (PM)

---

## Phase 0 — Foundation & Scaffolding (Hours 0–2)

- [ ] Write `docker-compose.yml`: VectorAI DB (`:6573`/`:6574`) + Actian Vector Community + FastAPI (BE)
- [ ] Confirm exact Actian Docker image names against Actian docs (BE) ⚠️
- [ ] `docker-compose up -d` brings all 3 services up cleanly (BE)
- [ ] FastAPI skeleton: `main.py` app factory, `/health` returns 200 (BE)
- [ ] `config.py` with `pydantic-settings` reads `.env` (BE)
- [ ] `actian_vectorai` SDK connects to VectorAI DB (BE)
- [ ] Create `lecture_chunks` collection (384-dim, Cosine) (BE)
- [ ] Actian Vector answers `SELECT 1` via pyodbc/ingres (BE)
- [ ] Create `confusion_events` table (DDL from blueprint §4) (BE)
- [ ] **Exit gate:** both DBs respond to a smoke query ✅

---

## Phase 1 — Data Foundation (Hours 2–4)

- [ ] `chunk_lecture.py`: split transcript into ~15s chunks (AI)
- [ ] `load_textbook.py`: chunk textbook chapter (AI)
- [ ] `services/embedder.py`: bge-small wrapper, verify 384-dim output (AI)
- [ ] Embed + upsert lecture chunks → `lecture_chunks` with payload `{topic_node, ts, diff}` (AI/BE)
- [ ] Embed + upsert textbook chapter → `lecture_chunks` (AI)
- [ ] Retrieval smoke test: "chain rule" returns the chain-rule explanation (BE)
- [ ] **Exit gate:** `search()` returns sensible hits for 3 test queries ✅

---

## Phase 2 — Capture Layer / Muffliato (Hours 4–7)

- [ ] `models/schemas.py`: `Ping`, `LectureChunk`, `ConfusionEvent`, `AnalogyRequest` (BE)
- [ ] WebSocket endpoint `/ws/lecture/{lecture_id}` accepts pings (BE)
- [ ] Connection pool manager per lecture (BE)
- [ ] Tag each ping to current `concept_node` (latest chunk) (AI/BE)
- [ ] Write row to Actian Vector `confusion_events` on each ping (BE)
- [ ] Broadcast ping to radar feed channel (BE)
- [ ] Muffliato PWA: 🪄 / ✅ / ⏩ buttons, mobile-first (FE)
- [ ] PWA manifest + installable (FE)
- [ ] WebSocket client on PWA connects + sends pings (FE)
- [ ] **Exit gate:** phone button → visible event (log + DB row + broadcast) ✅

---

## Phase 3 — Radar Viz / Marauder's Radar (Hours 7–9)

- [ ] `hooks/useWebSocket.ts`: robust reconnect (FE)
- [ ] `components/radar/RadarHeatmap.tsx`: D3 radial heatmap, concept nodes radial (FE)
- [ ] Color intensity = current confusion density (FE)
- [ ] `components/timeline/Timeline.tsx`: Recharts confusion-over-time (FE)
- [ ] `hooks/useRadarData.ts`: shape WS feed into radar/timeline data (FE)
- [ ] Live feed wires radar to FastAPI broadcast (FE/BE)
- [ ] **Exit gate:** two "I'm lost" presses flare the radar within ~1s ✅

---

## Phase 4 — Retrieval Loop / Accio Analogy (Hours 9–12)

- [ ] Threshold rule: ≥2 lost in 20s on same node → fire (BE)
- [ ] `routers/retrieval.py`: embed confusing chunk → VectorAI DB search (BE)
- [ ] Return top-3 past explanations with payload (BE)
- [ ] On-screen latency badge: "edge retrieval: Xms · 0 cloud calls" (FE)
- [ ] Measure retrieval latency for real (BE)
- [ ] **Exit gate:** retrieval returns <50ms on screen for demo query ✅ 🎯

---

## Phase 5 — Generative Rewrite / Gemino (Hours 12–15)

- [ ] `services/gemini_client.py`: Gemini analogy call (AI)
- [ ] Prompt template: "Rewrite as 2-sentence analogy for a {cricketer/gamer/cook}" (AI)
- [ ] Interest-profile schema + avatar picker on PWA (FE/AI)
- [ ] Fallback: Gemini slow/down → return raw retrieved explanation (AI)
- [ ] Vet analogy quality on real examples (PM)
- [ ] **Exit gate:** analogy reads naturally for ≥2 avatars ✅

---

## Phase 6 — Voice Re-delivery / Sonorus (Hours 15–17)

- [ ] `services/elevenlabs_client.py`: TTS on Gemini output, calm tutor voice (AI)
- [ ] Stream audio back to specific lost students (targeted WS) (BE)
- [ ] Audio playback on PWA, handle autoplay policy (FE)
- [ ] Volume + handoff tested on a real phone (FE/AI)
- [ ] **Exit gate:** student hears analogy within ~1.5s total ✅

---

## Phase 7 — Analytics & Pensieve (Hours 17–19)

- [ ] `routers/analytics.py`: top-3 worst moments SQL (BE)
- [ ] Rolling 60s confusion density SQL (BE)
- [ ] Per-cohort heatmap SQL (BE)
- [ ] Pensieve dashboard: heatmap timeline + ranked worst moments (FE)
- [ ] One-click "re-teach plan" stub (FE/PM)
- [ ] **Exit gate:** dashboard renders real `confusion_events` queries ✅ 🎯

---

## Phase 8 — Offline Edge Mode (Hours 19–21)

- [ ] Pre-cache one full analogy (Gemini + ElevenLabs output) (AI)
- [ ] Verify unplug → radar still updates (BE/FE)
- [ ] Verify unplug → retrieval still <50ms (BE)
- [ ] Verify unplug → analytics still query (BE)
- [ ] (Stretch) simulate Actian Zen edge buffer with in-memory queue (BE)
- [ ] **Exit gate:** cable-pull demo runs clean ✅ 🎯

---

## Phase 9 — Polish & HP Theme (Hours 21–23)

- [ ] Spell names on all UI (Muffliato, Marauder's Radar, Accio Analogy, Gemino, Sonorus, Pensieve) (FE)
- [ ] Golden snitch loader (FE)
- [ ] Hogwarts CSS: parchment, serif headers, house colors (FE/PM)
- [ ] Landing page on GitHub Pages (PM/FE)
- [ ] Screenshots / live dashboard on landing page (PM)
- [ ] **Exit gate:** demo looks coherent and on-theme ✅

---

## Phase 10 — Rehearsal & Buffer (Hours 23–27)

- [ ] Dry run #1 of 3-min demo (all)
- [ ] Dry run #2 (all)
- [ ] Dry run #3 (all)
- [ ] Fix latency spikes (BE/AI)
- [ ] Fix audio handoff flakiness (FE/AI)
- [ ] Resolve any Docker/SDK fires (BE)
- [ ] **Exit gate:** demo runs clean 3× consecutively ✅

---

## Phase 11 — Submission & Final Demo (Hours 27–35)

- [ ] README: architecture diagram (Mermaid → PNG) + 2-command bring-up (PM/BE)
- [ ] Record full 3-min demo, cut to 90s (PM)
- [ ] Devfolio submission (PM):
  - [ ] Title: **Legilimens — Live Classroom Confusion Radar & Auto-Analogy Engine**
  - [ ] One-line tagline + 200-word description (lead with pain, then Actian edge)
  - [ ] Architecture diagram PNG attached
  - [ ] 90-sec demo video attached
  - [ ] GitHub repo linked, public, README complete
  - [ ] Sponsor tracks tagged: **Actian** (primary), Gemini, ElevenLabs, DigitalOcean, GitHub
  - [ ] Track: **Education**
  - [ ] "Pilot at JIS University" 3-bullet feasibility note
- [ ] Deploy dashboard to DigitalOcean droplet (if buffer remains)
- [ ] **Sleep. Arrive fresh.** ✅

---

## 🧪 Stretch Goals (only after core ships — cut first if time-pressed)

- [ ] Ambient confusion: Whisper on room audio → silence/"wait" spikes (AI)
- [ ] Multi-student interest graph: per-avatar analogies live (AI/FE)
- [ ] Re-teach plan generator: Gemini → 3-slide mini-lesson PDF (AI/PM)
- [ ] Cross-lecture knowledge graph: VectorAI DB as agent memory (BE)
- [ ] Cohort comparison: this batch vs. last semester (BE/PM)

---

## 🚨 Risk Quick-Reference (from blueprint §12)

| If this happens... | Do this |
|---|---|
| `actian_vectorai` install fails on venue Wi-Fi | Install from the USB wheel (pre-packed) |
| Live ASR drifts / noisy room | Use pre-recorded + pre-transcribed lecture; ASR is a stretch, not core |
| Gemini/ElevenLabs latency spikes | Pre-cache one analogy for the unplug moment; show the latency badge honestly |
| Actian Vector Docker slow to start | Brought it up in Phase 0; verify with smoke query before depending on it |
| "Just an engagement dashboard" perception | **Lead the demo with the retrieval+rewrite loop**, not the heatmap |
| Judge asks "why not Pinecone/Chroma?" | Cloud-only / single-node limits; Actian runs air-gapped where Pinecone is structurally disqualified |
| Teammate no-show | Roles are cross-trainable; BE can cover AI, PM can cover FE basics |
