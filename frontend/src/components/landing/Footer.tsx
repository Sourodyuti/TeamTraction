"use client";

import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Button } from "@/components/ui/Button";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import styles from "./Footer.module.css";

const navLinks = {
  project: [
    { label: "GitHub Repository", href: "https://github.com/Sourodyuti/TeamTraction", external: true },
    { label: "Devfolio Submission", href: "https://devfolio.co", external: true },
    { label: "Architecture Blueprint", href: "#architecture", external: false },
    { label: "Live Demo", href: "#live-demo", external: false },
  ],
  spells: [
    { label: "Muffliato (Capture)", href: "#spells", external: false },
    { label: "Marauder's Radar (Viz)", href: "#spells", external: false },
    { label: "Accio Analogy (Retrieval)", href: "#spells", external: false },
    { label: "Gemino (Rewrite)", href: "#spells", external: false },
    { label: "Sonorus (Voice)", href: "#spells", external: false },
    { label: "Pensieve (Analytics)", href: "#spells", external: false },
  ],
  resources: [
    { label: "Actian VectorAI DB Docs", href: "https://www.actian.com", external: true },
    { label: "bge-small-en Model", href: "https://huggingface.co/BAAI/bge-small-en-v1.5", external: true },
    { label: "Gemini API Docs", href: "https://ai.google.dev", external: true },
    { label: "ElevenLabs API Docs", href: "https://elevenlabs.io/docs", external: true },
    { label: "Qdrant (VectorAI)", href: "https://qdrant.tech", external: true },
    { label: "HexaFalls 2 Hackathon", href: "https://hexafalls.org", external: true },
  ],
  team: [
    { label: "Sourodyuti Biswas Sanyal", href: "https://github.com/Sourodyuti", external: true },
    { label: "Backend / Actian Lead", href: "#team", external: false },
    { label: "AI/ML Lead", href: "#team", external: false },
    { label: "Frontend Lead", href: "#team", external: false },
    { label: "Demo / PM Lead", href: "#team", external: false },
  ],
};

export function Footer() {
  return (
    <footer id="contact" className={styles.footer} role="contentinfo">
      <FloatingBackground particleCount={10} spellTheme="pensieve" />
      
      <div className={styles.container}>
        {/* Brand Section */}
        <ScrollReveal direction="up">
          <div className={styles.brandSection}>
            <div className={styles.logo}>
              <svg width="80" height="80" viewBox="0 0 100 100" fill="none" aria-hidden="true">
                <circle cx="50" cy="50" r="45" stroke="var(--gold)" stroke-width="2" stroke-dasharray="8 4" />
                <path d="M50 20 L50 80 M20 50 L80 50" stroke="var(--gold)" stroke-width="2" />
                <circle cx="50" cy="50" r="8" fill="var(--gold)" />
              </svg>
            </div>
            <h2 className={styles.footerTitle}>Legilimens</h2>
            <p className={styles.footerTagline}>
              The radar that catches silent drowning, and the spell that fixes it — in under a second, on the school's own server.
            </p>
            <div className={styles.socialLinks}>
              <a href="https://github.com/Sourodyuti/TeamTraction" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="GitHub">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="https://linkedin.com/company/jis-university" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="LinkedIn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003zm-7.082 18.056h-3.554V12.312c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286z"/></svg>
              </a>
              <a href="https://devfolio.co" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Devfolio">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </a>
              <a href="mailto:sourodyuti.biswas@gmail.com" className={styles.socialLink} aria-label="Email">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </a>
            </div>
          </div>
        </ScrollReveal>

        {/* Navigation Grid */}
        <ScrollReveal direction="up" delay={100}>
          <nav className={styles.navGrid} aria-label="Footer navigation">
            {Object.entries(navLinks).map(([category, links]) => (
              <div key={category} className={styles.navColumn}>
                <h3 className={styles.navTitle}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </h3>
                <ul className={styles.navList}>
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        rel={link.external ? "noopener noreferrer" : undefined}
                        className={styles.navLink}
                      >
                        {link.label}
                        {link.external && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollReveal>

        {/* CTA Section */}
        <ScrollReveal direction="up" delay={200}>
          <div className={styles.ctaSection}>
            <h3 className={styles.ctaTitle}>Ready to Bring Legilimens to Your Classroom?</h3>
            <p className={styles.ctaText}>
              Pilot deployment available for <code>JIS University</code> and partner institutions. 
              Contact us for the 3-bullet feasibility note, architecture diagram, and demo video.
            </p>
            <div className={styles.ctaButtons}>
              <Button size="lg" variant="gold" className={styles.ctaButton}>
                Request Pilot Proposal
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
              <Button size="lg" variant="ghost" className={styles.ctaButton}>
                View Devfolio Submission
              </Button>
            </div>
          </div>
        </ScrollReveal>

        {/* Bottom */}
        <div className={styles.bottom}>
          <div className={styles.divider} />
          <p className={styles.copyright}>
            © 2026 Legilimens Team. Licensed under 
            <a href="https://opensource.org/licenses/MIT" className={styles.licenseLink} target="_blank" rel="noopener noreferrer">MIT License</a>.
          </p>
          <p className={styles.madeWith}>
            Built with <span className={styles.heart}>♥</span> by the 
            <strong>Legilimens Team</strong> for <strong>HexaFalls 2</strong> · 
            <a href="https://github.com/Sourodyuti/TeamTraction" className={styles.licenseLink} target="_blank" rel="noopener noreferrer">Open Source</a>
          </p>
        </div>
      </div>
    </footer>
  );
}