"""Atomic dist/ replacement — per DATA_ARCHITECTURE.md §7.6.3.

Write the entire build to a staging directory, then swap atomically. If the
build fails midway, the existing dist/ is untouched.

Usage:
    with AtomicDist(dist_root) as staging_root:
        # write all projection outputs into staging_root
        ...
    # on context exit, staging_root replaces dist_root atomically
"""
from __future__ import annotations

import shutil
from pathlib import Path


class AtomicDist:
    """Stage build into <dist>.next/, swap on success, cleanup on failure.

    The swap is best-effort atomic on local filesystems via:
        1. rename old dist/ → dist.prev/
        2. rename dist.next/ → dist/
        3. rmtree dist.prev/

    If step 1 or 2 fails, dist/ is restored from dist.prev/ before re-raising.
    """

    def __init__(self, dist_root: Path):
        self.dist_root = Path(dist_root)
        self.staging = self.dist_root.parent / f"{self.dist_root.name}.next"
        self.previous = self.dist_root.parent / f"{self.dist_root.name}.prev"

    def __enter__(self) -> Path:
        # Clean any leftover staging from prior failed runs
        if self.staging.exists():
            shutil.rmtree(self.staging)
        self.staging.mkdir(parents=True)
        return self.staging

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type is not None:
            # Build failed mid-flight — discard staging, leave dist/ unchanged
            if self.staging.exists():
                shutil.rmtree(self.staging)
            return False  # propagate exception

        # Build succeeded — swap atomically
        # Cleanup any leftover prev/ from prior failed swap
        if self.previous.exists():
            shutil.rmtree(self.previous)

        if self.dist_root.exists():
            self.dist_root.rename(self.previous)

        try:
            self.staging.rename(self.dist_root)
        except OSError:
            # Restore old dist/ if swap fails
            if self.previous.exists():
                self.previous.rename(self.dist_root)
            raise

        # Success: discard previous
        if self.previous.exists():
            shutil.rmtree(self.previous)
        return False  # don't suppress (no exception anyway)
