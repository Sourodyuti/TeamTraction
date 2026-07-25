"use client";

/**
 * Marauder's Radar — D3 radial heatmap (Phase 3).
 *
 * Concept nodes are arranged radially. Color intensity = current confusion density.
 * This is the "wow" visual for the demo.
 */
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { ConceptNode } from "@/lib/types";

interface RadarHeatmapProps {
  nodes: ConceptNode[];
  lectureTitle?: string;
  liveStudentCount?: number;
}

export function RadarHeatmap({ nodes, lectureTitle = "Backpropagation Lecture", liveStudentCount = 0 }: RadarHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  // Track previous nodes for smooth transitions
  const prevNodesRef = useRef<ConceptNode[]>([]);

  // Handle responsive sizing
  useEffect(() => {
    const updateSize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        const size = Math.min(container.clientWidth, 600);
        setDimensions({ width: size, height: size });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const { width, height } = dimensions;
    const radius = Math.min(width, height) / 2 - 60;
    const centerX = width / 2;
    const centerY = height / 2;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${centerX}, ${centerY})`);

    // ─── Color scale: green (0) → amber (0.3) → red (1) ────────────────
    const colorScale = d3
      .scaleLinear<string>()
      .domain([0, 0.25, 0.5, 0.75, 1])
      .range(["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"])
      .clamp(true);

    // ─── Angle scale: distribute nodes evenly around circle ─────────────
    const angleScale = d3
      .scalePoint<string>()
      .domain(nodes.map((n) => n.name))
      .range([0, 2 * Math.PI])
      .padding(0.5);

    // ─── Radial scale for node distance from center ────────────────────
    // Nodes with higher density get pulled slightly outward for visual emphasis
    const radialScale = d3
      .scaleLinear()
      .domain([0, 1])
      .range([radius * 0.4, radius * 0.9]);

    // ─── Merge with previous nodes for smooth transitions ──────────────
    // Create a map of previous nodes by name for position interpolation
    const prevNodeMap = new Map(prevNodesRef.current.map((n) => [n.name, n]));

    // ─── Draw arcs (background rings for reference) ────────────────────
    const arcCount = 4;
    g.selectAll(".radar-ring")
      .data(d3.range(1, arcCount + 1))
      .enter()
      .append("circle")
      .attr("class", "radar-ring")
      .attr("r", (d) => (radius / arcCount) * d)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.05)")
      .attr("stroke-width", 1);

    // ─── Draw radial grid lines ────────────────────────────────────────
    const gridLines = 8;
    g.selectAll(".radar-grid")
      .data(d3.range(gridLines))
      .enter()
      .append("line")
      .attr("class", "radar-grid")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d) => Math.cos((d * 2 * Math.PI) / gridLines - Math.PI / 2) * radius)
      .attr("y2", (d) => Math.sin((d * 2 * Math.PI) / gridLines - Math.PI / 2) * radius)
      .attr("stroke", "rgba(255,255,255,0.03)")
      .attr("stroke-width", 1);

    // ─── Concept node groups ───────────────────────────────────────────
    const nodeGroups = g
      .selectAll<SVGGElement, ConceptNode>(".concept-node")
      .data(nodes, (d: ConceptNode) => d.name)
      .join(
        (enter) => {
          // ENTER: new nodes
          const group = enter.append("g").attr("class", "concept-node").attr("opacity", 0);

          // Pulse ring (animated)
          group
            .append("circle")
            .attr("class", "pulse-ring")
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", (d) => colorScale(d.confusionDensity))
            .attr("stroke-width", 2);

          // Main node circle
          group
            .append("circle")
            .attr("class", "node-circle")
            .attr("r", (d) => Math.max(12, 8 + d.confusionDensity * 20))
            .attr("fill", (d) => colorScale(d.confusionDensity))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .style("filter", "drop-shadow(0 0 8px currentColor)");

          // Confidence ring (shows gotIt vs lost ratio)
          group
            .append("path")
            .attr("class", "confidence-ring")
            .attr("fill", "none")
            .attr("stroke", "#22c55e")
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round");

          // Label
          group
            .append("text")
            .attr("class", "node-label")
            .attr("text-anchor", "middle")
            .attr("dy", (d) => Math.max(12, 8 + d.confusionDensity * 20) + 4)
            .attr("fill", "#e4e4e7")
            .attr("font-size", "11px")
            .attr("font-weight", 500)
            .text((d) => d.name.replace(/_/g, " "));

          return group;
        },
        (update) => update,
        (exit) => {
          // EXIT: fade out
          exit.transition().duration(300).attr("opacity", 0).remove();
        }
      );

    // ─── Update positions and visual properties with transitions ───────
    nodeGroups
      .transition()
      .duration(500)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1)
      .attr("transform", (d) => {
        const angle = angleScale(d.name)! - Math.PI / 2;
        const r = radialScale(d.confusionDensity);
        return `translate(${Math.cos(angle) * r}, ${Math.sin(angle) * r})`;
      });

    // Update node circles
    nodeGroups.select<SVGCircleElement>(".node-circle").transition().duration(500).attr("r", (d) => Math.max(12, 8 + d.confusionDensity * 20)).attr("fill", (d) => colorScale(d.confusionDensity));

    // Pulse animation for high confusion nodes
    nodeGroups
      .select<SVGCircleElement>(".pulse-ring")
      .filter((d) => d.confusionDensity > 0.3)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr("r", (d) => Math.max(12, 8 + d.confusionDensity * 20) + 20)
      .attr("stroke-opacity", 0)
      .transition()
      .duration(1500)
      .ease(d3.easeLinear)
      .attr("r", (d: ConceptNode) => Math.max(12, 8 + d.confusionDensity * 20) + 5)
      .attr("stroke-opacity", 0.6);

    // Update confidence rings (gotIt ratio)
    nodeGroups
      .select<SVGPathElement>(".confidence-ring")
      .attr("d", (d) => {
        const total = d.lostCount + d.gotItCount;
        if (total === 0) return "";
        const gotItRatio = d.gotItCount / total;
        const r = Math.max(12, 8 + d.confusionDensity * 20) + 4;
        const endAngle = -Math.PI / 2 + gotItRatio * 2 * Math.PI;
        const arc = d3
          .arc<{ startAngle: number; endAngle: number }>()
          .innerRadius(r)
          .outerRadius(r + 3)
          .startAngle(-Math.PI / 2)
          .endAngle(endAngle);
        return arc({ startAngle: -Math.PI / 2, endAngle });
      });

    // Update labels
    nodeGroups.select<SVGTextElement>(".node-label").text((d) => d.name.replace(/_/g, " "));

    // ─── Tooltips ──────────────────────────────────────────────────────
    const tooltip = d3.select("body").append("div").attr("class", "radar-tooltip").style("opacity", 0).style("position", "absolute").style("pointer-events", "none").style("background", "rgba(26, 15, 46, 0.95)").style("border", "1px solid #d3a625").style("border-radius", "8px").style("padding", "8px 12px").style("font-size", "12px").style("color", "#fafafa").style("z-index", 1000);

    nodeGroups
      .on("mouseenter", (event, d) => {
        tooltip
          .html(
            `
            <strong style="color: #d3a625">${d.name.replace(/_/g, " ")}</strong><br/>
            Confusion Density: <span style="color:${colorScale(d.confusionDensity)}">${(d.confusionDensity * 100).toFixed(0)}%</span><br/>
            🪄 Lost: ${d.lostCount} | ✅ Got it: ${d.gotItCount}
          `
          )
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY - 10 + "px")
          .transition()
          .duration(200)
          .style("opacity", 1);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY - 10 + "px");
      })
      .on("mouseleave", () => {
        tooltip.transition().duration(200).style("opacity", 0);
      });

    // ─── Center content ────────────────────────────────────────────────
    const centerGroup = g.selectAll(".center-content").data([null]).join("g").attr("class", "center-content");

    centerGroup.selectAll("*").remove();

    // Center circle
    centerGroup
      .append("circle")
      .attr("r", radius * 0.35)
      .attr("fill", "rgba(26, 15, 46, 0.9)")
      .attr("stroke", "#d3a625")
      .attr("stroke-width", 2);

    // Lecture title
    centerGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.6em")
      .attr("fill", "#d3a625")
      .attr("font-size", "14px")
      .attr("font-weight", 600)
      .attr("font-family", "Cinzel, serif")
      .text(lectureTitle);

    // Live student count
    centerGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.6em")
      .attr("fill", "#a1a1aa")
      .attr("font-size", "20px")
      .attr("font-weight", 700)
      .text(`${liveStudentCount} students online`);

    // Legend
    const legendData = [
      { label: "Calm", color: "#22c55e" },
      { label: "Moderate", color: "#eab308" },
      { label: "Confused", color: "#ef4444" },
    ];

    const legend = g.selectAll(".legend").data([null]).join("g").attr("class", "legend").attr("transform", `translate(${-radius + 10}, ${-radius + 10})`);

    legend.selectAll("*").remove();

    legend
      .selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`)
      .each(function (d) {
        const g = d3.select(this);
        g.append("circle").attr("r", 6).attr("fill", d.color);
        g.append("text")
          .attr("x", 14)
          .attr("y", 4)
          .attr("fill", "#a1a1aa")
          .attr("font-size", "10px")
          .text(d.label);
      });

    // Store current nodes for next transition
    prevNodesRef.current = nodes;
  }, [nodes, dimensions, lectureTitle, liveStudentCount]);

  return <svg ref={svgRef} style={{ width: "100%", height: "100%", maxWidth: 600, maxHeight: 600 }} />;
}