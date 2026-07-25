"use client";

import { ScrollReveal, StaggerContainer } from "@/components/ui/ScrollReveal";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import styles from "./Spells.module.css";

const spells = [
  {
    id: "muffliato",
    name: "Muffliato",
    tagline: "Confusion Capture Agent",
    icon: "🪄",
    color: "muffliato",
    description: "Quietly listens to \"I'm lost\" pings without disrupting class. Big, thumb-friendly buttons on student phones: 🪄 \"I'm lost\" / ✅ \"Got it\" / ⏩ \"Slower\"",
    tech: ["Next.js PWA", "WebSocket", "LocalStorage for student ID"],
    latency: "<100ms ping → FastAPI",
    details: [
      "Generates anonymous student_id on first load",
      "Persists avatar choice (cricketer/gamer/cook) in localStorage",
      "Visual feedback on button press (ripple + color flash)",
      "Connection status indicator (🟢/🔴)",
      "Auto-reconnect with exponential backoff (max 5s)",
    ],
  },
  {
    id: "marauders",
    name: "Marauder's Radar",
    tagline: "Real-Time Radar Visualization",
    icon: "🗺️",
    color: "marauders",
    description: "Shows where minds are wandering, live. D3 radial heatmap + Recharts timeline. Concept nodes arranged radially, color intensity = confusion density.",
    tech: ["D3.js", "Recharts", "WebSocket live feed"],
    latency: "Live updates <1s",
    details: [
      "Radial heatmap: arc size = node weight, color = density (green→amber→red)",
      "Timeline: X=lecture time, Y=density %, red dashed threshold line",
      "Hover tooltips with exact density + timestamp",
      "Center shows lecture title + live student count",
      "Smooth D3 transitions on data updates",
      "Latency badge: \"edge retrieval: 38ms · 0 cloud calls\"",
    ],
  },
  {
    id: "accio",
    name: "Accio Analogy",
    tagline: "Retrieval Engine",
    icon: "📚",
    color: "accio",
    description: "Summons the best past explanation from the school's knowledge vault (Actian VectorAI DB). Semantic + hybrid search for the single best re-explanation.",
    tech: ["Actian VectorAI DB (Qdrant)", "bge-small-en", "Cosine similarity"],
    latency: "<50ms retrieval",
    details: [
      "Collection: lecture_chunks (384-dim, Cosine)",
      "Payload: {topic_node, subtopic, difficulty, source, timestamp}",
      "Trigger: ≥2 students \"lost\" in 20s on same concept_node",
      "Embeds confusing chunk → similarity search → top-3 hits",
      "On-screen badge: \"edge retrieval: 38ms · 0 cloud calls\"",
      "Pre-loaded textbook chapter as \"knowledge vault\"",
    ],
  },
  {
    id: "gemino",
    name: "Gemino",
    tagline: "Analogy Rewriter",
    icon: "✨",
    color: "gemino",
    description: "Duplicates & reshapes the explanation in the student's language. Gemini rewrites retrieved explanation as 2-sentence analogy for student's interest profile.",
    tech: ["Gemini 2.5 Flash", "google-genai SDK"],
    latency: "~800ms",
    details: [
      "Prompt: \"Rewrite as 2-sentence analogy for a {cricketer/gamer/cook}\"",
      "Retry logic (2 attempts) + fallback to raw explanation",
      "Rate limiting + 429/503 handling",
      "Student picks avatar on PWA → sent with every ping",
      "Vet analogy quality on real examples before demo",
    ],
  },
  {
    id: "sonorus",
    name: "Sonorus",
    tagline: "Voice Re-delivery",
    icon: "🔊",
    color: "sonorus",
    description: "Speaks the analogy back, calmly. ElevenLabs TTS streams audio back to the specific lost students' phones (targeted, not broadcast).",
    tech: ["ElevenLabs API", "Rachel voice", "MP3 streaming"],
    latency: "~600ms",
    details: [
      "Default voice: Rachel (calm tutor, 21m00Tcm4TlvDq8ikWAM)",
      "Streaming chunk collection → single MP3 bytes",
      "Graceful degradation: empty audio on error, never crashes",
      "Autoplay policy: first button press unlocks audio",
      "Visual: \"🔊 Legilimens is explaining...\" with pulsing animation",
      "Volume control + mute toggle on student PWA",
    ],
  },
  {
    id: "pensieve",
    name: "Pensieve",
    tagline: "Teacher Analytics Dashboard",
    icon: "🏺",
    color: "pensieve",
    description: "Re-view the lecture's worst moments and re-teach plans. Actian Vector columnar SQL powers top-3 worst moments, rolling density, cohort heatmaps.",
    tech: ["Actian Vector (ODBC)", "pyodbc", "SQL rollups"],
    latency: "Sub-second queries",
    details: [
      "Top-3 confusing moments: GROUP BY concept_node ORDER BY lost_count DESC",
      "Rolling 60s confusion density: window function over ts",
      "Per-cohort heatmaps: GROUP BY cohort, concept_node",
      "Dashboard: confusion heatmap timeline + ranked worst-moments list",
      "One-click \"re-teach plan\" button per moment (stub)",
      "Real Actian Vector SQL — not mocks",
    ],
  },
];

