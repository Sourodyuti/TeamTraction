"""Analytics client — confusion time-series for Pensieve (Phase 7).

Wraps the active database backend (Actian Vector via ODBC, or SQLite for dev).
All write operations use the `with_retry` decorator for resilience.
All read operations return plain dicts for FastAPI serialization.

INTERVAL / FETCH-FIRST PORTABILITY
----------------------------------
SQLite does not support Ingres/Actian syntax (date_add, FETCH FIRST).
This module uses SQLite-compatible SQL (LIMIT, datetime(…, '… seconds')),
which also works on Actian Vector through a compatibility layer when needed.
"""
from __future__ import annotations

import logging

from models.database import get_vector_connection, with_retry
from models.schemas import ConfusionEvent

logger = logging.getLogger(__name__)


class VectorAnalyticsClient:
    """Client for Actian Vector columnar SQL analytics."""

    def close(self) -> None:
        """Close the database backend (called at application shutdown)."""
        try:
            from models.database import close_backend
            close_backend()
            logger.info("Analytics database backend closed")
        except Exception:
            logger.exception("Error closing analytics database backend")

    # ─── Write ────────────────────────────────────────────────────

    @with_retry(max_retries=3, backoff_base=0.5)
    def insert_confusion_event(self, event: ConfusionEvent) -> None:
        """Insert a single confusion event row into Actian Vector."""
        sql = """
            INSERT INTO confusion_events
                (event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (
                event.event_id,
                event.lecture_id,
                event.student_id,
                event.concept_node,
                event.ts,
                event.signal_type.value,
                event.cohort,
            ))
        logger.debug(
            "Inserted confusion event %d (lecture=%d, concept=%s, signal=%s)",
            event.event_id, event.lecture_id, event.concept_node, event.signal_type.value,
        )

    @with_retry(max_retries=3, backoff_base=0.5)
    def insert_confusion_events_batch(self, events: list[ConfusionEvent]) -> None:
        """Bulk-insert confusion events (used by demo data loader and tests)."""
        if not events:
            return

        sql = """
            INSERT INTO confusion_events
                (event_id, lecture_id, student_id, concept_node, ts, signal_type, cohort)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        rows = [
            (
                ev.event_id,
                ev.lecture_id,
                ev.student_id,
                ev.concept_node,
                ev.ts,
                ev.signal_type.value,
                ev.cohort,
            )
            for ev in events
        ]
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.executemany(sql, rows)
        logger.info("Batch-inserted %d confusion events", len(events))

    # ─── Read: Pensieve queries ───────────────────────────────────

    def get_top_confusing_moments(
        self,
        lecture_id: int,
        limit: int = 3,
    ) -> list[dict]:
        """Top-N most confusing concept_nodes by lost_count.

        Returns a list of dicts with keys:
            concept_node, lost_count, total_signals, avg_density
        """
        sql = """
            SELECT
                concept_node,
                SUM(CASE WHEN signal_type = 'lost' THEN 1 ELSE 0 END) AS lost_count,
                COUNT(*)                                                AS total_signals
            FROM confusion_events
            WHERE lecture_id = ?
            GROUP BY concept_node
            ORDER BY lost_count DESC
            LIMIT ?
        """
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (lecture_id, limit))
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
        return results

    def get_confusion_density_timeline(self, lecture_id: int) -> list[dict]:
        """Rolling 60s confusion density over time.

        Uses a self-join window approach (SQLite-compatible datetime).
        Returns list of {ts, density} dicts.
        """
        sql = """
            SELECT
                e.ts,
                CASE
                    WHEN COUNT(w.event_id) = 0 THEN 0.0
                    ELSE 1.0 * SUM(CASE WHEN w.signal_type = 'lost' THEN 1 ELSE 0 END)
                          / COUNT(w.event_id)
                END AS density
            FROM confusion_events e
            LEFT JOIN confusion_events w
                ON  w.lecture_id   = e.lecture_id
                AND w.ts          >= datetime(e.ts, '-60 seconds')
                AND w.ts          <= e.ts
            WHERE e.lecture_id = ?
            GROUP BY e.ts
            ORDER BY e.ts
        """
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (lecture_id,))
            rows = cursor.fetchall()

        return [
            {
                "ts": row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0]),
                "density": round(float(row[1] or 0.0), 4),
            }
            for row in rows
        ]

    def get_cohort_heatmap(self, lecture_id: int) -> list[dict]:
        """Per-cohort confusion breakdown — lost signals per cohort x concept_node."""
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
        with get_vector_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (lecture_id,))
            rows = cursor.fetchall()

        return [
            {
                "cohort": row[0],
                "concept_node": row[1],
                "lost_count": int(row[2]),
                "total_signals": int(row[3]),
            }
            for row in rows
        ]

    # ─── Health check ─────────────────────────────────────────────

    def health(self) -> bool:
        """Return True if Actian Vector is reachable."""
        try:
            with get_vector_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                return True
        except Exception:
            return False
