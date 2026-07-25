"use client";

import { useState, useRef, useEffect } from "react";
import { ScrollReveal, StaggerContainer } from "@/components/ui/ScrollReveal";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import styles from "./Architecture.module.css";

const layers = [
  {
    id: "edge",
    title: "Edge / Classroom",
    icon: "📱",
    color: "cyan",
    components: [
      { name: "Muffliato PWA", desc: "Student phone buttons: \"I'm lost\" / \"Got it\" / \"Slower\"", spell: "muffliato" },
      { name: "Whisper.cpp", desc: "Local ASR of lecture audio (~15s chunks)", spell: "marauders" },
      { name: "Actian Zen Buffer", desc: "Offline ping queue on Pi/laptop", spell: "pensieve" },
    ],
  },
  {
    id: "core",
    title: "On-Prem School Server",
    icon: "🏫",
    color: "gold",
    components: [
      { name: "Actian VectorAI DB", desc: "Semantic retrieval (384-dim, Cosine, gRPC :6574)", spell: "accio" },
      { name: "Actian Vector", desc: "Columnar SQL analytics (confusion_events)", spell: "pensieve" },
      { name: "FastAPI Orchestrator", desc: "WebSocket hub + REST + threshold trigger", spell: "marauders" },
      { name: "bge-small Embedder", desc: "Local 384-dim embeddings (CPU)", spell: "gemino" },
    ],
  },
  {
    id: "cloud",
    title: "Cloud (Generative Only)",
    icon: "☁️",
    color: "amber",
    components: [
      { name: "Gemini API", desc: "Analogy rewrite per student interest profile", spell: "gemino" },
      { name: "ElevenLabs API", desc: "Calm tutor voice TTS streaming", spell: "sonorus" },
    ],
  },
  {
    id: "ui",
    title: "Teacher Dashboard",
    icon: "📊",
    color: "emerald",
    components: [
      { name: "Marauder's Radar", desc: "D3 radial heatmap + timeline (live WebSocket)", spell: "marauders" },
      { name: "Pensieve Analytics", desc: "Post-lecture \"worst moments\" report (Actian Vector SQL)", spell: "pensieve" },
    ],
  },
];

const dataFlowSteps = [
  { step: 1, title: "Lecturer Talks", desc: "Whisper.cpp transcribes → chunks ~15s → bge-small embeds → VectorAI DB upsert", icons: ["🎤", "✂️", "🔢", "📚"] },
  { step: 2, title: "Student Pings", desc: "\"I'm lost\" button → WebSocket ping {student_id, ts} → FastAPI tags to concept_node", icons: ["🪄", "📡", "🏷️"] },
  { step: 3, title: "Threshold Trigger", desc: "≥2 students lost in 20s on same node → Accio fires → embed chunk → VectorAI search (top-3)", icons: ["⚡", "🔍", "📋"] },
  { step: 4, title: "Gemini Rewrite", desc: "Retrieved context + student avatar → \"Rewrite as 2-sentence analogy for {cricketer/gamer/cook}\"", icons: ["🤖", "✨", "📝"] },
  { step: 5, title: "ElevenLabs TTS", desc: "Analogy text → calm tutor voice (Rachel) → audio streamed back to lost students", icons: ["🔊", "🗣️", "📱"] },
  { step: 6, title: "Analytics Accumulate", desc: "Actian Vector logs confusion_events → Pensieve queries for worst moments report", icons: ["📊", "🏺", "📈"] },
];

