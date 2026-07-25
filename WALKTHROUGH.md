# Legilimens Website Walkthrough

## Overview

This document describes the complete website built for **Legilimens (TeamTraction)** - a real-time classroom confusion radar and auto-analogy engine. The website is built on the Next.js 14 framework with a Harry Potter-themed design system inspired by the Hexafalls hackathon reference site.

## Architecture Summary

### Project Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with metadata, fonts, skip link
│   │   ├── page.tsx            # Main landing page (server component)
│   │   ├── globals.css         # Global design system (CSS variables, animations)
│   │   └── page.module.css     # Page-specific styles (back-to-top, skip link)
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   │   ├── Button.tsx      # Gold/ghost/outline/spell variants
│   │   │   ├── Button.module.css
│   │   │   ├── Card.tsx        # Parchment/dark/spell variants
│   │   │   ├── Card.module.css
│   │   │   ├── Badge.tsx       # Gold/cyan/emerald/crimson/amber/spell variants
│   │   │   ├── Badge.module.css
│   │   │   ├── ScrollReveal.tsx # IntersectionObserver-based animations
│   │   │   ├── FloatingBackground.tsx # Floating particle backgrounds
│   │   │   └── FloatingBackground.module.css
│   │   └── landing/            # Page sections
│   │       ├── Hero.tsx
│   │       ├── ProblemSolution.tsx
│   │       ├── Architecture.tsx
│   │       ├── Spells.tsx
│   │       ├── LiveDemo.tsx
│   │       ├── Team.tsx
│   │       ├── Sponsors.tsx
│   │       ├── Footer.tsx
│   │       ├── CustomCursor.tsx
│   │       ├── FloatingBackground.tsx
│   │       └── LandingPageClient.tsx (client wrapper)
│   └── lib/
│       └── types.ts            # Shared TypeScript types
```

### Design System (globals.css)

**Color Palette:**
- Backgrounds: `--bg-primary` (#0D0714), `--bg-secondary` (#1A0F2E), `--bg-tertiary` (#241642)
- Parchment: `--bg-parchment` (#F5E6C8), `--bg-parchment-dark` (#E8D4B9)
- Gold accents: `--gold` (#D4AF37), `--gold-light` (#F0D57A), `--gold-dark` (#B8941F)
- Spell colors: `--spell-muffliato` (#66FCF1), `--spell-marauders` (#D4AF37), `--spell-accio` (#FF6B35), `--spell-gemino` (#BB86FC), `--spell-sonorus` (#FFD700), `--spell-pensieve` (#8A2BE2)
- Status: `--status-connected` (#50C878), `--status-disconnected` (#DC143C)

**Typography:**
- Display: `Cinzel` (serif, wizard feel)
- Wizard: `Cinzel` cursive fallback
- Body: `Inter` (system UI)
- Mono: `JetBrains Mono`

**Animations:**
- `float` / `float-slow` - gentle floating motion
- `pulse-glow` - glowing pulse
- `sparkle` - sparkle burst
- `rotate-slow` - continuous rotation
- `fade-in-up` / `fade-in-down` / `scale-in` - scroll reveal
- `shimmer-text` - animated gold text` - gradient shimmer on gold text

**Shadows:**
- `--shadow-glow` - gold glow
- `--shadow-glow-strong` - stronger gold glow
- `--shadow-glow-cyan` - cyan glow
- `--shadow-parchment` - parchment card shadow

---

## Page Sections (in order)

### 1. Hero (`Hero.tsx`)
**Location:** `#hero` (also `#top` for back-to-top)

**Features:**
- Full-screen, centered layout
- Floating particle background (40 particles)
- Animated badge: "🔮 Legilimens — Live Classroom Confusion Radar"
- Title with gradient gold highlight: "The Spell That Reads Collective Minds In Real Time"
- Tagline quote with animated ✦ marks
- CTA buttons: "View Live Demo" (gold, spell=marauders) + "Read the Blueprint" (ghost)
- Live stats bar with 4 metrics:
  - ~1.5s End-to-end latency
  - <50ms VectorAI retrieval
  - <100ms Ping → Radar
  - 0 Cloud calls for retrieval
