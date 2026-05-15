from __future__ import annotations

from functools import lru_cache
from io import StringIO
import re

import pandas as pd
import requests

RBA_A2_CSV = "https://www.rba.gov.au/statistics/tables/csv/a2-data.csv"


def _first_numeric_column(df: pd.DataFrame) -> str | None:
    for column in df.columns:
        values = pd.to_numeric(df[column], errors="coerce")
        if values.notna().sum() > 5:
            return column
    return None


def _parse_rate(value) -> float | None:
    matches = re.findall(r"-?\d+(?:\.\d+)?", str(value))
    if not matches:
        return None
    return float(matches[-1])


@lru_cache(maxsize=8)
def get_cash_rate() -> dict:
    try:
        response = requests.get(RBA_A2_CSV, timeout=15)
        response.raise_for_status()
        raw = response.text
        lines = raw.splitlines()
        data_line = next((idx for idx, line in enumerate(lines) if re.match(r"\d{2}-[A-Za-z]{3}-\d{4},", line)), None)
        if data_line is None:
            raise ValueError("Unable to locate dated rows in RBA A2 CSV")

        df = pd.read_csv(
            StringIO("\n".join(lines[data_line:])),
            header=None,
            names=[
                "Date",
                "Change in Cash Rate Target",
                "New Cash Rate Target",
                "Change in ES Rate",
                "New ES Rate",
                "Change in Overnight Repo Rate",
                "New Overnight Repo Rate",
            ],
        )
        parsed = pd.DataFrame(
            {
                "date": pd.to_datetime(df["Date"], format="%d-%b-%Y", errors="coerce"),
                "rate": df["New Cash Rate Target"].apply(_parse_rate),
                "change": df["Change in Cash Rate Target"].apply(_parse_rate),
            }
        ).dropna(subset=["date", "rate"])
        if parsed.empty:
            raise ValueError("RBA A2 CSV did not contain usable cash-rate rows")

        latest = parsed.iloc[-1]
        last_change_bps = int(round(float(latest["change"]) * 100)) if pd.notna(latest["change"]) else None
        last_change_date = latest["date"].date().isoformat() if last_change_bps else None
        direction = "HOLDING"
        if last_change_bps is not None:
            if last_change_bps > 0:
                direction = "HIKING"
            elif last_change_bps < 0:
                direction = "CUTTING"

        return {
            "cash_rate": round(float(latest["rate"]), 3),
            "rate_direction": direction,
            "last_change_date": last_change_date,
            "last_change_bps": last_change_bps,
            "data_source": "RBA A2 Table CSV",
        }
    except Exception as exc:
        return {
            "cash_rate": None,
            "rate_direction": "UNKNOWN",
            "last_change_date": None,
            "last_change_bps": None,
            "data_source": "RBA A2 Table CSV",
            "error": str(exc),
        }
