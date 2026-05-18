from datetime import datetime, timezone
from dataclasses import dataclass
from typing import Any

import pandas as pd

from mcp_server.data.rba_client import get_cash_rate
from mcp_server.data.yfinance_client import get_ohlcv, get_news
from mcp_server.models.macro import NewsItem

SECTOR_PROXIES = {
    "VAS.AX": "Broad Market",
    "VAP.AX": "Property",
    "QRE.AX": "Resources",
    "QFN.AX": "Financials",
    "ATEC.AX": "Technology",
}

@dataclass
class MacroCore:
    cash_rate: float | None
    vix: float | None
    shanghai_ytd: float | None
    aud_cny_3m: float | None
    iron_ore_ytd: float | None
    sector_changes: dict[str, float | None]
    raw_rba: dict[str, Any]
    commodities: dict[str, float | None]
    global_indices_1d: dict[str, float | None]
    news_headlines: list[NewsItem]


def _clean(value):
    try:
        if value is None or pd.isna(value):
            return None
        return round(float(value), 4)
    except Exception:
        return None


def _pct_change(ticker: str, period: str = "1mo", days: int | None = None) -> float | None:
    try:
        close = get_ohlcv(ticker, period)["Close"].dropna()
        if len(close) < 2:
            return None
        start = close.iloc[-days] if days and len(close) >= days else close.iloc[0]
        return _clean(((close.iloc[-1] - start) / start) * 100)
    except Exception:
        return None


def _last_close(ticker: str, period: str = "1mo") -> float | None:
    try:
        close = get_ohlcv(ticker, period)["Close"].dropna()
        return _clean(close.iloc[-1]) if not close.empty else None
    except Exception:
        return None


def _fetch_news() -> list[NewsItem]:
    items: list[NewsItem] = []
    # Mix of ASX local, Global Indices, and Commodities to catch Geopolitics (e.g. Oil/Gold/VIX)
    ticker_map = {
        "^AXJO": "Market",
        "CL=F": "Energy",
        "GC=F": "Metals",
        "^GSPC": "Macro",
        "^VIX": "Risk"
    }
    for ticker, category in ticker_map.items():
        for item in get_news(ticker, 5):
            published = item.get("providerPublishTime") or item.get("pubDate")
            if isinstance(published, int):
                published = datetime.fromtimestamp(published, tz=timezone.utc).isoformat()
            content = item.get("content") if isinstance(item.get("content"), dict) else {}
            title = item.get("title") or content.get("title")
            url = item.get("link") or item.get("url") or content.get("canonicalUrl", {}).get("url")
            publisher = item.get("publisher") or content.get("provider", {}).get("displayName")
            if title:
                items.append(NewsItem(
                    title=title, 
                    publisher=publisher, 
                    published=published, 
                    url=url, 
                    related_ticker=ticker,
                    category=category
                ))
    seen: set[str] = set()
    unique: list[NewsItem] = []
    for item in items:
        if item.title not in seen:
            seen.add(item.title)
            unique.append(item)
    return unique[:15]


def fetch_macro_core() -> MacroCore:
    """
    Step 1: Centralized data fetching for all macro-related tools.
    Reduces duplicate network calls to RBA and yfinance.
    """
    # 1. RBA
    rba_data = get_cash_rate()
    cash_rate = rba_data.get("cash_rate")

    # 2. VIX
    vix = _last_close("^VIX", "5d")

    # 3. China Indicators
    shanghai_ytd = _pct_change("000001.SS", "ytd")
    aud_cny_3m = _pct_change("AUDCNY=X", "3mo")
    iron_ore_ytd = _pct_change("QRE.AX", "ytd")

    # 4. Sector Rotation (basic check)
    sector_changes = {
        name: _pct_change(code, "1mo")
        for code, name in SECTOR_PROXIES.items()
    }

    # 5. Commodities
    commodities = {
        "gold": _last_close("GC=F"),
        "oil": _last_close("CL=F"),
        "copper": _last_close("HG=F"),
        "iron_ore": _last_close("QRE.AX")
    }

    # 6. Global 1D Performance
    global_indices = {
        "sp500": _pct_change("^GSPC", "5d", days=2),
        "nasdaq": _pct_change("^IXIC", "5d", days=2),
        "shanghai": _pct_change("000001.SS", "5d", days=2)
    }

    # 7. News
    news = _fetch_news()

    return MacroCore(
        cash_rate=cash_rate,
        vix=vix,
        shanghai_ytd=shanghai_ytd,
        aud_cny_3m=aud_cny_3m,
        iron_ore_ytd=iron_ore_ytd,
        sector_changes=sector_changes,
        raw_rba=rba_data,
        commodities=commodities,
        global_indices_1d=global_indices,
        news_headlines=news
    )
