/**
 * Pure transforms that fix the two backend/frontend contract mismatches
 * in the Pensieve analytics endpoints, centralizing them so they're
 * testable and reusable across tabs.
 *
 * 1. /analytics/density returns RAW events {data:[{ts,type}]} — not
 *    pre-computed density. We bucket them into a rolling window and
 *    compute lost-ratio density per bucket.
 *
 * 2. /analytics/cohort-heatmap returns a MAP {node:{lost,gotit}} — not
 *    an array of cells with an "hour" axis. We normalize it into rows.
 */
import type { DensityEvent, CohortMap, CohortRow, TimelinePoint } from "./types";

/**
 * Bucket raw confusion events into a rolling-window density timeline.
 *
 * Each output point is the lost-ratio (lost / total signals) within the
 * trailing `windowSec` window ending at that event's timestamp. This
 * mirrors the backend's documented "rolling 60s confusion density".
 */
export function eventsToDensityTimeline(
  events: DensityEvent[],
  windowSec: number = 60,
): TimelinePoint[] {
  if (!events.length) return [];

  // Sort ascending by timestamp (backend returns ASC, but be defensive).
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.ts).getTime();
    const tb = new Date(b.ts).getTime();
    return ta - tb;
  });

  const windowMs = windowSec * 1000;
  const points: TimelinePoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const tEnd = new Date(sorted[i].ts).getTime();
    const tStart = tEnd - windowMs;

    // Count signals in the trailing window.
    let lost = 0;
    let total = 0;
    for (let j = i; j >= 0; j--) {
      const t = new Date(sorted[j].ts).getTime();
      if (t < tStart) break;
      total++;
      if (sorted[j].type === "lost") lost++;
    }
    const density = total > 0 ? lost / total : 0;
    points.push({ ts: tEnd, density });
  }

  return points;
}

/**
 * Normalize the cohort heatmap map into render rows sorted by lost count
 * descending (worst concepts first).
 */
export function cohortMapToGrid(map: CohortMap): CohortRow[] {
  return Object.entries(map)
    .map(([concept_node, counts]) => {
      const lost = counts.lost ?? 0;
      const gotit = counts.gotit ?? 0;
      const total = lost + gotit;
      return {
        concept_node,
        label: concept_node.replace(/_/g, " "),
        lost,
        gotit,
        total,
        lostDensity: total > 0 ? lost / total : 0,
      };
    })
    .sort((a, b) => b.lost - a.lost);
}

/** Format an uptime in seconds as a compact human string. */
export function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
