#!/usr/bin/env python3
"""
MCP Server for Actian Vector (Analytics Engine).

Provides tools for:
- Inserting confusion events
- Pensieve analytics queries (top moments, density timeline, cohort heatmaps)
- Health checks

Run: python mcp/vector_analytics_mcp.py
"""

import json
import logging
import os
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment config
VECTOR_HOST = os.getenv("VECTOR_HOST", "localhost")
VECTOR_PORT = int(os.getenv("VECTOR_PORT", "5432"))
VECTOR_DATABASE = os.getenv("VECTOR_DATABASE", "actian")
VECTOR_USER = os.getenv("VECTOR_USER", "admin")
VECTOR_PASSWORD = os.getenv("VECTOR_PASSWORD", "password")

# Lazy-loaded connection pool
_connection_pool = None


def get_connection():
    """Get a connection to Actian Vector."""
    global _connection_pool
    try:
        import pyodbc

        conn_str = (
            f"DRIVER={{Actian Vector}};"
            f"SERVER={VECTOR_HOST};"
            f"PORT={VECTOR_PORT};"
            f"DATABASE={VECTOR_DATABASE};"
            f"UID={VECTOR_USER};"
            f"PWD={VECTOR_PASSWORD}"
        )
        conn = pyodbc.connect(conn_str, autocommit=True)
        return conn
    except Exception as e:
        logger.error("Failed to connect to Actian Vector: %s", e)
        raise


# Pydantic models for tool arguments
class InsertEventArgs(BaseModel):
    """Arguments for inserting a confusion event."""
    event_id: int
    lecture_id: int
    student_id: str
    concept_node: str
    ts: str  # ISO format timestamp
    signal_type: str  # "lost" | "gotit" | "slower"
    cohort: str = "default"


class InsertBatchEventsArgs(BaseModel):
    """Arguments for batch inserting confusion events."""
    events: list[dict]


class TopMomentsArgs(BaseModel):
    """Arguments for getting top confusing moments."""
    lecture_id: int
    limit: int = 3


class DensityTimelineArgs(BaseModel):
    """Arguments for getting confusion density timeline."""
    lecture_id: int


class CohortHeatmapArgs(BaseModel):
    """Arguments for getting cohort heatmap."""
    lecture_id: int


class HealthCheckArgs(BaseModel):
    """Arguments for health check (empty)."""
    pass


class ExecuteSQLArgs(BaseModel):
    """Arguments for executing arbitrary SQL (read-only)."""
    sql: str
    params: list[Any] = []


