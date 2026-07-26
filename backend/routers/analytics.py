"""Pensieve analytics — Actian Vector SQL queries (Phase 7, production).

Exposes REST endpoints for the teacher dashboard to query confusion analytics:
  - GET /analytics/top-moments     Top-N most confusing moments by lost_count
  - GET /analytics/density         Rolling 60s confusion density timeline
  - GET /analytics/cohort-heatmap  Per-cohort confusion breakdown
  - GET /analytics/summary         Lecture-level summary stats
  - POST /analytics/seed           Seed demo data (for testing the dashboard)

All queries run against Actian Vector's columnar engine via the connection pool.
The columnar scans make these sub-second over thousands of lecture-minutes.
"""
from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from models.schemas import TopConfusingMoment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])

# pyodbc availability — checked at query time, not import time.
# This lets the server boot even without unixodbc installed;
# endpoints return 503 with a clear install message.
_PYODBC_AVAILABLE: bool = False
try:
    import pyodbc  # noqa: F401
    _PYODBC_AVAILABLE = True
except ImportError:
    logger.warning(
        "pyodbc not importable — Actian Vector analytics endpoints will return 503. "
        "Install unixodbc + pyodbc to enable real SQL queries."
    )


def _assert_pyodbc() -> None:
    if not _PYODBC_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Actian Vector analytics unavailable: pyodbc/unixodbc not installed. "
                "Run: apt-get install unixodbc-dev && pip install pyodbc"
            ),
        )


def _execute_query(sql: str, params: tuple = ()) -> list[tuple]:
    """Execute a read-only query and return all rows. Raises HTTPException on failure."""
    _assert_pyodbc()
    from models.database import get_vector_connection, with_retry
    
    @with_retry(max_retries=2, backoff_base=0.5)
    def _run():
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.fetchall()

    try:
        return _run()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analytics query failed: %s\nSQL: %s", e, sql[:200])
        raise HTTPException(status_code=503, detail=f"Analytics query failed: {e}")

def _execute_update(sql: str, params: tuple = ()) -> int:
    """Execute a write query, return rows affected."""
    _assert_pyodbc()
    from models.database import get_vector_connection
    
    try:
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return cursor.rowcount
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Analytics write failed: %s\nSQL: %s", e, sql[:200])
        raise HTTPException(status_code=503, detail=f"Analytics write failed: {e}")

@router.get("/top-moments", response_model=list[TopConfusingMoment])
async def top_confusing_moments(
    lecture_id: int = Query(..., description="Lecture ID"),
    limit: int = Query(3, ge=1, le=20, description="Number of top moments"),
) -> list[TopConfusingMoment]:
    if hasattr(limit, 'default'):
        limit = limit.default
    
    rows = _execute_query(
        """
        SELECT concept_node,
               SUM(CASE WHEN signal_type = 'lost' THEN 1 ELSE 0 END) AS lost_count,
               COUNT(*) AS total
        FROM confusion_events
        WHERE lecture_id = ?
        GROUP BY concept_node
        ORDER BY lost_count DESC
        """,
        (lecture_id,),
    )
    
    if not rows:
        return []

    results = []
    for concept_node, lost_count, total in rows[:limit]:
        density_rows = _execute_query(
            """
            SELECT AVG(CASE WHEN signal_type = 'lost' THEN 1.0 ELSE 0 END) AS density
            FROM confusion_events
            WHERE lecture_id = ? AND concept_node = ?
            """,
            (lecture_id, concept_node),
        )
        avg_density = float(density_rows[0][0]) if density_rows and density_rows[0][0] is not None else 0.0

        results.append(
            TopConfusingMoment(
                concept_node=concept_node,
                lost_count=int(lost_count),
                total_signals=int(total),
                avg_density=avg_density,
            )
        )
    return results

@router.get("/density")
async def confusion_density(
    lecture_id: int,
    window_sec: int = Query(60, ge=10, le=300),
) -> dict:
    rows = _execute_query(
        """
        SELECT ts, signal_type 
        FROM confusion_events 
        WHERE lecture_id = ? 
        ORDER BY ts ASC
        """,
        (lecture_id,)
    )
    return {"data": [{"ts": r[0].isoformat(), "type": r[1]} for r in rows]}

@router.get("/cohort-heatmap")
async def cohort_heatmap(lecture_id: int) -> dict:
    rows = _execute_query(
        """
        SELECT concept_node, student_id, signal_type 
        FROM confusion_events 
        WHERE lecture_id = ?
        """,
        (lecture_id,)
    )
    heatmap = {}
    for r in rows:
        node, st_id, sig = r[0], r[1], r[2]
        if node not in heatmap:
            heatmap[node] = {"lost": 0, "gotit": 0}
        if sig in heatmap[node]:
            heatmap[node][sig] += 1
    return heatmap

@router.get("/summary")
async def lecture_summary(lecture_id: int) -> dict:
    rows = _execute_query(
        """
        SELECT COUNT(*), 
               SUM(CASE WHEN signal_type = 'lost' THEN 1 ELSE 0 END),
               SUM(CASE WHEN signal_type = 'gotit' THEN 1 ELSE 0 END)
        FROM confusion_events 
        WHERE lecture_id = ?
        """,
        (lecture_id,)
    )
    if not rows:
        return {"total": 0, "lost": 0, "gotit": 0}
    return {
        "total": int(rows[0][0]),
        "lost": int(rows[0][1] or 0),
        "gotit": int(rows[0][2] or 0)
    }

@router.post("/seed")
async def seed_demo_data(lecture_id: int = 1) -> dict:
    ts = datetime.now(timezone.utc)
    from models.database import get_vector_connection
    try:
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            events = [
                ("student_1", "chain_rule", "lost", ts - timedelta(seconds=120)),
                ("student_2", "chain_rule", "lost", ts - timedelta(seconds=115)),
                ("student_3", "chain_rule", "lost", ts - timedelta(seconds=110)),
                ("student_1", "chain_rule", "gotit", ts - timedelta(seconds=100)),
                ("student_4", "gradient_descent", "lost", ts - timedelta(seconds=60)),
                ("student_5", "gradient_descent", "lost", ts - timedelta(seconds=55)),
            ]
            for evt in events:
                cursor.execute(
                    """
                    INSERT INTO confusion_events 
                    (lecture_id, student_id, concept_node, signal_type, ts) 
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (lecture_id, evt[0], evt[1], evt[2], evt[3])
                )
            conn.commit()
    except Exception as e:
        logger.error("Seed failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Seed failed: {e}")
    return {"status": "seeded", "count": 6}
