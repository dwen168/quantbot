from __future__ import annotations

from datetime import date, datetime, timezone

import pandas as pd

from mcp_server.data.rba_client import get_cash_rate
from mcp_server.data.yfinance_client import get_news, get_ohlcv
from mcp_server.models.macro import (
    ASXMarket,
    Commodities,
    Currencies,
    GlobalIndices,
    MacroInfo,
    NewsItem,
    RBAPolicy,
    SectorPerf,
)

SECTOR_PROXIES = {
    "VAS.AX": "Broad Market",
    "VAP.AX": "Property",
    "QRE.AX": "Resources",
    "QFN.AX": "Financials",
    "ATEC.AX": "Technology",
}


def _clean(value):
    try:
        if value is None or pd.isna(value):
            return None
        return round(float(value), 4)
    except Exception:
        return None


def _last_close(ticker: str, period: str = "1mo") -> float | None:
    try:
        close = get_ohlcv(ticker, period)["Close"].dropna()
        return _clean(close.iloc[-1]) if not close.empty else None
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


def _news_items() -> list[NewsItem]:
    items: list[NewsItem] = []
    for ticker in ("^AXJO", "BHP.AX", "CBA.AX", "RIO.AX"):
        for item in get_news(ticker, 5):
            published = item.get("providerPublishTime") or item.get("pubDate")
            if isinstance(published, int):
                published = datetime.fromtimestamp(published, tz=timezone.utc).isoformat()
            content = item.get("content") if isinstance(item.get("content"), dict) else {}
            title = item.get("title") or content.get("title")
            url = item.get("link") or item.get("url") or content.get("canonicalUrl", {}).get("url")
            publisher = item.get("publisher") or content.get("provider", {}).get("displayName")
            if title:
                items.append(NewsItem(title=title, publisher=publisher, published=published, url=url, related_ticker=ticker))
    seen: set[str] = set()
    unique: list[NewsItem] = []
    for item in items:
        if item.title not in seen:
            seen.add(item.title)
            unique.append(item)
    return unique[:10]


def get_macro_info() -> MacroInfo:
    errors: list[str] = []
    cash = get_cash_rate()
    if cash.get("error"):
        errors.append(f"RBA cash rate unavailable: {cash['error']}")

    sectors: list[SectorPerf] = []
    for code, name in SECTOR_PROXIES.items():
        sectors.append(SectorPerf(code=code, name=name, one_d_pct=_pct_change(code, "5d", days=2)))
    sectors.sort(key=lambda item: item.one_d_pct if item.one_d_pct is not None else -999, reverse=True)

    return MacroInfo(
        as_of_date=date.today().isoformat(),
        rba_policy=RBAPolicy(**{key: value for key, value in cash.items() if key != "error"}),
        asx_market=ASXMarket(
            asx200_level=_last_close("^AXJO"),
            asx200_1d_change=_pct_change("^AXJO", "5d", days=2),
            asx200_1mo_change=_pct_change("^AXJO", "1mo"),
            asx200_ytd_change=_pct_change("^AXJO", "ytd"),
            top_sectors=sectors[:5],
        ),
        currencies=Currencies(
            aud_usd=_last_close("AUDUSD=X"),
            aud_cny=_last_close("AUDCNY=X"),
            aud_usd_1mo_change=_pct_change("AUDUSD=X", "1mo"),
        ),
        commodities=Commodities(
            iron_ore_etf_proxy=_last_close("QRE.AX"),
            gold_usd=_last_close("GC=F"),
            crude_oil_usd=_last_close("CL=F"),
            copper_usd=_last_close("HG=F"),
            coal_proxy_ticker=_last_close("WHC.AX"),
        ),
        global_indices=GlobalIndices(
            sp500_1d_change=_pct_change("^GSPC", "5d", days=2),
            nasdaq_1d_change=_pct_change("^IXIC", "5d", days=2),
            shanghai_1d_change=_pct_change("000001.SS", "5d", days=2),
            hang_seng_1d_change=_pct_change("^HSI", "5d", days=2),
        ),
        news_headlines=_news_items(),
        errors=errors,
    )
