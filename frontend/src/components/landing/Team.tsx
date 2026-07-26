"use client";

import { ScrollReveal, StaggerContainer } from "@/components/ui/ScrollReveal";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import styles from "./Team.module.css";

const teamMembers = [
  {
    name: "Sourodyuti Biswas Sanyal",
    role: "Backend / Actian Lead",
    spell: "accio",
    avatar: "SB",
    description: "VectorAI DB + Vector + FastAPI orchestration. Docker Compose, WebSocket hub, retrieval pipeline.",
    skills: ["Python", "FastAPI", "Actian", "Qdrant", "WebSockets"],
    github: "https://github.com/Sourodyuti",
    linkedin: "https://linkedin.com/in/sourodyuti",
  },
  {
    name: "AI/ML Lead",
    role: "AI / ML Lead",
    spell: "gemino",
    avatar: "AI",
    description: "bge-small embedder, Gemini analogy rewrite, ElevenLabs TTS, data prep, offline cache.",
    skills: ["PyTorch", "Transformers", "Gemini API", "ElevenLabs", "Sentence Transformers"],
    github: "https://github.com",
    linkedin: "https://linkedin.com",
  },
  {
    name: "Frontend Lead",
    role: "Frontend Lead",
    spell: "marauders",
    avatar: "FE",
    description: "Muffliato PWA, Marauder's Radar (D3), Pensieve dashboard, Harry Potter theming.",
    skills: ["Next.js", "TypeScript", "D3.js", "Recharts", "Tailwind", "WebSockets"],
    github: "https://github.com",
    linkedin: "https://linkedin.com",
  },
  {
    name: "Demo / PM Lead",
    role: "Demo / PM Lead",
    spell: "sonorus",
    avatar: "PM",
    description: "Script, data prep, HP theming, Devfolio submission, rehearsal, landing page, GitHub Pages.",
    skills: ["Product", "Storytelling", "Devfolio", "GitHub Pages", "Video Editing", "Public Speaking"],
    github: "https://github.com",
    linkedin: "https://linkedin.com",
  },
];

const advisors = [
  { name: "Prof. Debajyoti Mukhopadhyay", role: "Faculty Advisor", dept: "CSE, JIS University" },
  { name: "Dr. Avijit Nandy", role: "Industry Mentor", dept: "Actian / HexaFalls" },
];

export function Team() {
  return (
    <section id="team" className={styles.section} aria-labelledby="team-title">
      <FloatingBackground particleCount={20} spellTheme="sonorus" />
      
      <div className={styles.container}>
        <ScrollReveal direction="up">
          <header className={styles.header}>
            <Badge variant="amber" size="md">The Four House Heads</Badge>
            <h2 id="team-title" className={styles.title}>
              Meet the <span className={styles.highlight}>Legilimens</span> Team
            </h2>
            <p className={styles.description}>
              Four members. Four lanes. Zero overlap. Each owns a spell — together they make the magic work.
            </p>
          </header>
        </ScrollReveal>

        <StaggerContainer staggerDelay={150} triggerOnce={true}>
          {teamMembers.map((member, index) => (
            <ScrollReveal key={member.name} direction="up" delay={index * 100}>
              <Card variant="dark" spell={member.spell as any} hover className={styles.memberCard}>
                <CardHeader>
                  <div className={styles.memberHeader}>
                    <div className={styles.avatar} style={{ background: `linear-gradient(135deg, var(--spell-${member.spell}), var(--spell-${member.spell}-dark, var(--spell-${member.spell})))` }}>
                      {member.avatar}
                    </div>
                    <div className={styles.memberInfo}>
                      <h3 className={styles.memberName}>{member.name}</h3>
                      <Badge variant="gold" size="sm" spell={member.spell as any} className={styles.memberRole}>
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className={styles.memberDescription}>{member.description}</p>
                  <div className={styles.skills} aria-label="Skills">
                    {member.skills.map((skill) => (
                      <Badge key={skill} variant="cyan" size="sm" className={styles.skillBadge}>
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  <div className={styles.memberLinks}>
                    <a href={member.github} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="GitHub">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                      </svg>
                    </a>
                    <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="LinkedIn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003zm-7.082 18.056h-3.554V12.312c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286z"/>
                      </svg>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </StaggerContainer>

        {/* Advisors */}
        <ScrollReveal direction="up" delay={200}>
          <div className={styles.advisors}>
            <h3 className={styles.advisorsTitle}>
              <span className={styles.advisorsIcon}>🧙</span>
              Advisors & Mentors
            </h3>
            <div className={styles.advisorsGrid}>
              {advisors.map((advisor, index) => (
                <Card key={advisor.name} variant="parchment" className={styles.advisorCard}>
                  <CardContent>
                    <div className={styles.advisorInfo}>
                      <strong className={styles.advisorName}>{advisor.name}</strong>
                      <span className={styles.advisorRole}>{advisor.role}</span>
                      <span className={styles.advisorDept}>{advisor.dept}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* University */}
        <ScrollReveal direction="up" delay={300}>
          <Card variant="parchment" className={styles.universityCard}>
            <CardContent>
              <div className={styles.universityInfo}>
                <div className={styles.universityLogo}>
                  <svg width="64" height="64" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                    <circle cx="50" cy="50" r="45" stroke="var(--gold)" stroke-width="2" />
                    <text x="50" y="58" text-anchor="middle" font-family="var(--font-display)" font-size="14" fill="var(--gold)" font-weight="700">JISU</text>
                  </svg>
                </div>
                <div>
                  <h3 className={styles.universityName}>JIS University</h3>
                  <p className={styles.universityLocation}>Agarpara, Kolkata, West Bengal</p>
                  <p className={styles.universityTagline}>Pilot Deployment Partner for Legilimens</p>
                </div>
              </div>
              <Button variant="ghost" className={styles.universityButton}>
                View Pilot Proposal
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}