import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legilimens — Classroom Confusion Radar",
  description:
    "A real-time mind-reading layer for live classrooms. Detects where students get lost and re-explains instantly, on-prem.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1a0f2e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
