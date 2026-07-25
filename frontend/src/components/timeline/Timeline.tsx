"use client";

/**
 * Confusion Timeline — Recharts (Phase 3).
 *
 * Shows rolling 60s confusion density over lecture time.
 * Scrubable for the Pensieve post-lecture view too.
 *
 * TODO Phase 3: Polish the chart styling to match the Hogwarts theme.
 */
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { TimelinePoint } from "@/lib/types";

interface TimelineProps {
  data: TimelinePoint[];
}

export function Timeline({ data }: TimelineProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="ts" stroke="rgba(255,255,255,0.5)" fontSize={12} />
        <YAxis
          domain={[0, 1]}
          stroke="rgba(255,255,255,0.5)"
          fontSize={12}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-dark)",
            border: "1px solid var(--gryffindor-gold)",
            borderRadius: "8px",
          }}
          formatter={(value: number) => [`${(value * 100).toFixed(0)}%`, "Confusion"]}
        />
        {/* Threshold line — when density crosses this, Accio Analogy fires */}
        <ReferenceLine
          y={0.25}
          stroke="var(--lost-red)"
          strokeDasharray="5 5"
          label={{ value: "trigger", fill: "var(--lost-red)", fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="density"
          stroke="var(--gryffindor-gold)"
          strokeWidth={2}
          dot={false}
          isAnimationActive
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
