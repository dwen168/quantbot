from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone

import pandas as pd

from mcp_server.data.macro_core import SECTOR_PROXIES, fetch_macro_core
from mcp_server.data.yfinance_client import get_news, get_ohlcv
from mcp_server.models.macro import (
    ASXMarket,
    Commodities,
    Currencies,
    GlobalIndices,
    MarketSnapshot,
    NewsItem,
    SectorPerf,
)


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


def _history(ticker: str, period: str = "3mo") -> list[dict] | None:
    try:
        df = get_ohlcv(ticker, period)
        if df.empty:
            return None
        series = []
        for index, row in df.iterrows():
            series.append({
                "time": index.strftime("%Y-%m-%d"),
                "open": _clean(row["Open"]),
                "high": _clean(row["High"]),
                "low": _clean(row["Low"]),
                "close": _clean(row["Close"])
            })
        return series
    except Exception:
        return None


def get_market_snapshot() -> MarketSnapshot:
    """
    Step 4: New display-oriented tool.
    Focuses on 'What is happening in the market right now?'
    """
    core = fetch_macro_core()
    errors = []
    if core.raw_rba.get("error"):
        errors.append(f"RBA data issue: {core.raw_rba['error']}")

    def fetch_sector_perf(args):
        code, name = args
        return SectorPerf(
            code=code, 
            name=name, 
            one_d_pct=_pct_change(code, "5d", days=2),
            series=_history(code, "3mo")
        )

    with ThreadPoolExecutor(max_workers=10) as executor:
        # Sectors
        fut_sectors = list(executor.map(fetch_sector_perf, SECTOR_PROXIES.items()))
        
        # Market
        fut_asx200_close = executor.submit(_last_close, "^AXJO")
        fut_asx200_1d = executor.submit(_pct_change, "^AXJO", "5d", days=2)
        fut_asx200_1mo = executor.submit(_pct_change, "^AXJO", "1mo")
        fut_asx200_ytd = executor.submit(_pct_change, "^AXJO", "ytd")
        
        # Currencies
        fut_aud_usd = executor.submit(_last_close, "AUDUSD=X")
        fut_aud_cny = executor.submit(_last_close, "AUDCNY=X")
        fut_aud_usd_1mo = executor.submit(_pct_change, "AUDUSD=X", "1mo")
        fut_aud_usd_history = executor.submit(_history, "AUDUSD=X")
        fut_aud_cny_history = executor.submit(_history, "AUDCNY=X")
        
        # Commodities
        fut_iron_ore_proxy = executor.submit(_last_close, "QRE.AX")
        fut_gold = executor.submit(_last_close, "GC=F")
        fut_oil = executor.submit(_last_close, "CL=F")
        fut_copper = executor.submit(_last_close, "HG=F")
        fut_coal = executor.submit(_last_close, "WHC.AX")
        fut_iron_ore_history = executor.submit(_history, "QRE.AX")
        fut_gold_history = executor.submit(_history, "GC=F")
        fut_oil_history = executor.submit(_history, "CL=F")
        fut_copper_history = executor.submit(_history, "HG=F")
        fut_coal_history = executor.submit(_history, "WHC.AX")
        
        # Global
        fut_sp500_1d = executor.submit(_pct_change, "^GSPC", "5d", days=2)
        fut_nasdaq_1d = executor.submit(_pct_change, "^IXIC", "5d", days=2)
        fut_shanghai_1d = executor.submit(_pct_change, "000001.SS", "5d", days=2)
        fut_hang_seng_1d = executor.submit(_pct_change, "^HSI", "5d", days=2)
        fut_sp500_history = executor.submit(_history, "^GSPC", "3mo")
        fut_nasdaq_history = executor.submit(_history, "^IXIC", "3mo")
        fut_shanghai_history = executor.submit(_history, "000001.SS", "3mo")
        fut_hang_seng_history = executor.submit(_history, "^HSI", "3mo")

        sectors = fut_sectors
        sectors.sort(key=lambda item: item.one_d_pct if item.one_d_pct is not None else -999, reverse=True)

        return MarketSnapshot(
            as_of_date=date.today().isoformat(),
            asx_market=ASXMarket(
                asx200_level=fut_asx200_close.result(),
                asx200_1d_change=fut_asx200_1d.result(),
                asx200_1mo_change=fut_asx200_1mo.result(),
                asx200_ytd_change=fut_asx200_ytd.result(),
                rba_cash_rate=core.cash_rate,
                top_sectors=sectors,
            ),
            currencies=Currencies(
                aud_usd=fut_aud_usd.result(),
                aud_cny=fut_aud_cny.result(),
                aud_usd_1mo_change=fut_aud_usd_1mo.result(),
                aud_usd_series=fut_aud_usd_history.result(),
                aud_cny_series=fut_aud_cny_history.result(),
            ),
            commodities=Commodities(
                iron_ore_etf_proxy=fut_iron_ore_proxy.result(),
                gold_usd=fut_gold.result(),
                crude_oil_usd=fut_oil.result(),
                copper_usd=fut_copper.result(),
                coal_proxy_ticker=fut_coal.result(),
                iron_ore_series=fut_iron_ore_history.result(),
                gold_usd_series=fut_gold_history.result(),
                crude_oil_usd_series=fut_oil_history.result(),
                copper_usd_series=fut_copper_history.result(),
                coal_series=fut_coal_history.result(),
            ),
            global_indices=GlobalIndices(
                sp500_1d_change=fut_sp500_1d.result(),
                nasdaq_1d_change=fut_nasdaq_1d.result(),
                shanghai_1d_change=fut_shanghai_1d.result(),
                hang_seng_1d_change=fut_hang_seng_1d.result(),
                sp500_series=fut_sp500_history.result(),
                nasdaq_series=fut_nasdaq_history.result(),
                shanghai_series=fut_shanghai_history.result(),
                hang_seng_series=fut_hang_seng_history.result(),
            ),
            news_headlines=core.news_headlines,
            errors=errors,
        )
