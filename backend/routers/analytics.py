"""Pensieve analytics — Actian Vector SQL queries (Phase 7).

Exposes REST endpoints for the teacher dashboard:
  GET /analytics/top-moments   — Top-N most confusing concept_nodes
  GET /analytics/density       — Rolling 60s confusion density timeline
  GET /analytics/cohort-heatmap — Per-cohort confusion breakdown

All endpoints delegate to VectorAnalyticsClient which holds the SQL.
Fallback to stub data when Actian Vector is unavailable (so the demo
dashboard still renders without a live DB connection).
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from models.schemas import TopConfusingMoment
from services.vector_client import VectorAnalyticsClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])

_STUB_TOP_MOMENTS = [
    TopConfusingMoment(concept_node="chain_rule", lost_count=5, total_signals=8, avg_density=0.62),
    TopConfusingMoment(concept_node="vanishing_gradient", lost_count=3, total_signals=5, avg_density=0.41),
    TopConfusingMoment(concept_node="backprop", lost_count=2, total_signals=4, avg_density=0.30),
]
_STUB_DENSITY = [
    {"ts": "2026-07-25T10:00:00", "density": 0.10},
    {"ts": "2026-07-25T10:01:00", "density": 0.35},
    {"ts": "2026-07-25T10:02:00", "density": 0.75},
    {"ts": "2026-07-25T10:03:00", "density": 0.50},
]


# ─── Dependency ───────────────────────────────────────────────────

def _get_analytics_client() -> VectorAnalyticsClient:
    return VectorAnalyticsClient()


# ─── Endpoints ───────────────────────────────────────────────────

@router.get("/top-moments", response_model=list[TopConfusingMoment])
async def top_confusing_moments(
    lecture_id: int,
    limit: int = Query(default=3, ge=1, le=20),
    client: Annotated[VectorAnalyticsClient, Depends(_get_analytics_client)] = None,
) -> list[TopConfusingMoment]:
    """Top-N most confusing moments by lost_count in a lecture.

    SQL (Actian Vector):
        SELECT concept_node,
               SUM(CASE WHEN signal_type='lost' THEN 1 ELSE 0 END) AS lost_count,
               COUNT(*) AS total
        FROM confusion_events
        WHERE lecture_id = :lecture_id
        GROUP BY concept_node
        ORDER BY lost_count DESC LIMIT :limit;
    """
    try:
        rows = client.get_top_confusing_moments(lecture_id, limit=limit)
        return [
            TopConfusingMoment(
                concept_node=r["concept_node"],
                lost_count=r["lost_count"],
                total_signals=r["total_signals"],
                avg_density=r.get("avg_density", 0.0),
            )
            for r in rows
        ]
    except NotImplementedError:
        # Analytics DB not yet connected — return demo stub so dashboard renders
        logger.warning("Analytics DB unavailable — returning stub data")
        return [m for m in _STUB_TOP_MOMENTS if True][:limit]
    except Exception:
        logger.exception("top_confusing_moments query failed")
        raise HTTPException(status_code=503, detail="Analytics service unavailable")


@router.get("/density")
async def confusion_density(
    lecture_id: int,
    window_sec: int = Query(default=60, ge=10, le=300),
    client: Annotated[VectorAnalyticsClient, Depends(_get_analytics_client)] = None,
) -> list[dict]:
    """Rolling confusion density timeline for a lecture.

    SQL (Actian Vector):
        SELECT ts,
               AVG(CASE WHEN signal_type='lost' THEN 1.0 ELSE 0 END)
                 OVER (ORDER BY ts ROWS BETWEEN :window PRECEDING AND CURRENT ROW)
                 AS density
        FROM confusion_events
        WHERE lecture_id = :lecture_id
        ORDER BY ts;
    """
    try:
        return client.get_confusion_density_timeline(lecture_id)
    except NotImplementedError:
        logger.warning("Analytics DB unavailable — returning stub density data")
        return _STUB_DENSITY
    except Exception:
        logger.exception("confusion_density query failed")
        raise HTTPException(status_code=503, detail="Analytics service unavailable")


@router.get("/cohort-heatmap")
async def cohort_heatmap(
    lecture_id: int,
    client: Annotated[VectorAnalyticsClient, Depends(_get_analytics_client)] = None,
) -> list[dict]:
    """Per-cohort confusion breakdown for a lecture."""
    try:
        return client.get_cohort_heatmap(lecture_id)
    except NotImplementedError:
        return [{"cohort": "default", "concept_node": "chain_rule", "lost_count": 5}]
    except Exception:
        logger.exception("cohort_heatmap query failed")
        raise HTTPException(status_code=503, detail="Analytics service unavailable")


@router.get("/health")
async def analytics_health(
    client: Annotated[VectorAnalyticsClient, Depends(_get_analytics_client)] = None,
) -> dict:
    """Liveness probe for the Actian Vector analytics connection."""
    healthy = client.health()
    return {"actian_vector": healthy, "status": "ok" if healthy else "degraded"}
