# 🗺️ PLAN — Legilimens (Phase-by-Phase)

> 35 hours, 12 milestone phases. Each phase has a **goal**, the **components** touched, the **deliverables**, an **exit criterion** (the thing that must be true before moving on), the **hour budget**, and the **owners** from the 4-person role split. Logical milestones — but every phase is tagged with the hour window from the original blueprint so the clock stays visible.

## Role Legend
| Tag | Role | Owns |
|---|---|---|
| **BE** | Backend / Actian lead | VectorAI DB, Actian Vector, FastAPI, Docker Compose |
| **AI** | AI / ML lead | Embeddings, Whisper, Gemini, ElevenLabs pipelines |
| **FE** | Frontend lead | Muffliato PWA, Marauder's Radar, Pensieve dashboard |
| **PM** | Demo / PM lead | Script, data prep, HP theming, Devfolio, rehearsal |

All four swarm integration bugs in Phases 8–10.

---

## Phase 0 — Foundation & Scaffolding ⏱️ Hours 0–2

**Goal:** A one-command bring-up where both Actian DBs answer a test query.

**Components:** `docker-compose.yml`, `backend/main.py` skeleton, both DB clients.

**Deliverables:**
- `docker-compose up -d` brings up **Actian VectorAI DB** (`:6573` REST / `:6574` gRPC) and **Actian Vector Community** (columnar SQL).
- FastAPI skeleton boots (`uvicorn main:app`), `/health` returns 200.
- `actian_vectorai` Python SDK connects; `lecture_chunks` collection created (384-dim, Cosine).
- Actian Vector answers `SELECT 1` via pyodbc/ingres.

**Exit criterion:** ✅ Both DBs respond to a smoke query; SDK collection creation confirmed.

**Owners:** **BE** (primary), with **AI** verifying the embedder dimension matches the collection.

**⚠️ Risk:** Actian Vector Docker image slow to start → bring it up *first*, verify before depending on it.

---

## Phase 1 — Data Foundation ⏱️ Hours 2–4

**Goal:** Real embedded content lives in VectorAI DB and `search()` returns sensible hits.

**Components:** `data-prep/`, `services/embedder.py`, `services/vectorai_client.py`.

**Deliverables:**
- Pre-recorded 5-min dense lecture (backprop) → transcribed → chunked (~15s) → embedded (bge-small, 384-dim) → upserted into `lecture_chunks` with payload `{topic_node, ts, diff}`.
- A textbook chapter (3Blue1Brown-style backprop notes) chunked + embedded + loaded as the "knowledge vault."
- Retrieval smoke test: querying "chain rule" returns the chain-rule explanation.

**Exit criterion:** ✅ `search()` returns sensible hits for 3 test queries.

**Owners:** **AI** (embed + chunk), **PM** (source/prep the lecture + textbook content), **BE** (ingest endpoints).

---

## Phase 2 — Capture Layer (Muffliato) ⏱️ Hours 4–7

**Goal:** A student phone button lights up a radar dot in <100ms.

**Components:** `frontend/` PWA, `routers/websocket.py`, `models/schemas.py`, Actian Vector writer.

**Deliverables:**
- Muffliato PWA: big 🪄 "I'm lost" / ✅ "Got it" / ⏩ "Slower" buttons, mobile-first, PWA-installable.
- WebSocket endpoint `/ws/lecture/{lecture_id}` accepts `{student_id, ts, signal_type}` pings.
- FastAPI tags each ping to the current `concept_node` (latest transcript chunk) and writes a row to Actian Vector `confusion_events`.
- Pings broadcast to a radar feed channel.

**Exit criterion:** ✅ Pressing the phone button produces a visible event (log + DB row + broadcast).

**Owners:** **FE** (PWA + WS client), **BE** (WS hub + Vector writer), **AI** (concept-node tagging logic).

---

## Phase 3 — Radar Visualization (Marauder's Radar) ⏱️ Hours 7–9

