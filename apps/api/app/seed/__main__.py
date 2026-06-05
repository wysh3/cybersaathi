"""Seed data generator for CyberSaathi.

Run with: ``uv run python -m app.seed`` (from inside ``apps/api``).
"""

from . import build_seed_data, write_seed_files

__all__ = ["build_seed_data", "write_seed_files"]
