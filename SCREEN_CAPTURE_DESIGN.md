# Screen Capture & Overlay Feature Design

> **Sponsor Integration:** Gemini (multimodal analysis), ElevenLabs (audio alerts)

---

## Use Cases Analysis

### Teacher Dashboard (Screen Capture In)

| Use Case | Trigger | Sponsor Used | Output |
|----------|---------|--------------|--------|
| **1. Confusion Alert Overlay** | ≥N students press "I'm lost" | ElevenLabs TTS | Audio alert + visual badge on teacher's lecture slides |
| **2. Real-time Class Emotion Monitor** | Continuous | Gemini Vision | Sentiment analysis of shared screen + student faces |
| **3. Slide Context Awareness** | Slide change detected | Gemini Vision | Auto-update concept_node based on slide content OCR |
| **4. Lecture Pace Analyzer** | Every 30s | Gemini Vision | Detect if teacher is going too fast/slow based on slide progression |
| **5. Auto-Generate Follow-up Questions** | After concept explanation | Gemini Text | Suggest comprehension check questions for class |

### Student Dashboard (Screen Capture In)

| Use Case | Trigger | Sponsor Used | Output |
|----------|---------|--------------|--------|
| **1. Personal Analogy Overlay** | Student marks a doubt | Gemini + ElevenLabs | Analogy appears as overlay on their screen |
| **2. Note-Taking Assistant** | Manual trigger | Gemini Vision | OCR + summarize current slide into notes |
| **3. Concept Highlight** | Screen capture gesture | Gemini Vision | Highlight key terms on slide with definitions |
| **4. Practice Problem Generator** | After difficult concept | Gemini Text | Generate practice problem based on current slide |
| **5. Peer Help Indicator** | Multiple students stuck on same concept | N/A | Show "3 others also have doubts" prompt |

---

## Recommended Implementation (MVP)

### Priority 1: Teacher Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ TEACHER SCREEN (shared window)                                       │
│  [PowerPoint/Whiteboard with lecture content]                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ OVERLAY: "⚠️ 3 students lost on 'Chain Rule'"                │  │
│  │ [Re-explain] [Continue] [Show Analogy]                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ RADAR MINI: ●●●○○ (confusion density)                        │  │
│  │ Latency: 38ms retrieval | 0 cloud calls                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Features:
1. **Confusion Alert Overlay** - When threshold met, show alert with:
   - Number of confused students
   - Concept node causing confusion
   - Recommended action (re-explain/continue)
   - Play audio alert via ElevenLabs

2. **Screen Context Awareness** - Use Gemini Vision to:
   - OCR current slide content
   - Auto-detect concept being discussed
   - Update `topic_node` automatically

3. **Real-time Stats Badge** - Show:
   - Confusion density (radar mini)
   - Retrieval latency badge
   - Number of active students

---

