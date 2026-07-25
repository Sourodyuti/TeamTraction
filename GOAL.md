REA# 🎯 GOAL — Legilimens

> The north star. Read this first. If a task doesn't move us toward this goal, cut it.

---

## The Problem

Every professor has taught a room where **40% silently drowned — and never knew it.** Students nod along; confusion accumulates; the lecture moves on. By the time the exam reveals the gap, the moment is gone. There is no real-time signal, no second chance at the exact second a concept slips.

Tier-3 classrooms make it worse: flaky Wi-Fi, shared devices, and — critically — **student voice (and the fact that they're struggling) cannot leave the building** under India's DPDP Act and basic institutional trust.

---

## The One-Line Pitch (for judges)

> *"Professors, you've all taught a room where 40% silently drowned — and you never knew. **Legilimens** is the radar that catches it, and the spell that fixes it, in under a second, on the school's own server."*

---

## The Single Judge-Memorable Moment

**Pull the Ethernet cable.** The radar keeps updating, retrieval still returns in <50ms, analytics still query — because the entire student-data path lives on-prem on **Actian**. That gesture is only possible because the architecture *genuinely depends* on Actian's edge-first design, not a sponsor logo bolted onto a cloud RAG demo.

---

## What "Done" Looks Like — Success Criteria

The hackathon submission is complete when **all** of the following are true:

### Functional (the demo must run, end-to-end, 3× clean)
- [ ] **Muffliato** PWA renders on a phone with working 🪄 "I'm lost" / ✅ "Got it" / ⏩ "Slower" buttons over WebSocket.
- [ ] Pings reach **FastAPI** in <100ms and light up a dot on the radar.
- [ ] Confusion events are written as rows to **Actian Vector** `confusion_events`.
- [ ] **Marauder's Radar** (D3 radial heatmap + Recharts timeline) updates live via WebSocket.
- [ ] When ≥2 students go "lost" in 20s on the same concept node, **Accio Analogy** auto-fires: embeds the chunk → **Actian VectorAI DB** similarity search returns top-3 past explanations in <50ms (badge shown on screen).
- [ ] **Gemini** rewrites the retrieved explanation as a 2-sentence analogy for the student's interest profile (cricketer / gamer / cook).
- [ ] **ElevenLabs** speaks the analogy back to the lost students' phones.
- [ ] **Pensieve** renders the post-lecture "top-3 worst moments" report from real Actian Vector SQL.
- [ ] **Offline demo works**: with Ethernet unplugged, retrieval + radar + analytics still function; one analogy is pre-cached.

### Non-functional (visible on screen — judges skim)
- [ ] Live latency badge: `ping→radar <100ms · retrieval <50ms · ~1.5s total`.
- [ ] Harry-Potter theme is coherent: spell names everywhere, golden snitch loader, Hogwarts CSS.
- [ ] One-command bring-up: `docker-compose up -d`.

### Submission
- [ ] README with architecture diagram + 2-command bring-up.
- [ ] 90-second demo video.
- [ ] Devfolio submitted, all sponsor tracks tagged, **Education** track selected.
- [ ] Landing page on GitHub Pages.

---

## In Scope vs. Out of Scope

### ✅ In Scope (core — must ship)
- 1 lecture domain (backprop) with a pre-recorded, pre-transcribed 90s snippet.
- 1 signal type: explicit student buttons (no passive ASR-sentiment).
- On-prem dual-Actian: VectorAI DB (retrieval) + Vector (analytics).
- Live WebSocket capture → radar → threshold → retrieval → Gemini rewrite → ElevenLabs TTS.
- Pensieve analytics from real SQL.
- Offline-mode demo (cable pull).

### 🧪 Stretch Goals (only after core ships — see PLAN Phase extras)
- Ambient confusion detection (Whisper on room audio → silence/"wait" spikes).
- Multi-student interest graph (per-avatar analogies).
- Re-teach plan generator (Gemini → 3-slide mini-lesson PDF).
- Cross-lecture knowledge graph (VectorAI DB as agent memory).
- Cohort comparison (this batch vs. last semester).

### ❌ Explicitly Out of Scope (for 35h)
- **Actian DataConnect** — mentioned in the pitch for portfolio awareness, not built.
- **Actian Zen edge buffer** — referenced in the architecture narrative; in the demo the "Pi" is simulated by the FastAPI in-memory queue. Only build Zen if Phase 8 (offline) time permits.
- Multi-school cloud view / DigitalOcean droplet — only if buffer hours remain.

---

## Sponsor Tracks to Tag

| Track | How we use it | Priority |
|---|---|---|
| **Actian** | Dual-Actian architecture: VectorAI DB (on-prem retrieval) + Vector (columnar confusion analytics) | 🥇 Primary |
| **Gemini** | Analogy rewrite per student interest (Gemino) | Bonus |
| **ElevenLabs** | Calm tutor voice re-delivery (Sonorus) | Bonus |
| **DigitalOcean** | Optional droplet for multi-school dashboard view | Bonus |
| **GitHub** | Repo + GitHub Pages landing page | Bonus |

**Track selection:** *Education* (less contested than Open Innovation).

---

## Self-Audit Against the 5 Judging Criteria

| Criterion | How Legilimens scores | Risk to actively mitigate |
|---|---|---|
| **Completion** | Scoped to 1 domain + 1 signal type; shippable in 35h with a 4h buffer | Don't let ASR-sentiment creep into core; keep it as a stretch |
| **Creativity & Innovation** | "Confusion as a real-time analytics + retrieval stream" is fresh; radar metaphor is memorable; HP theme is coherent | **Lead the demo with the retrieval+rewrite loop**, not the heatmap, so it doesn't read as "engagement dashboard" |
| **Technical Complexity & Learning** | Dual-Actian (vector + columnar), live WebSocket pipeline, local ASR, generative rewrite, TTS — genuinely non-trivial | Be ready to explain *why two Actian DBs*: vector answers "which explanation," columnar answers "when/how bad" |
| **UX** | Judges physically press buzzers; radar is alive; analogy plays on their phone | **Rehearse the audio handoff** — a silent demo kills the UX score |
| **Real-world Impact & Feasibility** | Real pain in every Indian classroom; on-prem = DPDP-compliant; pilotable at JIS University | Have a 3-bullet "Pilot at JIS" plan ready for the feasibility question |

---

## The Team's Unfair Advantage

We win because **every piece of the stack earns its place** — nothing is decorative. Actian VectorAI DB isn't optional branding; it's the reason the Ethernet-pull demo works. The HP theme isn't garnish; the hackathon is Harry-Potter-themed and judges reward coherence. The radar isn't the product; it's the hook that makes the retrieval+rewrite loop land.

**Optimize for the demo, not the codebase.** A 3-minute clean demo beats 3 weeks of features.
