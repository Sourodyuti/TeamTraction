"""Pensieve analytics — Actian Vector SQL queries (Phase 7).

Exposes REST endpoints for the teacher dashboard to query confusion analytics:
  - Top-3 most confusing moments in a lecture
  - Rolling 60s confusion density
  - Per-cohort heatmaps
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException

from models.schemas import TopConfusingMoment

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/top-moments", response_model=list[TopConfusingMoment])
async def top_confusing_moments(lecture_id: int, limit: int = 3) -> list[TopConfusingMoment]:
    """Top-N most confusing moments by lost_count in a lecture.

    TODO Phase 7: Replace stub with real Actian Vector SQL:
        SELECT concept_node,
               SUM(CASE WHEN signal_type='lost' THEN 1 ELSE 0 END) AS lost_count,
               COUNT(*) AS total
        FROM confusion_events
        WHERE lecture_id = :lecture_id
        GROUP BY concept_node
        ORDER BY lost_count DESC LIMIT :limit;
    """
    return [
        TopConfusingMoment(
            concept_node="chain_rule",
            lost_count=5,
            total_signals=8,
            avg_density=0.62,
        ),
    ]


@router.get("/density")
async def confusion_density(lecture_id: int) -> list[dict]:
    """Rolling 60s confusion density timeline for a lecture.

    TODO Phase 7: Replace stub with real Actian Vector SQL:
        SELECT ts,
               AVG(CASE WHEN signal_type='lost' THEN 1.0 ELSE 0 END)
                 OVER w AS density
        FROM confusion_events
        WHERE lecture_id = :lecture_id
        WINDOW w AS (ORDER BY ts ROWS BETWEEN 60 PRECEDING AND CURRENT ROW);
    """
    return [
        {"ts": "2026-07-25T10:00:00", "density": 0.1},
        {"ts": "2026-07-25T10:01:00", "density": 0.35},
        {"ts": "2026-07-25T10:02:00", "density": 0.75},
    ]
