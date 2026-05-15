from __future__ import annotations


def get_cpi() -> dict | None:
    # ABS release CSV endpoints are not stable. Keep this best-effort hook graceful
    # until a stable source is wired in.
    return None


def get_gdp() -> dict | None:
    return None


def get_unemployment() -> dict | None:
    return None
