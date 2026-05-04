"""Pydantic schemas for source data validation.

Per DATA_ARCHITECTURE.md §5 / §2.3.1 / §5.2 / §2.4 / §2.5.

Import pattern in scripts:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "data"))
    from schema.occupation import Occupation
"""
