# ✅ TODO — Member 4: Demo / PM Lead

> **Branch:** `dev/pm` · **Owns:** `README.md`, `data-prep/sample_lecture.txt` (content only), landing page, Devfolio submission, demo script, all non-code artifacts.
> **Coordinates with:** Everyone. You own the narrative and the submission.
> **Never touch:** any code files (`backend/`, `frontend/`, `docker-compose.yml`, `scripts/`).

---

## 🎒 Pre-Hackathon Prep (YOUR responsibility — do this BEFORE day 1)

- [x] **API keys secured:** Gemini API key + ElevenLabs API key (share with AI lead)
- [x] **Pre-recorded 5-min backprop lecture** (audio + accurate transcript) — the demo backbone
- [x] **Textbook chapter** (3B1B-style backprop notes) sourced, cleaned, as plain text
- [x] **GitHub repo created**, all 4 members have push access
- [ ] **Devfolio account + team registered**, all members invited
- [ ] **Physical props:**
  - [ ] 3 buzzers OR a dedicated phone page for judges to press
  - [ ] An Ethernet cable for the unplug demo
  - [ ] A phone with a speaker for the analogy audio
- [ ] **HP theme assets:** house color palette, Cinzel font link, golden snitch SVG/animation reference
- [ ] **Backup laptop** if possible (in case the "school server" laptop dies)
- [ ] **All API keys tested** — confirm Gemini + ElevenLabs return responses before arriving

---

## Phase 1 — Content Prep (Hours 2–4)

- [x] Finalize `data-prep/sample_lecture.txt` with the real backprop transcript (90s dense snippet marked)
- [x] Provide textbook chapter text to AI lead for embedding
- [x] Identify the "deliberately confusing moment" in the lecture (~0:42 mark, "chain rule")
- [x] Write 3 test queries that should return good hits (for retrieval smoke test)
- [ ] **Exit gate:** content is ready for AI lead to embed ✅

---

## Phases 2–6 — Demo Script Development (parallel with dev)

- [ ] Write the 3-minute demo script (from blueprint §9):
  - [ ] **0:00–0:20 Hook:** "Professors, 40% silently drowned..." — memorize the opening
  - [ ] **0:20–1:20 Live play:** cues for when to play lecture, when judges press buzzers
  - [ ] **1:20–2:00 Actian moment:** narrate the retrieval badge, analogy, voice
  - [ ] **2:00–2:40 Analytics:** switch to Pensieve, narrate the worst-moments report
  - [ ] **2:40–3:00 Unplug:** "It runs entirely on the school's server..." — pull the cable
- [ ] Write the honest-answer scripts for likely judge questions:
  - [ ] "Why not Pinecone/Chroma?" → cloud-only, Actian runs air-gapped
  - [ ] "Why two Actian DBs?" → vector answers "which explanation", columnar answers "when/how bad"
  - [ ] "Is the ASR live?" → transcript is pre-cached for reliability; confusion-to-retrieval is fully live
  - [ ] "Pilot at JIS?" → 3-bullet feasibility note
- [ ] **Exit gate:** demo script finalized, printed/copied to all teammates ✅

---

## Phase 9 — Polish & Landing Page (Hours 21–23)

- [ ] `README.md`: overview, architecture diagram (export Mermaid to PNG), 2-command bring-up
- [ ] Landing page content for GitHub Pages:
  - [ ] Project title + tagline + 200-word description
  - [ ] Architecture diagram
  - [ ] Screenshots of Muffliato + Radar + Pensieve (get from FE lead)
  - [ ] "Pilot at JIS University" 3-bullet feasibility section
  - [ ] Sponsor track badges (Actian primary, Gemini, ElevenLabs, DigitalOcean, GitHub)
- [ ] Coordinate with FE lead on landing page deployment to GitHub Pages
- [ ] **Exit gate:** README + landing page complete ✅

---

## Phase 10 — Rehearsal (Hours 23–27)

- [ ] **Dry run #1:** full 3-min demo, time it, note where it stumbles
- [ ] **Dry run #2:** fix stumbles, re-time
- [ ] **Dry run #3:** should be clean — if not, identify the blocker and swarm it
- [ ] Practice the unplug gesture (dramatic pause, clean pull, confident narration)
- [ ] Practice the audio handoff (make sure the phone speaker is loud enough for judges)
- [ ] Prepare a "demo fails" backup plan (pre-recorded video of the full demo, just in case)
- [ ] **Exit gate:** demo runs clean 3× consecutively ✅

---

## Phase 11 — Submission (Hours 27–35)

- [ ] **Devfolio submission checklist:**
  - [ ] Title: **Legilimens — Live Classroom Confusion Radar & Auto-Analogy Engine**
  - [ ] One-line tagline + 200-word description (lead with pain, then Actian edge)
  - [ ] Architecture diagram (PNG) attached
  - [ ] 90-second demo video attached (record the full 3-min, cut to 90s)
  - [ ] GitHub repo linked, public, README complete
  - [ ] Sponsor tracks tagged: **Actian** (primary), Gemini, ElevenLabs, DigitalOcean, GitHub
  - [ ] Track: **Education**
  - [ ] "Pilot at JIS University" 3-bullet feasibility note
- [ ] Deploy dashboard to DigitalOcean droplet (if buffer remains)
- [ ] **Submit before the deadline** — don't wait until the last minute
- [ ] **Sleep. Arrive fresh for judging.** ✅

---

## 🎯 The Three Things You Must Guarantee

1. **The demo works on cue.** Every dry run must be clean. If it's flaky in rehearsal, it'll fail in front of judges.
2. **The story is clear.** Lead with the pain (40% drown), hit the Actian moment (retrieval badge), end with the unplug. Don't bury the lede.
3. **The submission is on time.** A perfect demo that's submitted late scores zero. Submit early, polish after.

---

## 📋 Your Non-Code Deliverables Checklist

- [ ] Demo script (printed + on phone)
- [ ] Q&A cheat sheet (likely judge questions + answers)
- [ ] Pre-recorded backup demo video
- [ ] README.md (final version)
- [ ] Landing page (GitHub Pages)
- [ ] 90-second demo video (for Devfolio)
- [ ] Architecture diagram (PNG)
- [ ] Devfolio submission (all fields + tracks tagged)
- [ ] Physical props at the demo table (buzzers, cable, phone, speaker)