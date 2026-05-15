from __future__ import annotations

from functools import lru_cache
from typing import Any

import pandas as pd
import yfinance as yf


def normalize_asx_ticker(ticker: str) -> str:
    symbol = ticker.strip().upper()
    if not symbol:
        raise ValueError("Ticker is required")
    return symbol if symbol.endswith(".AX") or symbol.startswith("^") or "=" in symbol or "." in symbol else f"{symbol}.AX"


@lru_cache(maxsize=256)
def get_ohlcv(ticker_dotax: str, period: str = "2y") -> pd.DataFrame:
    symbol = normalize_asx_ticker(ticker_dotax)
    df = yf.Ticker(symbol).history(period=period, auto_adjust=False)
    if df is None or df.empty:
        raise ValueError(f"No OHLCV data returned for {symbol}")
    return df.copy()


@lru_cache(maxsize=256)
def get_info(ticker_dotax: str) -> dict[str, Any]:
    symbol = normalize_asx_ticker(ticker_dotax)
    try:
        return dict(yf.Ticker(symbol).info or {})
    except Exception:
        return {}


@lru_cache(maxsize=128)
def get_news(ticker_dotax: str, n: int = 10) -> tuple[dict[str, Any], ...]:
    symbol = normalize_asx_ticker(ticker_dotax)
    try:
        return tuple((yf.Ticker(symbol).news or [])[:n])
    except Exception:
        return tuple()


def get_price_series(tickers: list[str], period: str = "1mo") -> pd.DataFrame:
    symbols = [normalize_asx_ticker(ticker) for ticker in tickers]
    return yf.download(symbols, period=period, group_by="ticker", progress=False, auto_adjust=False)