export function Spells() {
  return (
    <section id="spells" className={styles.section} aria-labelledby="spells-title">
      <FloatingBackground particleCount={25} spellTheme="gemino" />
      
      <div className={styles.container}>
        <ScrollReveal direction="up">
          <header className={styles.header}>
            <Badge variant="gold" size="md">Six Spells · One System</Badge>
            <h2 id="spells-title" className={styles.title}>
              Every Component Carries a <span className={styles.highlight}>Spell Name</span>
            </h2>
            <p className={styles.description}>
              Not decorative — each spell maps to a real architectural component. 
              The Harry Potter theme is structural coherence for a Harry Potter themed hackathon.
            </p>
          </header>
        </ScrollReveal>

        <StaggerContainer staggerDelay={120} triggerOnce={true}>
          <div className={styles.spellsGrid} role="list">
            {spells.map((spell) => (
              <ScrollReveal key={spell.id} direction="up" className={styles.spellCardWrapper}>
                <Card variant="dark" spell={spell.color as any} hover className={styles.spellCard} role="listitem">
                  <CardHeader>
                    <div className={styles.spellHeader}>
                      <span className={styles.spellIcon} aria-hidden="true">{spell.icon}</span>
                      <div className={styles.spellMeta}>
                        <h3 className={styles.spellName}>{spell.name}</h3>
                        <p className={styles.spellTagline}>{spell.tagline}</p>
                      </div>
                    </div>
                    <Badge size="sm" spell={spell.color as any} className={styles.spellLatency}>
                      {spell.latency}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className={styles.spellDescription}>{spell.description}</p>
                    
                    <div className={styles.spellTech}>
                      <span className={styles.techLabel}>Stack:</span>
                      <ul className={styles.techList}>
                        {spell.tech.map((t, i) => (
                          <li key={i} className={styles.techItem}>{t}</li>
                        ))}
                      </ul>
                    </div>

                    <details className={styles.spellDetails}>
                      <summary className={styles.spellDetailsSummary}>Implementation Details</summary>
                      <ul className={styles.detailsList}>
                        {spell.details.map((detail, i) => (
                          <li key={i} className={styles.detailItem}>{detail}</li>
                        ))}
                      </ul>
                    </details>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </StaggerContainer>

        {/* Spell interaction diagram */}
        <ScrollReveal direction="up" delay={300}>
          <div className={styles.interactionDiagram}>
            <h3 className={styles.diagramTitle}>Spell Interaction Flow</h3>
            <div className={styles.flowDiagram}>
              <div className={styles.flowRow}>
                <div className={styles.flowItem}>
                  <span className={styles.flowSpell} style={{ '--spell-color': 'var(--spell-muffliato)' } as React.CSSProperties}>Muffliato</span>
                  <span className={styles.flowArrow}>→</span>
                </div>
                <div className={styles.flowItem}>
                  <span className={styles.flowSpell} style={{ '--spell-color': 'var(--spell-marauders)' } as React.CSSProperties}>Marauder's Radar</span>
                  <span className={styles.flowArrow}>→</span>
                </div>
                <div className={styles.flowItem}>
                  <span className={styles.flowSpell} style={{ '--spell-color': 'var(--spell-accio)' } as React.CSSProperties}>Accio</span>
                  <span className={styles.flowArrow}>→</span>
                </div>
                <div className={styles.flowItem}>
                  <span className={styles.flowSpell} style={{ '--spell-color': 'var(--spell-gemino)' } as React.CSSProperties}>Gemino</span>
                  <span className={styles.flowArrow}>→</span>
                </div>
                <div className={styles.flowItem}>
                  <span className={styles.flowSpell} style={{ '--spell-color': 'var(--spell-sonorus)' } as React.CSSProperties}>Sonorus</span>
                </div>
              </div>
              <div className={styles.flowRow} style={{ justifyContent: 'center', marginTop: '1rem' } as React.CSSProperties}>
                <div className={styles.flowItem}>
                  <span className={styles.flowSpell} style={{ '--spell-color': 'var(--spell-pensieve)' } as React.CSSProperties}>Pensieve</span>
                </div>
                <p className={styles.flowNote}>Analytics run continuously in parallel</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}