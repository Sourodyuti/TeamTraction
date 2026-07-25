import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legilimens — Live Classroom Confusion Radar & Auto-Analogy Engine",
  description: "A real-time mind-reading layer for live classrooms that detects where/when students collectively get lost, then instantly re-explains that exact moment using a freshly-generated analogy from each student's interest graph — with all retrieval running on-prem on Actian VectorAI DB.",
  keywords: ["Legilimens", "classroom", "confusion detection", "Actian", "VectorAI", "Gemini", "ElevenLabs", "education technology", "hackathon", "HexaFalls"],
  authors: [{ name: "Sourodyuti Biswas Sanyal" }, { name: "Team Legilimens" }],
  creator: "Team Legilimens",
  publisher: "Team Legilimens",
  robots: "index, follow",
  openGraph: {
    title: "Legilimens — Live Classroom Confusion Radar",
    description: "Detects where students get lost, then re-explains with personalized analogies — all on-prem.",
    type: "website",
    locale: "en_US",
    siteName: "Legilimens",
  },
  twitter: {
    card: "summary_large_image",
    title: "Legilimens — Live Classroom Confusion Radar",
    description: "Detects where students get lost, then re-explains with personalized analogies — all on-prem.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0D0714" />
      </head>
      <body className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-gold text-on-gold rounded-lg font-display"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}