# MCP Server
server = Server("legilimens-vector-analytics")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List available Actian Vector Analytics tools."""
    return [
        Tool(
            name="vector_insert_event",
            description="Insert a single confusion event into Actian Vector.",
            inputSchema=InsertEventArgs.model_json_schema(),
        ),
        Tool(
            name="vector_insert_batch_events",
            description="Bulk-insert confusion events (used by demo data loader).",
            inputSchema=InsertBatchEventsArgs.model_json_schema(),
        ),
        Tool(
            name="vector_top_moments",
            description="Get top-N most confusing moments (Pensieve query).",
            inputSchema=TopMomentsArgs.model_json_schema(),
        ),
        Tool(
            name="vector_density_timeline",
            description="Get rolling 60s confusion density timeline (Pensieve query).",
            inputSchema=DensityTimelineArgs.model_json_schema(),
        ),
        Tool(
            name="vector_cohort_heatmap",
            description="Get per-cohort confusion heatmap (Pensieve query).",
            inputSchema=CohortHeatmapArgs.model_json_schema(),
        ),
        Tool(
            name="vector_execute_sql",
            description="Execute a read-only SQL query against Actian Vector.",
            inputSchema=ExecuteSQLArgs.model_json_schema(),
        ),
        Tool(
            name="vector_health",
            description="Check if Actian Vector is reachable.",
            inputSchema=HealthCheckArgs.model_json_schema(),
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Execute an Actian Vector Analytics tool."""
    try:
        if name == "vector_insert_event":
            args = InsertEventArgs(**arguments)
            return await _insert_event(args)

        elif name == "vector_insert_batch_events":
            args = InsertBatchEventsArgs(**arguments)
            return await _insert_batch_events(args)

        elif name == "vector_top_moments":
            args = TopMomentsArgs(**arguments)
            return await _top_moments(args)

        elif name == "vector_density_timeline":
            args = DensityTimelineArgs(**arguments)
            return await _density_timeline(args)

        elif name == "vector_cohort_heatmap":
            args = CohortHeatmapArgs(**arguments)
            return await _cohort_heatmap(args)

        elif name == "vector_execute_sql":
            args = ExecuteSQLArgs(**arguments)
            return await _execute_sql(args)

        elif name == "vector_health":
            return await _health_check()

        else:
            raise ValueError(f"Unknown tool: {name}")

    except Exception as e:
        logger.exception("Tool %s failed: %s", name, e)
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _insert_event(args: InsertEventArgs) -> list[TextContent]:
    """Insert a single confusion event."""
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
        INSERT INTO confusion_events
            (event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    cursor.execute(sql, (
        args.event_id,
        args.lecture_id,
        args.student_id,
        args.concept_node,
        args.ts,
        args.signal_type,
        args.cohort,
    ))

    return [TextContent(type="text", text=f"Inserted confusion event {args.event_id}")]


async def _insert_batch_events(args: InsertBatchEventsArgs) -> list[TextContent]:
    """Bulk-insert confusion events."""
    if not args.events:
        return [TextContent(type="text", text="No events to insert")]

    conn = get_connection()
    cursor = conn.cursor()

    sql = """
        INSERT INTO confusion_events
            (event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """
    rows = [
        (
            ev["event_id"],
            ev["lecture_id"],
            ev["student_id"],
            ev["concept_node"],
            ev["ts"],
            ev["signal_type"],
            ev.get("cohort", "default"),
        )
        for ev in args.events
    ]
    cursor.executemany(sql, rows)

    return [TextContent(type="text", text=f"Batch-inserted {len(rows)} confusion events")]


async def _top_moments(args: TopMomentsArgs) -> list[TextContent]:
    """Get top-N most confusing moments."""
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
        SELECT
            concept_node,
            SUM(CASE WHEN signal_type = 'lost' THEN 1 ELSE 0 END) AS lost_count,
            COUNT(*) AS total_signals
        FROM confusion_events
        WHERE lecture_id = ?
        GROUP BY concept_node
        ORDER BY lost_count DESC
        FETCH FIRST ? ROWS ONLY
    """
    cursor.execute(sql, (args.lecture_id, args.limit))
    rows = cursor.fetchall()

    results = []
    for row in rows:
        concept_node, lost_count, total_signals = row[0], row[1], row[2]
        avg_density = lost_count / total_signals if total_signals > 0 else 0.0
        results.append({
            "concept_node": concept_node,
            "lost_count": int(lost_count),
            "total_signals": int(total_signals),
            "avg_density": round(float(avg_density), 4),
        })

    return [TextContent(type="text", text=json.dumps(results, indent=2))]


async def _density_timeline(args: DensityTimelineArgs) -> list[TextContent]:
    """Get rolling 60s confusion density timeline."""
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
        SELECT
            e.ts,
            CAST(
                SUM(CASE WHEN w.signal_type = 'lost' THEN 1.0 ELSE 0.0 END)
                / NULLIF(COUNT(w.event_id), 0)
            AS FLOAT) AS density
        FROM confusion_events e
        LEFT JOIN confusion_events w
            ON  w.lecture_id = e.lecture_id
            AND w.ts >= e.ts - INTERVAL '60' SECOND
            AND w.ts <= e.ts
        WHERE e.lecture_id = ?
        GROUP BY e.ts
        ORDER BY e.ts
    """
    cursor.execute(sql, (args.lecture_id,))
    rows = cursor.fetchall()

    results = []
    for row in rows:
        ts = row[0]
        density = row[1] or 0.0
        results.append({
            "ts": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
            "density": round(float(density), 4),
        })

    return [TextContent(type="text", text=json.dumps(results, indent=2))]


async def _cohort_heatmap(args: CohortHeatmapArgs) -> list[TextContent]:
    """Get per-cohort confusion heatmap."""
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
        SELECT
            cohort,
            concept_node,
            SUM(CASE WHEN signal_type = 'lost' THEN 1 ELSE 0 END) AS lost_count,
            COUNT(*) AS total_signals
        FROM confusion_events
        WHERE lecture_id = ?
        GROUP BY cohort, concept_node
        ORDER BY cohort, lost_count DESC
    """
    cursor.execute(sql, (args.lecture_id,))
    rows = cursor.fetchall()

    results = []
    for row in rows:
        results.append({
            "cohort": row[0],
            "concept_node": row[1],
            "lost_count": int(row[2]),
            "total_signals": int(row[3]),
        })

    return [TextContent(type="text", text=json.dumps(results, indent=2))]


async def _execute_sql(args: ExecuteSQLArgs) -> list[TextContent]:
    """Execute a read-only SQL query."""
    # Safety: only allow SELECT queries
    sql_upper = args.sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        return [TextContent(type="text", text="Error: Only SELECT queries allowed")]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(args.sql, args.params)
    rows = cursor.fetchall()

    # Convert to list of dicts
    columns = [desc[0] for desc in cursor.description] if cursor.description else []
    results = []
    for row in rows:
        results.append(dict(zip(columns, row)))

    return [TextContent(type="text", text=json.dumps(results, indent=2))]


async def _health_check() -> list[TextContent]:
    """Health check for Actian Vector."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        return [TextContent(type="text", text="Actian Vector: HEALTHY")]
    except Exception as e:
        return [TextContent(type="text", text=f"Actian Vector: UNHEALTHY - {e}")]


async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())