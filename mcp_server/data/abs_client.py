from __future__ import annotations

from functools import lru_cache
from io import StringIO
import re

import pandas as pd
import requests


def _fetch_latest_rba_metric(url: str, col_keyword: str) -> float | None:
    """
    Helper to fetch a specific metric from a standard RBA statistical CSV table.
    RBA tables aggregate official ABS data into stable CSV endpoints.
    """
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        lines = response.text.splitlines()

        if len(lines) < 10:
            return None

        # 1. Identify the column index from the title row (usually line 1)
        # We look for a column that matches our keyword (case-insensitive)
        # RBA CSVs are comma-separated and often have quoted fields.
        header_raw = lines[1].split(",")
        header_row = [c.strip().strip("\"") for c in header_raw]
        
        col_idx = -1
        for i, col in enumerate(header_row):
            if col_keyword.lower() in col.lower():
                col_idx = i
                break
        
        if col_idx == -1:
            return None

        # 2. Find where the real data starts (DD-MMM-YYYY pattern)
        data_start_idx = -1
        for i, line in enumerate(lines):
            if re.match(r"\d{2}-[A-Za-z]{3}-\d{4}", line):
                data_start_idx = i
                break
        
        if data_start_idx == -1:
            return None

        # 3. Parse data using pandas
        # We only need the Date and our target column
        df = pd.read_csv(
            StringIO("\n".join(lines[data_start_idx:])),
            header=None,
            usecols=[0, col_idx],
            names=["Date", "Value"],
            na_values=["", " ", "NaN", "n/a", "null"]
        )
        
        # 4. Convert value and find the last non-empty numeric entry
        df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
        latest_valid = df.dropna(subset=["Value"])
        
        if latest_valid.empty:
            return None
            
        return round(float(latest_valid.iloc[-1]["Value"]), 2)

    except Exception:
        # Graceful failure: if the CSV structure changes or network fails, 
        # return None so the dashboard can show a placeholder.
        return None


@lru_cache(maxsize=8)
def get_cpi() -> dict | None:
    """Fetch Year-ended CPI and Trimmed Mean via RBA Table G1."""
    url = "https://www.rba.gov.au/statistics/tables/csv/g1-data.csv"
    cpi = _fetch_latest_rba_metric(url, "Consumer price index ;  Year-ended")
    trimmed = _fetch_latest_rba_metric(url, "Trimmed mean ;  Year-ended")
    
    return {
        "latest_cpi_yoy": cpi,
        "latest_trimmed_mean": trimmed
    }


@lru_cache(maxsize=4)
def get_gdp() -> dict | None:
    """Fetch Year-ended GDP Growth via RBA Table H1."""
    url = "https://www.rba.gov.au/statistics/tables/csv/h1-data.csv"
    val = _fetch_latest_rba_metric(url, "Gross domestic product ;  Year-ended")
    return {"gdp_growth_yoy": val}


@lru_cache(maxsize=4)
def get_unemployment() -> dict | None:
    """Fetch the latest Unemployment Rate via RBA Table H5."""
    url = "https://www.rba.gov.au/statistics/tables/csv/h5-data.csv"
    val = _fetch_latest_rba_metric(url, "Unemployment rate")
    return {"unemployment_rate": val}