### Priority 2: Student Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ STUDENT SCREEN (shared window - watching lecture)                    │
│  [Lecture content - could be any window]                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🎯 OVERLAY: "Chain Rule - Cricket Analogy"                  │  │
│  │ ─────────────────────────────────────────────────────────────│  │
│  │ "Think of derivatives like a cricket team passing the ball.  │  │
│  │  The outer player catches, then passes to the inner..."      │  │
│  │                                                              │  │
│  │ [🔊 Listen] [📝 Save to Notes] [✓ Got it now]               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ YOUR SIGNALS: [🪄 I'm lost] [✅ Got it] [⏩ Slower]          │  │
│  │ Your interest: [Cricket ▼]                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

#### Features:
1. **Analogy Overlay** - When analogy generated:
   - Show as floating overlay on their screen
   - Option to listen (ElevenLabs TTS)
   - Save to personal notes

2. **Signal Buttons** - Always visible:
   - "I'm lost" / "Got it" / "Slower"
   - Interest avatar selector

3. **Peer Context** (optional):
   - "3 others also confused on this"
   - Encourages asking questions

---

## Technical Architecture

### Screen Capture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ TEACHER DASHBOARD                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  1. Teacher clicks "Share Lecture Window"                           │
│  2. Browser prompts for window selection (getDisplayMedia API)      │
│  3. Selected window is:                                             │
│     - Broadcast to students via WebRTC                               │
│     - Analyzed by Gemini Vision every 5s for context               │
│     - Displayed with overlay alerts                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (WebSocket broadcast)
┌─────────────────────────────────────────────────────────────────────┐
│ STUDENT DASHBOARD                                                   │
├─────────────────────────────────────────────────────────────────────┤
│  1. Student receives shared screen stream                           │
│  2. Shows lecture content with overlay controls                     │
│  3. Student presses "I'm lost"                                      │
│  4. Backend detects threshold                                       │
│  5. Gemini generates analogy → ElevenLabs speaks → Overlay shows   │
└─────────────────────────────────────────────────────────────────────┘
```

### API Endpoints (New)

```
POST /screen/share-start         - Teacher starts screen share
POST /screen/share-stop          - Teacher stops screen share
POST /screen/context-update      - Gemini analyzes current frame
GET  /screen/stream/{lecture_id} - Students get stream URL
POST /screen/overlay/dismiss     - Dismiss overlay alert
```

### WebSocket Messages (New)

```typescript
// Teacher receives
{ type: "confusion_alert", lecture_id, concept_node, count, recommendation }
{ type: "context_detected", concept_node, slide_text }

// Student receives
{ type: "analogy_overlay", concept_node, analogy_text, audio_url }
{ type: "peer_context", concept_node, peer_count }
```

---

## Sponsor Usage Verification

| Feature | Sponsor | How Used |
|---------|---------|----------|
| **Vector Search** | Actian VectorAI DB | Retrieval of past explanations (CORE) |
| **Analytics SQL** | Actian Vector | Confusion event storage & queries (CORE) |
| **Analogy Generation** | Gemini API | Rewrite explanations per avatar (CORE) |
| **Voice Delivery** | ElevenLabs TTS | Speak analogies to students (CORE) |
| **Screen Understanding** | Gemini Vision | OCR + context detection from slides (NEW) |
| **Audio Alerts** | ElevenLabs TTS | Alert teacher when threshold met (NEW) |

### No Alternatives Used

- **No Whisper/OceanAudio ASR** → Using ElevenLabs Scribe if needed
- **No OpenAI GPT** → Using Gemini exclusively
- **No AWS/Azure TTS** → Using ElevenLabs exclusively
- **No Pinecone/Weaviate** → Using Actian VectorAI DB exclusively

---

## Implementation Priority

### Phase A: Teacher Alert System (Core)
1. Add confusion threshold detection in WebSocket handler
2. Send alert overlay to teacher when threshold met
3. Play audio alert via ElevenLabs
4. Show recommended action

### Phase B: Screen Capture (Enhancement)
1. Add `getDisplayMedia` for teacher to share lecture window
2. Broadcast stream to students
3. Analyze frames with Gemini Vision for context
4. Auto-update `topic_node` from slide content

### Phase C: Student Overlay (Enhancement)
1. Show analogy as floating overlay
2. Add "Listen" button for TTS
3. Add "Save to Notes" button
4. Show peer context ("3 others also confused")

---

## Code Locations to Modify

```
backend/
├── routers/
│   ├── websocket.py      # Add confusion_alert broadcast to teacher
│   └── screen.py         # NEW: Screen share endpoints
├── services/
│   └── gemini_vision.py  # NEW: Gemini Vision client

frontend/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Add overlay components
│   │   └── student/
│   │       └── page.tsx            # NEW: Student dashboard
│   ├── components/
│   │   ├── overlay/
│   │   │   ├── TeacherAlert.tsx    # NEW: Confusion alert overlay
│   │   │   ├── StudentAnalogy.tsx  # NEW: Analogy overlay
│   │   │   └── ScreenShare.tsx     # NEW: Screen capture component
│   │   └── dashboard/
│   │       └── SignalButtons.tsx   # Student signal controls
│   └── hooks/
│       ├── useScreenShare.ts       # NEW: Screen capture hook
│       └── useOverlay.ts           # NEW: Overlay state management
```
