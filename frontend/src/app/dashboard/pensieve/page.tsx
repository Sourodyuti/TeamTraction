"use client";

/**
 * /dashboard/pensieve — now a thin wrapper around the rebuilt command
 * center's Analytics tab. Previously this was a standalone page with raw
 * SVG charts; its rendering was broken by two backend/ frontend contract
 * mismatches (now fixed inside PensieveAnalyticsTab).
 *
 * Kept as a route so existing links work, and redirected to the unified
 * dashboard for a single source of truth.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PensieveAnalyticsTab } from "@/components/dashboard/PensieveAnalyticsTab";

export default function PensievePage() {
  const router = useRouter();

  // Redirect to the new unified dashboard (the Analytics tab lives there).
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  // Render the analytics content directly while the redirect settles, so
  // direct links to /dashboard/pensieve still show something meaningful.
  return (
    <main style={{ minHeight: "100vh", padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: "1rem", color: "rgba(245,230,200,0.5)", fontSize: "0.82rem" }}>
        Redirecting to the unified Command Center…
      </div>
      <PensieveAnalyticsTab lectureId={1} refreshKey={0} />
    </main>
  );
}
