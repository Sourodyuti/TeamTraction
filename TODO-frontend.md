# ✅ TODO — Member 3: Frontend Lead

> **Branch:** `dev/frontend` · **Owns:** `frontend/` (all), `public/`
> **Coordinates with:** BE lead on WebSocket message schema + REST response shapes; AI lead on analogy display.
> **Never touch:** `backend/`, `docker-compose.yml`, `data-prep/`, `scripts/`.

---

## Phase 0 — Foundation & Scaffolding (Hours 0–2)

- [x] `npm install` succeeds, `npm run dev` boots on `localhost:3000`
- [x] `src/lib/types.ts`: all TypeScript types matching BE lead's Pydantic schemas (mirror exactly)
- [x] `src/lib/api.ts`: REST client with all endpoint URLs (health, top-moments, density, accio)
- [x] `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000`
- [ ] PWA manifest `public/manifest.json` (name, icons, theme color, installable)
- [x] `src/app/layout.tsx` + `globals.css`: base Hogwarts theme (dark bg, gold accents, serif headers)
- [ ] **Exit gate:** Next.js boots, pages render, `npm run typecheck` passes ✅

---

## Phase 2 — Capture Layer / Muffliato PWA (Hours 4–7)

- [x] `src/app/page.tsx`: Muffliato landing — big 🪄 / ✅ / ⏩ buttons, mobile-first, thumb-friendly
- [x] `src/hooks/useWebSocket.ts`: robust reconnect with exponential backoff (max 5s)
- [x] `sendPing({student_id, signal_type})` sends `{"type": "ping", ...}` over WS
- [ ] Visual feedback on button press (ripple animation, color flash)
- [x] Connection status indicator (🟢 / 🔴)
- [ ] Avatar picker UI: cricketer / gamer / cook (stores in localStorage, sent with pings)
- [x] Student ID generated on first load, persisted in localStorage
- [ ] **Exit gate:** phone button → WebSocket ping sent + status shows connected ✅

---

## Phase 3 — Radar Viz / Marauder's Radar (Hours 7–9)

- [x] `src/components/radar/RadarHeatmap.tsx`: D3 radial heatmap
  - [x] Concept nodes arranged radially in a circle
  - [x] Arc size = node weight, color intensity = confusion density (green → amber → red)
  - [x] Smooth D3 transitions on data updates
  - [x] Node labels + hover tooltip
  - [x] Center: lecture title + live student count
- [x] `src/components/timeline/Timeline.tsx`: Recharts line chart
  - [x] X-axis: lecture time, Y-axis: confusion density 0–100%
  - [x] Red dashed threshold line where Accio fires (≥0.25)
  - [x] Tooltip showing exact density + timestamp
- [x] `src/hooks/useRadarData.ts`: shapes WS `radar_update` messages into ConceptNode[] + TimelinePoint[]
- [x] `src/app/dashboard/page.tsx`: teacher dashboard shell — radar + timeline + latency badge
- [x] Live latency badge: "edge retrieval: 38ms · 0 cloud calls" (reads `latency_update` WS messages)
- [ ] **Exit gate:** two "I'm lost" presses visibly flare the radar within ~1s ✅

---

## Phase 5 — Gemini UI (Hours 12–15)

- [ ] Avatar selection persisted and sent with every ping
- [ ] Dashboard: when analogy arrives via WS, show analogy text in a panel
  - [ ] Original explanation (collapsible)
  - [ ] Rewritten analogy (prominent, styled like a "spell scroll")
  - [ ] Avatar badge showing which interest was used
- [ ] **Exit gate:** avatar picked, analogy text appears on dashboard when Accio fires ✅

---

## Phase 6 — Voice Playback / Sonorus UI (Hours 15–17)

- [ ] Audio player on Muffliato page
  - [ ] Receives audio via WS binary frames (coordinate frame format with BE lead)
  - [ ] Handles autoplay policy: first user interaction (button press) unlocks audio
  - [ ] Visual: "🔊 Legilimens is explaining..." with pulsing animation while playing
- [ ] Volume control + mute toggle
- [ ] Fallback: if audio frame fails, fetch via REST URL
- [ ] **Test on a real phone** (iOS Safari + Android Chrome — autoplay policies differ)
- [ ] **Exit gate:** student hears analogy on phone within ~1.5s of pressing button ✅

---

## Phase 7 — Analytics & Pensieve UI (Hours 17–19)

- [ ] `src/app/dashboard/pensieve/page.tsx`: Pensieve analytics dashboard
  - [ ] Top-3 worst moments table: concept_node, lost_count, total_signals, density
  - [ ] Confusion density timeline (reuse Timeline component, full-lecture view)
  - [ ] One-click "re-teach plan" button per moment (opens modal with stub content)
- [ ] Navigation: Radar ↔ Pensieve links in header
- [ ] Fetch real data from `/analytics/top-moments` and `/analytics/density`
- [ ] Loading skeletons + error boundaries (never white-screen)
- [ ] Empty state: "No confusion data yet — start a lecture"
- [ ] **Exit gate:** Pensieve renders real query data from the analytics API ✅

---

## Phase 9 — Polish & HP Theme (Hours 21–23)

- [ ] Full Hogwarts CSS theme across all pages
  - [ ] Parchment texture background for panels
  - [ ] Serif headers (Cinzel font via Google Fonts or similar)
  - [ ] House colors: gold (#d3a625) primary, dark purple (#1a0f2e) background
  - [ ] Spell names on every page header: Muffliato, Marauder's Radar, Accio Analogy, Gemino, Sonorus, Pensieve
- [ ] Golden snitch loader (CSS keyframe animation) for loading states
- [ ] Responsive: tested on phone (375px), tablet (768px), laptop (1200px)
- [ ] **Exit gate:** demo looks coherent and on-theme ✅

---

## Phase 10 — Rehearsal & Buffer (Hours 23–27)

- [ ] Fix UI bugs found during dry runs
- [ ] Fix audio playback issues on real phones
- [ ] Performance: ensure radar updates don't lag (debounce/throttle if needed)
- [ ] Record screenshots for Devfolio submission
- [ ] **Exit gate:** demo runs clean 3× ✅

---

## 🎨 Frontend Conventions

- **No direct `fetch` in components** — always go through `src/lib/api.ts`
- **All types** from `src/lib/types.ts` — keep in sync with BE lead's `models/schemas.py`
- **Error boundary on every route** — a crash must never show a white screen during the demo
- **Mobile-first** — the primary user (student) is on a phone pressing buttons
- **Spell names everywhere** — every component, page, and header uses the HP naming

---

## 🔌 Interface Contracts You Consume (defined by BE lead)

```typescript
// WebSocket: /ws/lecture/{lecture_id}
// Send (student → server):
{ "type": "ping", "student_id": "...", "signal_type": "lost" | "gotit" | "slower" }

// Receive (server → client):
{ "type": "radar_update", "lecture_id": 1, "student_id": "...", "signal_type": "lost" }
{ "type": "analogy_audio", "student_id": "...", "audio_url": "..." }  // or binary frames
{ "type": "latency_update", "retrieval_ms": 38 }

// REST endpoints:
GET  /health                                    → { status, services: {...} }
GET  /analytics/top-moments?lecture_id=1&limit=3 → [{ concept_node, lost_count, total_signals, avg_density }]
GET  /analytics/density?lecture_id=1            → [{ ts, density }]
POST /retrieval/accio?concept_node=X&chunk_text=Y → AnalogyResponse
```