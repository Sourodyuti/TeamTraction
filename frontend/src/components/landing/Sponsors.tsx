"use client";

import { ScrollReveal, StaggerContainer } from "@/components/ui/ScrollReveal";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import styles from "./Sponsors.module.css";

const sponsors = [
  {
    name: "Actian",
    tier: "Primary",
    description: "Dual-Actian architecture: VectorAI DB (on-prem retrieval) + Vector (columnar confusion analytics). The hero sponsor — our entire student-data path runs on Actian.",
    tracks: ["Actian (Primary)"],
    link: "https://www.actian.com",
    iconClass: "actian",
  },
  {
    name: "Google Gemini",
    tier: "Bonus",
    description: "Gemini 2.5 Flash rewrites retrieved explanations as 2-sentence analogies tailored to each student's interest profile (cricketer/gamer/cook).",
    tracks: ["Gemini"],
    link: "https://ai.google.dev/gemini-api",
    iconClass: "gemini",
  },
  {
    name: "ElevenLabs",
    tier: "Bonus",
    description: "Calm tutor voice (Rachel) TTS streams the Gemini-rewritten analogy back to lost students' phones. Graceful degradation when API unavailable.",
    tracks: ["ElevenLabs"],
    link: "https://elevenlabs.io",
    iconClass: "elevenlabs",
  },
  {
    name: "DigitalOcean",
    tier: "Bonus",
    description: "Optional droplet for multi-school dashboard view. Hybrid on-prem + cloud story for district-scale deployments.",
    tracks: ["DigitalOcean"],
    link: "https://digitalocean.com",
    iconClass: "digitalocean",
  },
  {
    name: "GitHub",
    tier: "Bonus",
    description: "Repo + GitHub Pages landing page. Version control, CI/CD, and public showcase for Devfolio submission.",
    tracks: ["GitHub"],
    link: "https://github.com",
    iconClass: "github",
  },
];

const hackathon = {
  name: "HexaFalls 2",
  theme: "Harry Potter Themed Hackathon",
  date: "2026",
  location: "JIS University, Kolkata",
  tracks: ["Actian (Primary)", "Gemini", "ElevenLabs", "DigitalOcean", "GitHub"],
  category: "Education",
};

export function Sponsors() {
  return (
    <section id="sponsors" className={styles.section} aria-labelledby="sponsors-title">
      <FloatingBackground particleCount={15} spellTheme="accio" />
      
      <div className={styles.container}>
        <ScrollReveal direction="up">
          <header className={styles.header}>
            <Badge variant="gold" size="md">Sponsor Tracks</Badge>
            <h2 id="sponsors-title" className={styles.title}>
              Powered by <span className={styles.highlight}>Industry Leaders</span>
            </h2>
            <p className={styles.description}>
              Every track we tag isn't just a badge — it's a structural dependency. 
              Legilimens is built <em>on</em> these technologies, not just <em>with</em> them.
            </p>
          </header>
        </ScrollReveal>

        <StaggerContainer staggerDelay={120} triggerOnce={true}>
          {sponsors.map((sponsor, index) => (
            <ScrollReveal key={sponsor.name} direction="up" delay={index * 100}>
              <Card variant="dark" spell={sponsor.iconClass as any} hover className={styles.sponsorCard}>
                <CardHeader>
                  <div className={styles.sponsorHeader}>
                    <div className={`${styles.sponsorIcon} ${sponsor.iconClass}`} aria-hidden="true" />
                    <div className={styles.sponsorMeta}>
                      <div className={styles.sponsorName}>
                        {sponsor.name}
                        {sponsor.tier === "Primary" && <span className={styles.primaryBadge}>Primary</span>}
                      </div>
                      <Badge variant="gold" size="sm" className={styles.sponsorTier}>
                        {sponsor.tier} Track
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className={styles.sponsorDescription}>{sponsor.description}</p>
                  <div className={styles.sponsorTracks}>
                    {sponsor.tracks.map((track) => (
                      <Badge key={track} variant="cyan" size="sm" className={styles.trackBadge}>
                        {track}
                      </Badge>
                    ))}
                  </div>
                  <a href={sponsor.link} target="_blank" rel="noopener noreferrer" className={styles.sponsorLink}>
                    View Sponsor
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </StaggerContainer>

        {/* Hackathon info */}
        <ScrollReveal direction="up" delay={300}>
          <Card variant="parchment" className={styles.hackathonCard}>
            <CardContent>
              <div className={styles.hackathonContent}>
                <div className={styles.hackathonInfo}>
                  <div className={styles.hackathonIcon}>
                    <svg width="40" height="40" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                      <circle cx="50" cy="50" r="45" stroke="var(--gold)" stroke-width="2" />
                      <path d="M50 20 L50 80 M20 50 L80 50" stroke="var(--gold)" stroke-width="2" />
                      <circle cx="50" cy="50" r="8" fill="var(--gold)" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={styles.hackathonName}>{hackathon.name}</h3>
                    <p className={styles.hackathonDetails}>
                      {hackathon.theme} · {hackathon.date} · {hackathon.location}
                    </p>
                  </div>
                </div>
                <div className={styles.hackathonBadges}>
                  {hackathon.tracks.map((track) => (
                    <Badge key={track} variant="cyan" size="sm" className={styles.hackathonBadge}>
                      {track}
                    </Badge>
                  ))}
                  <Badge variant="emerald" size="sm" className={styles.hackathonBadge}>
                    {hackathon.category} Track
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </section>
  );
}