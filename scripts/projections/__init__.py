"""9 projection families per DATA_ARCHITECTURE.md §6.

Each module exposes a single `build(indexes, dist_root, labels=...)` entry.
Indexes are computed once in build_data.py and reused across all projections.

Status (per §6.0):
    Planned (run by default):  treemap, detail, search, labels
    Future (skipped by default): tasks, skills, holland, featured, score_history
"""
