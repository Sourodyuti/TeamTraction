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
        {/* PWA manifest — required for Chrome installability check */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* Apple PWA support */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Muffliato" />
        <meta name="theme-color" content="#0D0714" />
        {/* Service Worker registration — skip during dev to avoid dupe with Next.js HMR */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (location.hostname !== 'localhost' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[Legilimens SW] registered, scope:', reg.scope);
                    })
                    .catch(function(err) {
                      console.warn('[Legilimens SW] registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