**Goal:** A judge can see confusion flare on cue, live.

**Components:** `components/radar/RadarHeatmap.tsx`, `components/timeline/Timeline.tsx`, `hooks/useWebSocket.ts`.

**Deliverables:**
- D3 **radial heatmap**: concept nodes arranged radially, color intensity = current confusion density.
- Recharts **timeline**: confusion density over lecture time, scrubable.
- Live WebSocket feed wires the radar to the FastAPI broadcast.

**Exit criterion:** ✅ Two judges pressing "I'm lost" visibly flares the radar within ~1s.

**Owners:** **FE** (primary), **BE** (stable broadcast schema).

---

## Phase 4 — Retrieval Loop (Accio Analogy) ⏱️ Hours 9–12

**Goal:** The threshold trigger fires and retrieval returns in <50ms with an on-screen latency badge.

**Components:** `routers/retrieval.py`, `services/vectorai_client.py`, threshold logic.

**Deliverables:**
- Threshold rule: ≥2 students "lost" in 20s on the same concept node → fire Accio Analogy.
- Embed the confusing chunk → VectorAI DB similarity search → top-3 past explanations with payload.
- On-screen badge: **"edge retrieval: 38ms · 0 cloud calls"** (live measured latency).

**Exit criterion:** ✅ Retrieval returns <50ms on screen for the demo query.

**Owners:** **BE** (threshold + retrieval), **AI** (embedding-the-query latency), **FE** (badge UI).

**🎯 This is the Actian hero moment — get the latency number real and visible.**

---

## Phase 5 — Generative Rewrite (Gemini / Gemino) ⏱️ Hours 12–15

**Goal:** The analogy reads naturally and is tailored to a student's interest.

**Components:** `services/gemini_client.py`, prompt template, interest-profile schema.

**Deliverables:**
- Gemini API call: retrieved explanation + student interest profile → 2-sentence analogy.
- Prompt template: *"Rewrite this explanation as a 2-sentence analogy for a {cricketer/gamer/cook}."*
- Fallback: if Gemini is slow/down, return the raw retrieved explanation (no crash).
- Interest profile selection (student picks an avatar on the PWA).

**Exit criterion:** ✅ Analogy reads naturally for at least 2 avatars.

**Owners:** **AI** (primary), **FE** (avatar picker), **PM** (vet the analogy quality on real examples).

---

## Phase 6 — Voice Re-delivery (Sonorus) ⏱️ Hours 15–17

**Goal:** The student hears the analogy on their phone.

**Components:** `services/elevenlabs_client.py`, audio streaming back over WebSocket.

**Deliverables:**
- ElevenLabs TTS call on the Gemini analogy text → calm tutor voice.
- Audio streamed back to the specific lost students' phones (targeted, not broadcast).
- Handle the "audio handoff" cleanly (autoplay policy, volume).

**Exit criterion:** ✅ Student hears the analogy within ~1.5s total of pressing the button.

**Owners:** **AI** (TTS), **FE** (audio playback), **BE** (targeted WS delivery).

**⚠️ Risk:** Rehearse the audio handoff — a silent demo kills the UX score.

---

## Phase 7 — Analytics & Pensieve ⏱️ Hours 17–19

**Goal:** The Pensieve dashboard renders real Actian Vector SQL, not mocks.

**Components:** `routers/analytics.py`, `app/dashboard/pensieve/`, Actian Vector queries.

**Deliverables:**
- Actian Vector SQL: top-3 worst moments (by `lost_count`), rolling 60s confusion density, per-cohort heatmaps.
- Pensieve dashboard view: confusion-heatmap timeline + ranked worst-moments list + one-click "re-teach plan" stub.

**Exit criterion:** ✅ Dashboard renders queries against real `confusion_events` rows.

**Owners:** **BE** (SQL queries), **FE** (Pensieve UI), **PM** (narrative for the "re-teach plan").

**🎯 This is where Actian Vector (columnar) earns its place — be ready to explain why two DBs.**

