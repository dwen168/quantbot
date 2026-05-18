from concurrent.futures import ThreadPoolExecutor
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
    
    def fetch_ticker_news(ticker_cat):
        ticker, category = ticker_cat
        ticker_news = []
        for item in get_news(ticker, 5):
            published = item.get("providerPublishTime") or item.get("pubDate")
            if isinstance(published, int):
                published = datetime.fromtimestamp(published, tz=timezone.utc).isoformat()
            content = item.get("content") if isinstance(item.get("content"), dict) else {}
            title = item.get("title") or content.get("title")
            url = item.get("link") or item.get("url") or content.get("canonicalUrl", {}).get("url")
            publisher = item.get("publisher") or content.get("provider", {}).get("displayName")
            if title:
                ticker_news.append(NewsItem(
                    title=title, 
                    publisher=publisher, 
                    published=published, 
                    url=url, 
                    related_ticker=ticker,
                    category=category
                ))
        return ticker_news

    with ThreadPoolExecutor(max_workers=5) as executor:
        results = executor.map(fetch_ticker_news, ticker_map.items())
        for res in results:
            items.extend(res)

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
    with ThreadPoolExecutor(max_workers=10) as executor:
        # 1. RBA
        fut_rba = executor.submit(get_cash_rate)
        
        # 2. VIX
        fut_vix = executor.submit(_last_close, "^VIX", "5d")
        
        # 3. China Indicators
        fut_shanghai_ytd = executor.submit(_pct_change, "000001.SS", "ytd")
        fut_aud_cny_3m = executor.submit(_pct_change, "AUDCNY=X", "3mo")
        fut_iron_ore_ytd = executor.submit(_pct_change, "QRE.AX", "ytd")
        
        # 4. Sector Rotation
        fut_sectors = {
            name: executor.submit(_pct_change, code, "1mo")
            for code, name in SECTOR_PROXIES.items()
        }
        
        # 5. Commodities
        fut_gold = executor.submit(_last_close, "GC=F")
        fut_oil = executor.submit(_last_close, "CL=F")
        fut_copper = executor.submit(_last_close, "HG=F")
        fut_iron_ore = executor.submit(_last_close, "QRE.AX")
        
        # 6. Global 1D Performance
        fut_sp500_1d = executor.submit(_pct_change, "^GSPC", "5d", days=2)
        fut_nasdaq_1d = executor.submit(_pct_change, "^IXIC", "5d", days=2)
        fut_shanghai_1d = executor.submit(_pct_change, "000001.SS", "5d", days=2)
        
        # 7. News
        fut_news = executor.submit(_fetch_news)

        # Collect Results
        rba_data = fut_rba.result()
        cash_rate = rba_data.get("cash_rate")
        vix = fut_vix.result()
        shanghai_ytd = fut_shanghai_ytd.result()
        aud_cny_3m = fut_aud_cny_3m.result()
        iron_ore_ytd = fut_iron_ore_ytd.result()
        
        sector_changes = {name: fut.result() for name, fut in fut_sectors.items()}
        
        commodities = {
            "gold": fut_gold.result(),
            "oil": fut_oil.result(),
            "copper": fut_copper.result(),
            "iron_ore": fut_iron_ore.result()
        }
        
        global_indices = {
            "sp500": fut_sp500_1d.result(),
            "nasdaq": fut_nasdaq_1d.result(),
            "shanghai": fut_shanghai_1d.result()
        }
        
        news = fut_news.result()

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
