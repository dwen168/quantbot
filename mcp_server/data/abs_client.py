from __future__ import annotations

from functools import lru_cache
from io import StringIO
import csv
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

        # 1. Identify the column index from header rows
        # Use csv module to correctly handle commas inside quoted strings
        reader = csv.reader(lines)
        rows = [next(reader) for _ in range(3)] # Get first 3 rows
        
        title_row = [c.strip() for c in rows[1]]
        desc_row = [c.strip() for c in rows[2]]
        
        col_idx = -1
        # Check Titles first
        for i, col in enumerate(title_row):
            if col_keyword.lower() in col.lower():
                col_idx = i
                break
        
        # If not found, check Descriptions
        if col_idx == -1:
            for i, col in enumerate(desc_row):
                if col_keyword.lower() in col.lower():
                    col_idx = i
                    break
        
        if col_idx == -1:
            return None

        # 2. Find where the real data starts (DD/MM/YYYY or DD-MMM-YYYY pattern)
        data_start_idx = -1
        for i, line in enumerate(lines):
            # Matches 28/02/1978 or 28-Feb-1978
            if re.match(r"\d{2}[/-]([A-Za-z]{3}|\d{2})[/-]\d{4}", line):
                data_start_idx = i
                break
        
        if data_start_idx == -1:
            return None

        # 3. Parse data using csv module to handle varying row lengths
        data_rows = []
        data_reader = csv.reader(lines[data_start_idx:])
        for row in data_reader:
            if not row:
                continue
            # Pad row with None if it is shorter than our target col_idx
            if len(row) <= col_idx:
                row.extend([None] * (col_idx - len(row) + 1))
            data_rows.append([row[0], row[col_idx]])
            
        df = pd.DataFrame(data_rows, columns=["Date", "Value"])
        
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
    # Use keywords found in Title/Description rows
    cpi = _fetch_latest_rba_metric(url, "Year-ended inflation")
    trimmed = _fetch_latest_rba_metric(url, "trimmed mean")
    
    return {
        "latest_cpi_yoy": cpi,
        "latest_trimmed_mean": trimmed
    }


@lru_cache(maxsize=4)
def get_gdp() -> dict | None:
    """Fetch Year-ended GDP Growth via RBA Table H1."""
    url = "https://www.rba.gov.au/statistics/tables/csv/h1-data.csv"
    val = _fetch_latest_rba_metric(url, "Year-ended real GDP growth")
    return {"gdp_growth_yoy": val}


@lru_cache(maxsize=4)
def get_unemployment() -> dict | None:
    """Fetch the latest Unemployment Rate via RBA Table H5."""
    url = "https://www.rba.gov.au/statistics/tables/csv/h5-data.csv"
    val = _fetch_latest_rba_metric(url, "Unemployment rate")
    return {"unemployment_rate": val}
