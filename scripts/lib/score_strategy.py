"""Score selection strategies — per DATA_ARCHITECTURE.md §7.4.

Centralizes the rule for "which historical score is current".

Current strategy: latest by run_date.
Future-proofing: when multiple model providers diverge on quality, this is the
single place to swap in a "model priority" or "ensemble" strategy without
touching projection code.

CHANGELOG of pick_latest_score:
    2026-05-04  initial — strict max(run_date) per occupation
"""
from __future__ import annotations


def pick_latest_score(history: list[dict]) -> dict:
    """Select the canonical current score from a per-occupation score history.

    `history` is a list of dicts shaped like:
        {"model": str, "date": str (ISO), "score": int, "rationale_ja": str, "rationale_en": str, ...}

    Returns: the entry with the latest `date`. Caller guarantees non-empty.
    """
    if not history:
        raise ValueError("pick_latest_score called with empty history")
    return max(history, key=lambda x: x["date"])
