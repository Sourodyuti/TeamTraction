"use client";

import { useState, useEffect, useRef } from "react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import styles from "./LiveDemo.module.css";

const mockRadarData = {
  nodes: [
    { name: "Chain Rule", angle: 0, density: 0.9, lost: 3, gotit: 0 },
    { name: "Backprop", angle: 60, density: 0.6, lost: 2, gotit: 1 },
    { name: "Gradient Descent", angle: 120, density: 0.3, lost: 1, gotit: 2 },
    { name: "Loss Functions", angle: 180, density: 0.2, lost: 0, gotit: 3 },
    { name: "Activation Fns", angle: 240, density: 0.4, lost: 1, gotit: 2 },
    { name: "Weight Init", angle: 300, density: 0.1, lost: 0, gotit: 2 },
  ],
  timeline: [
    { ts: 0, density: 0.1 },
    { ts: 30, density: 0.2 },
    { ts: 60, density: 0.4 },
    { ts: 90, density: 0.8 },
    { ts: 120, density: 0.6 },
    { ts: 150, density: 0.3 },
  ],
};

const mockAnalogy = {
  concept: "Chain Rule",
  avatar: "cricketer",
  original: "The chain rule computes derivatives of composite functions by multiplying the derivative of the outer function evaluated at the inner function by the derivative of the inner function.",
  analogy: "Think of the chain rule like a cricket batting partnership: the outer function is the striker facing the bowler (input), the inner function is the runner at the non-striker's end. The total runs (derivative) depend on how fast the striker scores (outer derivative) multiplied by how quickly the runner converts ones to twos (inner derivative). If either slows down, the partnership's run rate drops.",
  latency: { embedding: 12.3, retrieval: 8.7, gemini: 742.1 },
};

