"use client";

/**
 * Marauder's Radar — D3 radial heatmap (Phase 3).
 *
 * Concept nodes are arranged radially. Color intensity = current confusion
 * density. This is the "wow" visual for the demo.
 *
 * TODO Phase 3: Implement the D3 radial layout + color scale.
 */
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { ConceptNode } from "@/lib/types";

interface RadarHeatmapProps {
  nodes: ConceptNode[];
}

export function RadarHeatmap({ nodes }: RadarHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    // TODO Phase 3: Build the radial heatmap.
    //   - Arrange nodes evenly around a circle.
    //   - Map confusion density → color (green→amber→red).
    //   - Animate transitions on updates.
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const width = 500;
    const height = 500;
    const radius = Math.min(width, height) / 2 - 40;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Placeholder: simple text labels in a circle
    const angleScale = d3
      .scalePoint()
      .domain(nodes.map((n) => n.name))
      .range([0, 2 * Math.PI]);

    g.selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("x", (d) => Math.cos(angleScale(d.name)! - Math.PI / 2) * radius)
      .attr("y", (d) => Math.sin(angleScale(d.name)! - Math.PI / 2) * radius)
      .attr("text-anchor", "middle")
      .attr("fill", (d) =>
        d.confusionDensity > 0.5
          ? "var(--lost-red)"
          : d.confusionDensity > 0.2
            ? "var(--slower-amber)"
            : "var(--gotit-green)"
      )
      .style("font-size", "12px")
      .text((d) => d.name);
  }, [nodes]);

  return <svg ref={svgRef} />;
}