export function Architecture() {
  const [activeLayer, setActiveLayer] = useState(0);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Intersection observer for scroll-triggered layer activation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = layers.findIndex((_, i) => layerRefs.current[i] === entry.target);
            if (index !== -1) setActiveLayer(index);
          }
        });
      },
      { threshold: 0.4, rootMargin: "-20% 0px -20% 0px" }
    );

    layerRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="architecture" className={styles.section} aria-labelledby="arch-title">
      <FloatingBackground particleCount={30} spellTheme="accio" />
      
      <div className={styles.container}>
        <ScrollReveal direction="up">
          <header className={styles.header}>
            <Badge variant="cyan" size="md">Dual-Actian Architecture</Badge>
            <h2 id="arch-title" className={styles.title}>
              Built on <span className={styles.highlight}>Two Actian Databases</span>
            </h2>
            <p className={styles.description}>
              VectorAI DB answers <strong>"which explanation"</strong> · Vector answers <strong>"when & how bad"</strong> · 
              Only the generative step crosses the network
            </p>
          </header>
        </ScrollReveal>

        {/* Layer cards */}
        <div className={styles.layersWrapper} role="tablist" aria-label="Architecture layers">
          {layers.map((layer, index) => (
            <ScrollReveal key={layer.id} direction="up" delay={index * 100}>
              <div
                ref={(el) => { layerRefs.current[index] = el; }}
                className={`${styles.layerCard} ${activeLayer === index ? styles.active : ""}`}
                role="tab"
                aria-selected={activeLayer === index}
                aria-controls={`${layer.id}-panel`}
                id={`${layer.id}-tab`}
                onClick={() => setActiveLayer(index)}
              >
                <div className={styles.layerHeader}>
                  <span className={styles.layerIcon} style={{ color: `var(--spell-${layer.color})` }}>
                    {layer.icon}
                  </span>
                  <div>
                    <h3 className={styles.layerTitle}>{layer.title}</h3>
                    <span className={styles.layerSubtitle}>
                      {layer.components.length} component{layer.components.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className={styles.layerIndicator} aria-hidden="true" />
                </div>
                <div
                  id={`${layer.id}-panel`}
                  role="tabpanel"
                  aria-labelledby={`${layer.id}-tab`}
                  className={styles.layerComponents}
                >
                  {layer.components.map((comp, i) => (
                    <div key={comp.name} className={`${styles.componentItem} ${activeLayer === index ? styles.visible : ""}`} style={{ transitionDelay: `${i * 80}ms` }}>
                      <Badge variant="gold" size="sm" spell={comp.spell as any} className={styles.componentSpell}>
                        {comp.spell.charAt(0).toUpperCase() + comp.spell.slice(1)}
                      </Badge>
                      <div className={styles.componentInfo}>
                        <strong className={styles.componentName}>{comp.name}</strong>
                        <span className={styles.componentDesc}>{comp.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Data flow */}
        <ScrollReveal direction="up" delay={500}>
          <div className={styles.dataFlow}>
            <h3 className={styles.flowTitle}>
              <span className={styles.flowIcon}>🔄</span>
              End-to-End Data Flow (~1.5s loop)
            </h3>
            <div className={styles.flowSteps}>
              {dataFlowSteps.map((step, index) => (
                <div key={step.step} className={`${styles.flowStep} ${index % 2 === 0 ? styles.alt : ""}`}>
                  <div className={styles.stepNumber}>{step.step}</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepHeader}>
                      <h4 className={styles.stepTitle}>{step.title}</h4>
                      <div className={styles.stepIcons} aria-hidden="true">
                        {step.icons.map((icon, i) => (
                          <span key={i} className={styles.stepIcon}>{icon}</span>
                        ))}
                      </div>
                    </div>
                    <p className={styles.stepDesc}>{step.desc}</p>
                  </div>
                  {index < dataFlowSteps.length - 1 && (
                    <div className={styles.stepConnector} aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M19 12l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Latency budget */}
        <ScrollReveal direction="up" delay={600}>
          <div className={styles.latencyBudget}>
            <h3 className={styles.budgetTitle}>
              <span className={styles.budgetIcon}>⏱️</span>
              Live Latency Budget (Displayed On-Screen)
            </h3>
            <div className={styles.budgetItems}>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}>Ping → Radar</span>
                <span className={styles.budgetValue}>{"< 100ms"}</span>
                <Badge variant="emerald" size="sm" className={styles.budgetBadge}>Sub-second</Badge>
              </div>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}>VectorAI DB Search</span>
                <span className={styles.budgetValue}>{"< 50ms"}</span>
                <Badge variant="cyan" size="sm" className={styles.budgetBadge}>On-prem</Badge>
              </div>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}>Gemini Rewrite</span>
                <span className={styles.budgetValue}>{"~800ms"}</span>
                <Badge variant="amber" size="sm" className={styles.budgetBadge}>Cloud</Badge>
              </div>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}>ElevenLabs TTS</span>
                <span className={styles.budgetValue}>{"~600ms"}</span>
                <Badge variant="crimson" size="sm" className={styles.budgetBadge}>Cloud</Badge>
              </div>
              <div className={styles.budgetItem}>
                <span className={styles.budgetLabel}><strong>Total</strong></span>
                <span className={styles.budgetValue}><strong>{"~1.5s"}</strong></span>
                <Badge variant="gold" size="sm" className={styles.budgetBadge}>Target</Badge>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Key insight */}
        <ScrollReveal direction="up" delay={700}>
          <div className={styles.insight}>
            <div className={styles.insightIcon}>
              <svg width="48" height="48" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                <circle cx="50" cy="50" r="45" stroke="var(--gold)" stroke-width="2" stroke-dasharray="8 4" />
                <path d="M50 20 L50 80 M20 50 L80 50" stroke="var(--gold)" stroke-width="2" />
                <circle cx="50" cy="50" r="8" fill="var(--gold)" />
              </svg>
            </div>
            <div>
              <h3 className={styles.insightTitle}>
                The <span className={styles.insightHighlight}>"Unplug" Moment</span>
              </h3>
              <p className={styles.insightDescription}>
                Because the <strong>entire student-data path</strong> (capture → embed → retrieve → analytics) 
                runs on the school server laptop, pulling the Ethernet cable doesn't stop the radar, 
                retrieval, or analytics. Only the Gemini rewrite + ElevenLabs TTS pause — 
                and we pre-cache one analogy for that exact demo moment.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}