"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import Link from "next/link";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section id="hero" className={styles.hero} aria-labelledby="hero-title">
      <FloatingBackground particleCount={40} />
      
      <div className={styles.content}>
        <ScrollReveal direction="down" delay={100}>
          <div className={styles.badgeWrapper}>
            <Badge variant="gold" size="md">
              🔮 Legilimens — Live Classroom Confusion Radar
            </Badge>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={200}>
          <h1 id="hero-title" className={styles.title}>
            <span className={styles.titleLine}>The Spell That Reads</span>
            <span className={styles.titleLine} style={{ animationDelay: '100ms' }}>
              <span className={styles.titleHighlight}>Collective Minds</span>
            </span>
            <span className={styles.titleLine} style={{ animationDelay: '200ms' }}>
              In Real Time
            </span>
          </h1>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={400}>
          <p className={styles.subtitle}>
            A real-time "mind-reading" layer for live classrooms that detects
            <strong>where</strong> and <strong>when</strong> students collectively get lost,
            then instantly re-explains that exact moment using a freshly-generated analogy
            pulled from each student's own interest graph.
          </p>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={500}>
          <div className={styles.tagline}>
            <span className={styles.quoteMark}>&ldquo;</span>
            <em>"Professors, you've all taught a room where 40% silently drowned — and you never knew. 
            Legilimens is the radar that catches it, and the spell that fixes it, in under a second, 
            on the school's own server."</em>
            <span className={styles.quoteMark}>&rdquo;</span>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={600}>
          <div className={styles.ctaGroup}>
            <Link href="/muffliato" passHref legacyBehavior>
              <Button size="lg" variant="gold" spell="marauders" className={styles.ctaPrimary}>
                View Live Demo
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
            </Link>
            <Button size="lg" variant="ghost" className={styles.ctaSecondary}>
              Read the Blueprint
            </Button>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={700}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue} data-target="1500">~1.5s</span>
              <span className={styles.statLabel}>End-to-end latency</span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.stat}>
              <span className={styles.statValue} data-target="50">{"<50ms"}</span>
              <span className={styles.statLabel}>VectorAI retrieval</span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.stat}>
              <span className={styles.statValue} data-target="100">{"<100ms"}</span>
              <span className={styles.statLabel}>Ping → Radar</span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.stat}>
              <span className={styles.statValue} data-target="0">0</span>
              <span className={styles.statLabel}>Cloud calls for retrieval</span>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal direction="up" delay={800}>
          <div className={styles.sponsorBadges} aria-label="Sponsor tracks">
            <Badge variant="gold" size="sm">Actian (Primary)</Badge>
            <Badge variant="cyan" size="sm">Gemini</Badge>
            <Badge variant="amber" size="sm">ElevenLabs</Badge>
            <Badge variant="emerald" size="sm">DigitalOcean</Badge>
            <Badge variant="crimson" size="sm">GitHub</Badge>
          </div>
        </ScrollReveal>
      </div>

      {/* Floating decorative elements */}
      <div className={styles.floatingElements} aria-hidden="true">
        <div className={styles.wand} />
        <div className={styles.snitch} />
        <div className={styles.sparkle} style={{ top: '20%', left: '10%' }} />
        <div className={styles.sparkle} style={{ top: '60%', right: '15%' }} />
        <div className={styles.sparkle} style={{ bottom: '30%', left: '20%' }} />
      </div>

      {/* Scroll indicator */}
      <div className={styles.scrollIndicator} aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
        <span>Scroll to explore</span>
      </div>
    </section>
  );
}