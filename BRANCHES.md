# 🔀 BRANCHES — Legilimens 4-Member Workflow

> How 4 teammates work in parallel and merge without conflicts. **Read this before your first commit.**

---

## Branch Strategy

```
main                          ← sacred: only approved, demo-ready PRs merge here
 └── dev/integration          ← where all 4 lanes merge and integration-test
      ├── dev/backend         ← Member 1: Backend / Actian lead
      ├── dev/ai-ml           ← Member 2: AI / ML lead
      ├── dev/frontend        ← Member 3: Frontend lead
      └── dev/pm              ← Member 4: Demo / PM lead
```

All branches were created from commit `63af527` on `main`. Every lane has the full codebase — just work in your files only.

### Latest commits on main (for reference)

```
63af527 chore: initialize Next.js environment definitions and package-lock file
f224084 AIML update
928c2a1 feat: split into 4-member workflow + production backend foundation
a266ed0 feat: add full-scale storage analysis document for Actian VectorAI and Vector database integration
844cb21 feat: initialize full-stack repository with project scaffolding, backend services, and frontend radar visualization base
```

---

## Who Owns What (zero overlap = zero conflicts)

| Member | Branch | Owns these files ONLY | TODO file |
|---|---|---|---|
| **M1 Backend** | `dev/backend` | `backend/main.py`, `backend/config.py`, `backend/logging_config.py`, `backend/routers/*`, `backend/models/schemas.py`, `backend/models/database.py`, `backend/tests/*`, `docker-compose.yml`, `Makefile` | [`TODO-backend.md`](./TODO-backend.md) |
| **M2 AI/ML** | `dev/ai-ml` | `backend/services/*` (embedder, gemini, elevenlabs, whisper, vectorai_client, vector_client), `backend/requirements.txt`, `data-prep/*`, `scripts/*` | [`TODO-ai-ml.md`](./TODO-ai-ml.md) |
| **M3 Frontend** | `dev/frontend` | `frontend/**` (all), `public/**` | [`TODO-frontend.md`](./TODO-frontend.md) |
| **M4 PM** | `dev/pm` | `README.md`, `data-prep/sample_lecture.txt` (content only), landing page content, Devfolio assets | [`TODO-pm.md`](./TODO-pm.md) |

### Shared files (anyone edits, low conflict risk)
- `GOAL.md`, `PLAN.md`, `BRANCHES.md`, `TODO.md` (index), `.gitignore`, `LICENSE`, `CLAUDE.md`

### The golden rule
> **Never edit a file outside your lane.** Backend doesn't touch `frontend/`. AI doesn't touch `routers/`. Frontend doesn't touch `backend/`. PM doesn't touch code. That's the entire conflict-prevention strategy.

---

## Setup (each member, once)

```bash
git clone https://github.com/Sourodyuti/TeamTraction.git
cd TeamTraction

# Create your lane branch from main (do this once):
# Backend:
git checkout -b dev/backend
# AI/ML:
git checkout -b dev/ai-ml
# Frontend:
git checkout -b dev/frontend
# PM:
git checkout -b dev/pm

git push -u origin dev/<your-lane>
```

---

## Daily Workflow

```bash
# 1. Start of session — sync with the latest integration work
git checkout dev/<your-lane>
git fetch origin
git merge origin/dev/integration    # pull in teammates' merged work

# 2. Do your work (only in your owned files)

# 3. Commit + push
git add <your-files-only>
git commit -m "feat(backend): implement retrieval threshold trigger"
git push

# 4. When a phase is done, open a PR to merge into dev/integration
gh pr create --base dev/integration --head dev/<your-lane> \
  --title "Backend: Phase 4 retrieval pipeline" \
  --body "Closes Phase 4. Exit gate: retrieval <50ms"
```

---

## Merge Order (avoids dependency issues)

The four lanes have a natural merge order into `dev/integration`:

```
1. dev/ai-ml      →  defines the service interfaces (embedder, vectorai, gemini, elevenlabs)
2. dev/backend    →  consumes those interfaces in routers + websocket
3. dev/frontend   →  consumes the REST/WS schema backend exposes
4. dev/pm         →  docs + content (no code deps, merges anytime)
```

**You don't have to wait for the lane above you.** Each lane can develop against the interface contracts (documented in each TODO file) using stubs/mocks, then the real implementations slot in at merge time.

---

## Integration Flow (before the demo)

```
1. All 4 lanes create PRs → dev/integration
2. Merge in order: ai-ml → backend → frontend → pm
3. Run full integration test on dev/integration:
     docker-compose up -d
     bash scripts/demo_setup.sh
     cd frontend && npm run dev
     # Test the full ping → radar → retrieval → analogy → audio loop
4. When demo is clean on dev/integration:
     gh pr create --base main --head dev/integration --title "Release: demo-ready"
5. Merge to main = JUDGE-READY 🏆
```

---

## Conflict Prevention — The Only Risky Files

| File | Who might touch it | Mitigation |
|---|---|---|
| `README.md` | PM owns it | Only PM edits; others suggest changes via comments |
| `data-prep/sample_lecture.txt` | PM (content) + AI (reads it) | PM edits content; AI only reads |
| `.gitignore` | Anyone | Edit infrequently; backend merges first if conflict |
| `backend/requirements.txt` | AI only | Only AI lead adds deps |
| Planning docs (`GOAL.md`, etc.) | Anyone | Text files; merge keeping both sides if conflict |

**Everything else is single-owner** — if you follow the lane boundaries, you will never see a merge conflict.

---

## Emergency: Hotfix During Demo Prep

```bash
git checkout main
git checkout -b hotfix/critical-fix
# fix the bug (in your owned files)
git commit -m "hotfix: fix websocket crash"
gh pr create --base main --head hotfix/critical-fix --title "HOTFIX: websocket crash"
# merge immediately, then backport:
git checkout dev/integration
git merge main
git checkout dev/<your-lane>
git merge dev/integration
```

---

## Quick Reference — Interface Contracts

These are the handoff points between lanes. **If you change an interface, tell the dependent lane immediately.**

```
AI/ML defines →  Backend consumes:
  Embedder.encode() / encode_with_latency()
  VectorAIClient.search_similar()
  GeminiClient.rewrite_analogy()
  ElevenLabsClient.text_to_speech()

Backend defines →  Frontend consumes:
  WebSocket: /ws/lecture/{id}  (message schema in TODO-frontend.md)
  REST: /health, /analytics/*, /retrieval/accio  (response shapes in TODO-frontend.md)

PM defines →  Everyone reads:
  README.md, demo script, architecture diagram
```