---

## Phase 8 — Offline Edge Mode ⏱️ Hours 19–21

**Goal:** The cable-pull demo succeeds.

**Components:** Pre-cached analogy, retrieval/radar/analytics resilience.

**Deliverables:**
- Pre-cache one full analogy (Gemini + ElevenLabs output) so the unplug moment has audio.
- Verify: unplug Ethernet → radar still updates, retrieval still returns in <50ms, analytics still query.
- The "Pi edge buffer" story is told (Actian Zen); if time permits, simulate it with an in-memory offline queue.

**Exit criterion:** ✅ Cable-pull demo runs clean.

**Owners:** **BE** (resilience), **AI** (pre-cache), **PM** (stage the physical gesture).

**🎯 This is the single most judge-memorable moment. Rehearse it.**

---

## Phase 9 — Polish & HP Theme ⏱️ Hours 21–23

**Goal:** The demo looks magical.

**Components:** Theming, loaders, landing page.

**Deliverables:**
- Spell names everywhere (Muffliato, Marauder's Radar, Accio Analogy, Gemino, Sonorus, Pensieve).
- Golden snitch loader, Hogwarts CSS (parchment, serif headers, house colors).
- Landing page on GitHub Pages with screenshots / live dashboard.

**Exit criterion:** ✅ Demo looks coherent and on-theme.

**Owners:** **PM** (primary), **FE** (CSS execution).

---

## Phase 10 — Rehearsal & Buffer ⏱️ Hours 23–27

**Goal:** The 3-minute demo runs clean 3×, and the inevitable fire is put out.

**Components:** The full demo flow; bug fixing.

**Deliverables:**
- 3 dry runs of the 3-min demo script (see blueprint §9 / CLAUDE.md).
- Fix latency spikes, audio handoff flakiness, any Docker/SDK issues.
- All four teammates swarm integration bugs here.

**Exit criterion:** ✅ Demo runs clean 3× consecutively.

**Owners:** **All four** — this is the swarm phase.

---

## Phase 11 — Submission & Final Demo ⏱️ Hours 27–35

**Goal:** Submitted before deadline; team rested for judging.

**Components:** README, video, Devfolio, sleep.

**Deliverables:**
- README with architecture diagram (Mermaid exported as PNG) + 2-command bring-up.
- 90-second demo video (cut from the full 3-min run).
- Devfolio submission: all sponsor tracks tagged, **Education** track, "Pilot at JIS" 3-bullet note.
- Deploy dashboard to DigitalOcean droplet (if buffer remains).
- **Sleep.** Arrive fresh at the judging table.

**Exit criterion:** ✅ Submitted; team has slept.

**Owners:** **PM** (submission), **All** (video + final prep).

---

## Phase → Stretch-Goal Dependency Map

Stretch goals unlock only after their parent phase's exit criterion is met:

| Stretch goal | Unlocks after | Phase window |
|---|---|---|
| Ambient confusion (Whisper room audio) | Phase 6 ships | buffer only |
| Multi-student interest graph | Phase 5 ships | buffer only |
| Re-teach plan generator (Gemini PDF) | Phase 7 ships | buffer only |
| Cross-lecture knowledge graph | Phase 4 ships | buffer only |
| Cohort comparison (this batch vs last sem) | Phase 7 ships | buffer only |

**Rule:** Never let a stretch goal block a core phase. If the clock is tight, cut stretches first.

---

## Critical Path (the chain that decides if we ship)

```
Phase 0 → Phase 1 → Phase 4 → Phase 5 → Phase 6 → Phase 8 (demo-critical)
                     ↑
              Phase 2 → Phase 3 (parallel feed into 4)
```
Phases 2/3 (capture + radar) and 7 (analytics) can run in parallel with 4/5/6 once Phase 1 lands. **Phase 0 and Phase 4 are the hard gates** — if the Actian DBs or retrieval don't work, nothing else matters.
