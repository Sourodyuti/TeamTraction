"use client";

import { ScrollReveal, StaggerContainer } from "@/components/ui/ScrollReveal";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import styles from "./ProblemSolution.module.css";

const problems = [
  {
    icon: "📉",
    title: "Silent Drowning",
    description: "40% of students silently struggle without signaling confusion. Professors only discover gaps at exam time — when it's too late.",
    stat: "40%",
    spell: "muffliato",
  },
  {
    icon: "⏱️",
    title: "Lost Moments",
    description: "The exact second a concept slips is gone forever. No way to revisit, re-explain, or re-teach that specific moment.",
    stat: "∞",
    spell: "marauders",
  },
  {
    icon: "🔒",
    title: "Data Cannot Leave",
    description: "India's DPDP Act and institutional trust require student voice and struggle data to stay on-prem. Cloud RAG is disqualified.",
    stat: "0",
    spell: "accio",
  },
  {
    icon: "🌐",
    title: "Flaky Infrastructure",
    description: "Tier-3 classrooms have unreliable Wi-Fi. Any cloud-dependent system fails when the connection drops.",
    stat: "99%",
    spell: "pensieve",
  },
];

const solutions = [
  {
    icon: "🪄",
    title: "Muffliato — Silent Capture",
    description: "Big, thumb-friendly buttons on student phones: \"I'm lost\", \"Got it\", \"Slower\". No disruption, no stigma. Pings reach FastAPI in <100ms.",
    spell: "muffliato",
  },
  {
    icon: "🗺️",
    title: "Marauder's Radar — Live Viz",
    description: "D3 radial heatmap + timeline shows confusion density per concept node in real-time. Judges see minds flare red on cue.",
    spell: "marauders",
  },
  {
    icon: "📚",
    title: "Accio Analogy — On-Prem Retrieval",
    description: "Actian VectorAI DB (Qdrant) runs entirely on the school server. Semantic search returns best past explanation in <50ms. Zero cloud calls.",
    spell: "accio",
  },
  {
    icon: "✨",
    title: "Gemino + Sonorus — Personalized Re-teach",
    description: "Gemini rewrites the explanation as a 2-sentence analogy for the student's interest (cricketer/gamer/cook). ElevenLabs speaks it back calmly.",
    spell: "gemino",
  },
  {
    icon: "🏺",
    title: "Pensieve — Post-Lecture Analytics",
    description: "Actian Vector columnar SQL powers top-3 worst moments, rolling density, cohort heatmaps. One-click re-teach plans.",
    spell: "pensieve",
  },
  {
    icon: "🔌",
    title: "Offline-First Architecture",
    description: "Pull the Ethernet cable — radar still updates, retrieval still works, analytics still query. Actian Zen edge buffer queues pings locally.",
    spell: "sonorus",
  },
];

export function ProblemSolution() {
  return (
    <section id="problem-solution" className={styles.section} aria-labelledby="ps-title">
      <FloatingBackground particleCount={25} spellTheme="marauders" />
      
      <div className={styles.container}>
        <ScrollReveal direction="up">
          <header className={styles.header}>
            <Badge variant="gold" size="md">The Problem → The Spell</Badge>
            <h2 id="ps-title" className={styles.title}>
              Why <span className={styles.highlight}>Legilimens</span> Exists
            </h2>
            <p className={styles.description}>
              Every component maps to a real classroom pain point — and each carries a spell name 
              from the Harry Potter universe. This isn't theming for show; it's structural coherence.
            </p>
          </header>
        </ScrollReveal>

        {/* Problems */}
        <ScrollReveal direction="up" delay={100}>
          <div className={styles.gridSection}>
            <h3 className={styles.gridTitle}>
              <span className={styles.gridIcon}>📉</span>
              Four Pains That Break Learning
            </h3>
            <div className={styles.problemsGrid}>
              {problems.map((problem, index) => (
                <StaggerContainer key={problem.title} staggerDelay={100} triggerOnce={true}>
                  <Card variant="dark" spell={problem.spell as any} hover className={styles.problemCard}>
                    <CardHeader>
                      <div className={styles.problemIcon}>{problem.icon}</div>
                      <Badge variant="gold" size="sm" spell={problem.spell as any} className={styles.problemStat}>
                        {problem.stat} affected
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <h4 className={styles.problemTitle}>{problem.title}</h4>
                      <p className={styles.problemDescription}>{problem.description}</p>
                    </CardContent>
                  </Card>
                </StaggerContainer>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Solutions */}
        <ScrollReveal direction="up" delay={200}>
          <div className={styles.gridSection}>
            <h3 className={styles.gridTitle}>
              <span className={styles.gridIcon}>✨</span>
              Six Spells That Fix It
            </h3>
            <div className={styles.solutionsGrid}>
              {solutions.map((solution, index) => (
                <StaggerContainer key={solution.title} staggerDelay={100} triggerOnce={true}>
                  <Card variant="dark" spell={solution.spell as any} hover className={styles.solutionCard}>
                    <CardHeader>
                      <div className={styles.solutionIcon}>{solution.icon}</div>
                      <Badge variant="gold" size="sm" spell={solution.spell as any} className={styles.solutionSpell}>
                        {solution.spell.charAt(0).toUpperCase() + solution.spell.slice(1)}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <h4 className={styles.solutionTitle}>{solution.title}</h4>
                      <p className={styles.solutionDescription}>{solution.description}</p>
                    </CardContent>
                  </Card>
                </StaggerContainer>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Key differentiator */}
        <ScrollReveal direction="up" delay={300}>
          <div className={styles.differentiator}>
            <div className={styles.differentiatorIcon}>
              <svg width="48" height="48" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                <circle cx="50" cy="50" r="45" stroke="var(--gold)" stroke-width="2" stroke-dasharray="8 4" />
                <path d="M50 20 L50 80 M20 50 L80 50" stroke="var(--gold)" stroke-width="2" />
                <circle cx="50" cy="50" r="8" fill="var(--gold)" />
              </svg>
            </div>
            <div>
              <h3 className={styles.differentiatorTitle}>
                The Actian Edge: <span className={styles.differentiatorHighlight}>Zero Cloud Dependency</span>
              </h3>
              <p className={styles.differentiatorDescription}>
                Unlike every other RAG demo at this hackathon, Legilimens doesn't just "use Actian" — 
                it <strong>structurally depends</strong> on Actian. The entire student-data path (capture → embed → retrieve → analytics) 
                runs on the school server. Pull the cable and the magic still works. That's not a demo trick — that's architecture.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}