export function LiveDemo() {
  const [activeTab, setActiveTab] = useState<"radar" | "analogy" | "latency">("radar");
  const [radarPulse, setRadarPulse] = useState(0);
  const radarRef = useRef<SVGSVGElement>(null);

  // Simulate radar pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarPulse((p) => (p + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Simulate live latency updates
  useEffect(() => {
    const interval = setInterval(() => {
      // This would connect to real WebSocket in production
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="live-demo" className={styles.section} aria-labelledby="demo-title">
      <FloatingBackground particleCount={20} spellTheme="marauders" />
      
      <div className={styles.container}>
        <ScrollReveal direction="up">
          <header className={styles.header}>
            <Badge variant="cyan" size="md">Live Demo Preview</Badge>
            <h2 id="demo-title" className={styles.title}>
              See the <span className={styles.highlight}>Radar Flare</span> in Action
            </h2>
            <p className={styles.description}>
              This is a simulated preview of the Marauder's Radar and Accio Analogy flow. 
              In production, this connects to the FastAPI WebSocket hub at <code>ws://localhost:8000/ws/lecture/1</code>.
            </p>
          </header>
        </ScrollReveal>

        {/* Tab navigation */}
        <ScrollReveal direction="up" delay={100}>
          <div className={styles.tabs} role="tablist" aria-label="Demo views">
            <button
              role="tab"
              aria-selected={activeTab === "radar"}
              aria-controls="radar-panel"
              id="radar-tab"
              className={`${styles.tab} ${activeTab === "radar" ? styles.active : ""}`}
              onClick={() => setActiveTab("radar")}
            >
              <span className={styles.tabIcon}>🗺️</span>
              Marauder's Radar
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "analogy"}
              aria-controls="analogy-panel"
              id="analogy-tab"
              className={`${styles.tab} ${activeTab === "analogy" ? styles.active : ""}`}
              onClick={() => setActiveTab("analogy")}
            >
              <span className={styles.tabIcon}>✨</span>
              Accio Analogy
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "latency"}
              aria-controls="latency-panel"
              id="latency-tab"
              className={`${styles.tab} ${activeTab === "latency" ? styles.active : ""}`}
              onClick={() => setActiveTab("latency")}
            >
              <span className={styles.tabIcon}>⏱️</span>
              Latency Budget
            </button>
          </div>
        </ScrollReveal>

        {/* Radar View */}
        <ScrollReveal direction="up" delay={200}>
          <div role="tabpanel" id="radar-panel" aria-labelledby="radar-tab" hidden={activeTab !== "radar"}>
            <div className={styles.radarWrapper}>
              <div className={styles.radarContainer}>
                <svg
                  ref={radarRef}
                  viewBox="0 0 400 400"
                  className={styles.radarSvg}
                  aria-hidden="true"
                >
                  {/* Radar circles */}
                  <circle cx="200" cy="200" r="180" className={styles.radarCircle} />
                  <circle cx="200" cy="200" r="135" className={styles.radarCircle} />
                  <circle cx="200" cy="200" r="90" className={styles.radarCircle} />
                  <circle cx="200" cy="200" r="45" className={styles.radarCircle} />
                  
                  {/* Crosshairs */}
                  <line x1="200" y1="20" x2="200" y2="380" className={styles.radarCrosshair} />
                  <line x1="20" y1="200" x2="380" y2="200" className={styles.radarCrosshair} />
                  
                  {/* Pulse rings */}
                  {[0, 1, 2].map((i) => (
                    <circle
                      key={i}
                      cx="200"
                      cy="200"
                      r={45 + (radarPulse === i ? 135 : 0)}
                      className={`${styles.pulseRing} ${radarPulse === i ? styles.activePulse : ""}`}
                      style={{ transition: 'r 1.5s ease-out, opacity 1.5s ease-out' }}
                    />
                  ))}
                  
                  {/* Concept nodes */}
                  {mockRadarData.nodes.map((node, index) => {
                    const angle = (node.angle - 90) * (Math.PI / 180);
                    const radius = 180 * (0.3 + 0.7 * node.density);
                    const x = 200 + radius * Math.cos(angle);
                    const y = 200 + radius * Math.sin(angle);
                    const size = 12 + node.density * 20;
                    
                    return (
                      <g key={node.name} className={styles.nodeGroup} style={{ 
                        opacity: node.density > 0.5 ? 1 : 0.7 
                      }}>
                        <circle
                          cx={x}
                          cy={y}
                          r={size}
                          className={`${styles.node} ${node.density > 0.5 ? styles.nodeHot : ""}`}
                          style={{ 
                            fill: node.density > 0.5 ? 'var(--crimson)' : 'var(--gold)',
                            filter: node.density > 0.5 ? 'drop-shadow(0 0 8px var(--crimson))' : 'drop-shadow(0 0 8px var(--gold))',
                          }}
                        />
                        <text
                          x={x}
                          y={y - size - 4}
                          textAnchor="middle"
                          className={styles.nodeLabel}
                          fontSize="10"
                        >
                          {node.name}
                        </text>
                        <text
                          x={x}
                          y={y + size + 12}
                          textAnchor="middle"
                          className={styles.nodeStats}
                          fontSize="8"
                        >
                          🪄 {node.lost} ✅ {node.gotit}
                        </text>
                      </g>
                    );
                  })}
                  
                  {/* Center label */}
                  <text x="200" y="200" textAnchor="middle" className={styles.centerLabel}>
                    <tspan x="200" dy="-0.6em" fontSize="11" fill="var(--gold)">LECTURE 1</tspan>
                    <tspan x="200" dy="1.2em" fontSize="9" fill="var(--text-secondary)">9 active</tspan>
                  </text>
                </svg>
              </div>

              {/* Legend */}
              <div className={styles.radarLegend}>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendDot} ${styles.legendDotHot}`} />
                  <span>High confusion (≥2 lost)</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendDot} ${styles.legendDotWarm}`} />
                  <span>Moderate confusion</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendDot} ${styles.legendDotCool}`} />
                  <span>Low confusion</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendPulse}`} />
                  <span>Live pulse sweep</span>
                </div>
              </div>

              {/* Node details */}
              <div className={styles.nodeDetails}>
                <h4>Concept Nodes (Live)</h4>
                <div className={styles.nodeList}>
                  {mockRadarData.nodes.map((node) => (
                    <div key={node.name} className={`${styles.nodeItem} ${node.density > 0.5 ? styles.nodeItemHot : ""}`}>
                      <span className={styles.nodeItemName}>{node.name}</span>
                      <div className={styles.nodeItemStats}>
                        <Badge variant="crimson" size="sm" className={styles.nodeBadge}>🪄 {node.lost}</Badge>
                        <Badge variant="emerald" size="sm" className={styles.nodeBadge}>✅ {node.gotit}</Badge>
                        <div 
                          className={styles.nodeDensityBar}
                          style={{ width: `${node.density * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className={styles.timeline}>
              <h4>Confusion Density Timeline</h4>
              <svg viewBox="0 0 600 120" className={styles.timelineSvg} aria-hidden="true">
                {/* Axes */}
                <line x1="50" y1="100" x2="550" y2="100" stroke="var(--border-gold-transparent)" strokeWidth="1" />
                <line x1="50" y1="100" x2="50" y2="10" stroke="var(--border-gold-transparent)" strokeWidth="1" />
                
                {/* Threshold line */}
                <line x1="50" y1="40" x2="550" y2="40" stroke="var(--crimson)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                <text x="550" y="35" fill="var(--crimson)" fontSize="9" textAnchor="end" opacity="0.7">Accio Threshold</text>
                
                {/* Area */}
                <path
                  d={
                    mockRadarData.timeline
                      .map((p, i) => {
                        const x = 50 + (i / (mockRadarData.timeline.length - 1)) * 500;
                        const y = 100 - p.density * 80;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ') + ' L 550 100 L 50 100 Z'
                  }
                  fill="var(--crimson)"
                  fillOpacity="0.15"
                />
                
                {/* Line */}
                <path
                  d={
                    mockRadarData.timeline
                      .map((p, i) => {
                        const x = 50 + (i / (mockRadarData.timeline.length - 1)) * 500;
                        const y = 100 - p.density * 80;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ')
                  }
                  stroke="var(--crimson)"
                  strokeWidth="2"
                  fill="none"
                />
                
                {/* Points */}
                {mockRadarData.timeline.map((p, i) => {
                  const x = 50 + (i / (mockRadarData.timeline.length - 1)) * 500;
                  const y = 100 - p.density * 80;
                  return (
                    <circle key={i} cx={x} cy={y} r={4} fill="var(--gold)" stroke="var(--bg-primary)" strokeWidth="2" />
                  );
                })}
              </svg>
              <div className={styles.timelineLabels}>
                <span>0s</span>
                <span>30s</span>
                <span>60s</span>
                <span>90s</span>
                <span>120s</span>
                <span>150s</span>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Analogy View */}
        <ScrollReveal direction="up" delay={200}>
          <div role="tabpanel" id="analogy-panel" aria-labelledby="analogy-tab" hidden={activeTab !== "analogy"}>
            <Card variant="dark" spell="accio" className={styles.analogyCard}>
              <CardHeader>
                <div className={styles.analogyHeader}>
                  <div>
                    <Badge variant="amber" size="sm" spell="accio" className={styles.analogySpell}>
                      Accio Analogy
                    </Badge>
                    <h3 className={styles.analogyConcept}>{mockAnalogy.concept}</h3>
                  </div>
                  <Badge variant="gold" size="sm" spell={mockAnalogy.avatar as any} className={styles.analogyAvatar}>
                    {mockAnalogy.avatar.charAt(0).toUpperCase() + mockAnalogy.avatar.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className={styles.analogySection}>
                  <h4 className={styles.analogyLabel}>Original Explanation</h4>
                  <p className={styles.analogyText}>{mockAnalogy.original}</p>
                </div>
                <div className={styles.analogyDivider} aria-hidden="true">
                  <span className={styles.dividerIcon}>✦</span>
                </div>
                <div className={styles.analogySection}>
                  <h4 className={styles.analogyLabel}>Gemini Rewrite (2 sentences)</h4>
                  <p className={styles.analogyRewritten}>{mockAnalogy.analogy}</p>
                </div>
                <div className={styles.analogyMeta}>
                  <span className={styles.metaItem}>
                    <Badge variant="cyan" size="sm">Embedding: {mockAnalogy.latency.embedding.toFixed(1)}ms</Badge>
                  </span>
                  <span className={styles.metaItem}>
                    <Badge variant="amber" size="sm">Retrieval: {mockAnalogy.latency.retrieval.toFixed(1)}ms</Badge>
                  </span>
                  <span className={styles.metaItem}>
                    <Badge variant="crimson" size="sm">Gemini: {mockAnalogy.latency.gemini.toFixed(1)}ms</Badge>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Audio player simulation */}
            <Card variant="dark" spell="sonorus" className={styles.audioCard}>
              <CardHeader>
                <h3 className={styles.audioTitle}>🔊 Sonorus — Voice Re-delivery</h3>
              </CardHeader>
              <CardContent>
                <div className={styles.audioPlayer}>
                  <div className={styles.audioWaveform} aria-hidden="true">
                    {[0.3, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.3, 0.6, 0.9, 0.5, 0.8].map((h, i) => (
                      <div key={i} className={styles.waveBar} style={{ height: `${h * 100}%`, animationDelay: `${i * 50}ms` }} />
                    ))}
                  </div>
                  <div className={styles.audioControls}>
                    <Button variant="ghost" size="lg" className={styles.playButton}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Play Analogy Audio
                    </Button>
                    <span className={styles.audioInfo}>ElevenLabs · Rachel voice · ~600ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollReveal>

        {/* Latency View */}
        <ScrollReveal direction="up" delay={200}>
          <div role="tabpanel" id="latency-panel" aria-labelledby="latency-tab" hidden={activeTab !== "latency"}>
            <div className={styles.latencyGrid}>
              {[
                { label: "Ping → Radar", value: "< 100ms", badge: "Sub-second", variant: "emerald" as const },
                { label: "VectorAI DB Search", value: "< 50ms", badge: "On-prem", variant: "cyan" as const },
                { label: "Gemini Rewrite", value: "~800ms", badge: "Cloud", variant: "amber" as const },
                { label: "ElevenLabs TTS", value: "~600ms", badge: "Cloud", variant: "crimson" as const },
                { label: "<strong>Total</strong>", value: "<strong>~1.5s</strong>", badge: "Target", variant: "gold" as const },
              ].map((item, i) => (
                <Card key={item.label} variant="dark" className={`${styles.latencyCard} ${i === 4 ? styles.latencyCardTotal : ""}`}>
                  <CardContent>
                    <div className={styles.latencyItem}>
                      <span className={styles.latencyLabel} dangerouslySetInnerHTML={{ __html: item.label }} />
                      <span className={styles.latencyValue} dangerouslySetInnerHTML={{ __html: item.value }} />
                      <Badge variant={item.variant} size="sm" className={styles.latencyBadge}>{item.badge}</Badge>
                    </div>
                    <div className={styles.latencyBar}>
                      <div 
                        className={styles.latencyFill}
                        style={{ width: item.value.includes('1.5') ? '100%' : item.value.includes('800') ? '53%' : item.value.includes('600') ? '40%' : item.value.includes('100') ? '7%' : '3%' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card variant="parchment" className={styles.noteCard}>
              <CardContent>
                <p className={styles.noteText}>
                  <strong>💡 Demo Tip:</strong> These latency numbers are displayed live on the teacher dashboard during the 3-minute demo. 
                  The "edge retrieval: 38ms · 0 cloud calls" badge proves the Actian VectorAI DB runs entirely on-prem. 
                  When we pull the Ethernet cable, the retrieval badge stays at {"<50ms"} — only the Gemini + ElevenLabs steps pause.
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}