- Sponsor badges (Actian Primary, Gemini, ElevenLabs, DigitalOcean, GitHub)
- Floating decorative elements (wand, golden snitch, sparkles)
- Scroll indicator with bounce animation

**Animations:** Staggered ScrollReveal (down/up), float animations, shimmer text

---

### 2. Problem → Solution (`ProblemSolution.tsx`)
**Location:** `#problem-solution`

**Features:**
- Header with badge "The Problem → The Spell"
- Title: "Why Legilimens Exists"
- Problems grid (4 cards, dark variant, spell-themed borders):
  1. **Silent Drowning** (Muffliato) - 40% affected
  2. **Lost Moments** (Marauder's Radar) - ∞
  3. **Data Cannot Leave** (Accio) - 0 cloud
  4. **Flaky Infrastructure** (Pensieve) - 99% fail
- Solutions grid (6 cards, dark variant, spell-themed):
  1. Muffliato — Silent Capture
  2. Marauder's Radar — Live Viz
  3. Accio Analogy — On-Prem Retrieval
  4. Gemino + Sonorus — Personalized Re-teach
  5. Pensieve — Post-Lecture Analytics
  6. Offline-First Architecture
- Key differentiator card (parchment variant): "The Actian Edge: Zero Cloud Dependency"

**Animations:** Staggered StaggerContainer for both grids, float icons

---

### 3. Architecture (`Architecture.tsx`)
**Location:** `#architecture`

**Features:**
- Header with badge "Dual-Actian Architecture"
- 4 interactive layer cards (clickable tabs):
  1. **Edge / Classroom** (cyan) - Muffliato PWA, Whisper.cpp, Actian Zen Buffer
  2. **On-Prem School Server** (gold) - Actian VectorAI DB, Actian Vector, FastAPI, bge-small
  3. **Cloud (Generative Only)** (amber) - Gemini API, ElevenLabs API
  4. **Teacher Dashboard** (emerald) - Marauder's Radar, Pensieve Analytics
- Active layer highlights components with staggered animation
- Data flow visualization (6 steps with icons):
  1. Lecturer Talks → 2. Student Pings → 3. Threshold Trigger → 4. Gemini Rewrite → 5. ElevenLabs TTS → 6. Analytics Accumulate
- Live latency budget table (5 items with badges):
  - Ping → Radar: <100ms (Sub-second)
  - VectorAI DB Search: <50ms (On-prem)
  - Gemini Rewrite: ~800ms (Cloud)
  - ElevenLabs TTS: ~600ms (Cloud)
  - **Total: ~1.5s (Target)**
- "Unplug" moment insight card explaining the offline demo

**Interactions:** Click layer cards to switch active, scroll-triggered layer activation via IntersectionObserver

---

### 4. The Six Spells (`Spells.tsx`)
**Location:** `#spells`

**Features:**
- Header: "Every Component Carries a Spell Name"
- 6 spell cards (dark variant, spell-themed borders, hover effects):
  1. **Muffliato** (cyan) - Confusion Capture Agent
  2. **Marauder's Radar** (gold) - Real-Time Radar Visualization
  3. **Accio Analogy** (orange) - Retrieval Engine
  4. **Gemino** (purple) - Analogy Rewriter
  5. **Sonorus** (yellow) - Voice Re-delivery
  6. **Pensieve** (purple) - Teacher Analytics Dashboard
- Each card: icon, name, tagline, latency badge, description, tech stack tags, expandable implementation details
- Spell interaction flow diagram at bottom showing data flow:
  Muffliato → Marauder's Radar → Accio → Gemino → Sonorus
  (Pensieve runs in parallel)

---

### 5. Live Demo Preview (`LiveDemo.tsx`)
**Location:** `#live-demo`

**Features:**
- 3 tabs: Marauder's Radar | Accio Analogy | Latency Budget
- **Radar Tab:** SVG radial heatmap with:
  - 4 concentric circles, crosshairs
  - Animated pulse rings (3 rings, staggered)
  - 6 concept nodes with density-based positioning/sizing
  - Hot nodes (Chain Rule, Backprop) pulse animation
  - Legend with density indicators
  - Node details sidebar with density bars
  - Timeline chart (SVG) with threshold line
- **Analogy Tab:** Card showing:
  - Original explanation vs Gemini rewrite (cricketer analogy)
  - Latency breakdown badges (Embedding/Retrieval/Gemini)
  - Audio player UI with animated waveform
- **Latency Tab:** 5 cards showing latency budget with progress bars and badges
- Demo tip card (parchment) explaining the "unplug" moment

---

### 6. Team (`Team.tsx`)
**Location:** `#team`

**Features:**
- Header: "The Four House Heads"
- 4 member cards (dark variant, spell-themed):
  1. **Sourodyuti Biswas Sanyal** - Backend/Actian Lead (Accio) - Python, FastAPI, Actian, Qdrant, WebSockets
  2. **AI/ML Lead** - AI/ML Lead (Gemino) - PyTorch, Transformers, Gemini API, ElevenLabs
  3. **Frontend Lead** - Frontend Lead (Marauder's Radar) - Next.js, TypeScript, D3.js, Recharts
  4. **Demo/PM Lead** - Demo/PM Lead (Sonorus) - Product, Storytelling, Devfolio, GitHub Pages
- Each: avatar (initials, spell gradient), name, role badge, description, skill badges, GitHub/LinkedIn links
- Advisors section (2 cards, parchment variant)
- JIS University card with logo, name, location, pilot partner tag, "View Pilot Proposal" button

---

### 7. Sponsors & Tracks (`Sponsors.tsx`)
**Location:** `#sponsors`

**Features:**
- 5 sponsor cards (dark variant, spell-themed):
  1. **Actian** (Primary) - VectorAI DB + Vector Analytics + Zen edge
  2. **Google Gemini** (Bonus) - Analogy rewrite (Gemini 2.5 Flash)
  3. **ElevenLabs** (Bonus) - Calm tutor TTS (Rachel voice)
  4. **DigitalOcean** (Bonus) - Optional multi-school droplet
  5. **GitHub** (Bonus) - Repo + Pages + Devfolio
- Each: custom SVG logo placeholder, tier badge, description, tech tags, "View Sponsor" link
- Devfolio track badges:
  - Education (Primary)
  - Actian, Gemini, ElevenLabs, DigitalOcean, GitHub
- Hackathon info card (parchment): HexaFalls 2, Harry Potter themed, JIS University Kolkata, tracks

---

### 8. Footer (`Footer.tsx`)
**Location:** `#contact`

**Features:**
- Brand section: Legilimens logo, tagline, social links (GitHub, LinkedIn, Devfolio, Email)
- Navigation grid (4 columns):
  - Project: GitHub, Devfolio, Architecture, Live Demo
  - Spells: All 6 spell sections
  - Resources: Actian docs, bge-small, Gemini API, ElevenLabs API, Qdrant, HexaFalls
  - Team: All 4 members
- CTA section: "Ready to Bring Legilimens to Your Classroom?" with "Request Pilot Proposal" and "View Devfolio Submission" buttons
- Bottom: MIT license, "Built with ♥ by Legilimens Team for HexaFalls 2 · Open Source"

---

## Key Technical Implementation Details

### ScrollReveal (`ScrollReveal.tsx`)
- Uses `IntersectionObserver` for performant scroll animations
- Supports 5 directions: up, down, left, right, scale
- Configurable threshold, rootMargin, triggerOnce, delay
- `StaggerContainer` wrapper for staggered children with configurable delay
- Respects `prefers-reduced-motion`

### FloatingBackground (`FloatingBackground.tsx`)
- Generates configurable particles (gold/cyan/silver)
- CSS-based floating animation with randomized delays/durations
- Ambient glow elements
- Spell-themed color palettes per section
- Respects `prefers-reduced-motion`

### CustomCursor (`CustomCursor.tsx`)
- Desktop-only wand cursor with follower ring
- Hover state expands on interactive elements
- Click sparkle animation
- Hidden on mobile/reduced motion via media queries

### Back to Top Button (`page.module.css` + `page.tsx`)
- Fixed position, appears after 300px scroll
- Gold gradient, glow shadow
- Smooth scroll to `#top`

### Skip Link
- Accessible skip-to-main-content link
- Hidden until focus (WCAG compliant)

---

## Placeholders Requiring Replacement

| Placeholder | Location | What to Replace |
|-------------|----------|-----------------|
| Team member names/avatars | `Team.tsx` lines 10-50 | Real names, GitHub/LinkedIn URLs, avatars |
| Advisor names | `Team.tsx` lines 70-80 | Real advisor names and departments |
| Sponsor logos | `Sponsors.tsx` lines 30-70 | Real SVG logos for Actian, Gemini, ElevenLabs, DO, GitHub |
| Pilot proposal link | `Team.tsx` line 110, `Footer.tsx` line 60 | Actual proposal PDF/URL |
| Devfolio submission URL | `Footer.tsx` line 65, `Sponsors.tsx` | Real Devfolio project URL |
| GitHub repo URL | Multiple locations | `https://github.com/Sourodyuti/TeamTraction` |
| Demo video | `Footer.tsx` / `page.tsx` | 90-second demo video embed |
| JIS University logo | `Team.tsx` line 95 | Real JIS University logo SVG |
| Lecturer/lecture content | `LiveDemo.tsx` mock data | Real backprop lecture transcript |
| API keys | `.env.local` | `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` |

---

## Deployment

### Build
```bash
cd frontend
npm run build
```

### Deploy to GitHub Pages
```bash
# Add to package.json scripts:
"deploy": "next build && touch out/.nojekyll && gh-pages -d out"

# Configure next.config.js:
output: 'export',
images: { unoptimized: true },
```

### Environment Variables (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
GEMINI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
```

---

## Dependencies

**Production:**
- `next@14.2.x` - React framework
- `react@18.3.x` - UI library
- `react-dom@18.3.x`
- `d3@7.9.x` - Radar visualization (for dashboard)
- `recharts@2.12.x` - Timeline charts (for dashboard)

**Development:**
- `typescript@5.4.x`
- `eslint@8.x`, `eslint-config-next@14.2.x`
- `@types/node@20.x`, `@types/react@18.3.x`, `@types/react-dom@18.3.x`, `@types/d3@7.4.x`

---

## Accessibility (WCAG 2.1 AA)

- Semantic HTML5 (`<main>`, `<section>`, `<header>`, `<footer>`, `<nav>`)
- ARIA labels on all interactive elements
- Skip to main content link
- Focus visible outlines (gold)
- Color contrast ratios (gold on dark, gold on parchment)
- `prefers-reduced-motion` respected globally
- Alt text for decorative SVGs (aria-hidden), meaningful images
- Keyboard navigable (Tab order, Enter activation)

---

## Performance Optimizations

- Static generation (`output: 'export'`) for GitHub Pages
- Code splitting by page/section
- CSS Modules for scoped styles (no runtime CSS-in-JS)
- Font preloading in layout (`Cinzel`, `Inter`)
- SVG icons inlined (no font icon requests)
- Lazy-loaded images (when added)
- Minimal JS bundle (~110kB First Load JS shared)

---

## Browser Support

- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- CSS Custom Properties (variables)
- IntersectionObserver API
- CSS Grid / Flexbox
- ES2020+ JavaScript

---

## Future Enhancements

1. **Dashboard pages** (`/dashboard`, `/dashboard/pensieve`) - connect to live WebSocket data
2. **PWA manifest** - installable Muffliato student app
3. **i18n** - multi-language support
4. **Analytics** - privacy-respecting usage tracking
5. **Theme toggle** - light/parchment mode