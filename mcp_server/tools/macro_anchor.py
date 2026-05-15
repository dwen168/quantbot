from __future__ import annotations

from datetime import date

import pandas as pd

from mcp_server.data import abs_client
from mcp_server.data.rba_client import get_cash_rate
from mcp_server.data.yfinance_client import get_ohlcv
from mcp_server.models.macro import (
    ChinaExposure,
    GrowthData,
    InflationData,
    MacroAnchors,
    RatesEnv,
    RiskSentiment,
    SectorRotation,
)
from mcp_server.tools.macro_info import SECTOR_PROXIES, _pct_change


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


def _asx_volatility_20d() -> float | None:
    try:
        close = get_ohlcv("^AXJO", "3mo")["Close"].dropna()
        returns = close.pct_change().dropna()
        return _clean(returns.tail(20).std() * (252 ** 0.5) * 100)
    except Exception:
        return None


def _vix_regime(vix: float | None) -> str:
    if vix is None:
        return "UNKNOWN"
    if vix < 15:
        return "LOW"
    if vix < 25:
        return "NORMAL"
    if vix < 35:
        return "ELEVATED"
    return "EXTREME"


def get_macro_anchors() -> MacroAnchors:
    errors: list[str] = []
    cash = get_cash_rate()
    if cash.get("error"):
        errors.append(f"RBA cash rate unavailable: {cash['error']}")
    cash_rate = cash.get("cash_rate")
    au_10y = None
    yield_curve = _clean(au_10y - cash_rate) if au_10y is not None and cash_rate is not None else None
    regime = "UNKNOWN"
    if cash_rate is not None:
        regime = "RESTRICTIVE" if cash_rate >= 4 else ("ACCOMMODATIVE" if cash_rate <= 1.5 else "NEUTRAL")

    cpi = abs_client.get_cpi()
    gdp = abs_client.get_gdp()
    unemployment = abs_client.get_unemployment()
    cpi_yoy = cpi.get("latest_cpi_yoy") if cpi else None
    trimmed = cpi.get("latest_trimmed_mean") if cpi else None

    shanghai_ytd = _pct_change("000001.SS", "ytd")
    aud_cny_3m = _pct_change("AUDCNY=X", "3mo")
    iron_ore_ytd = _pct_change("QRE.AX", "ytd")
    china_score = sum(
        1 if value is not None and value > 2 else (-1 if value is not None and value < -2 else 0)
        for value in (shanghai_ytd, aud_cny_3m, iron_ore_ytd)
    )
    china_signal = "POSITIVE" if china_score > 0 else ("NEGATIVE" if china_score < 0 else "NEUTRAL")

    vix = _last_close("^VIX", "5d")
    sector_changes = [
        (name, _pct_change(code, "1mo"))
        for code, name in SECTOR_PROXIES.items()
    ]
    outperformers = [name for name, change in sector_changes if change is not None and change > 0]
    underperformers = [name for name, change in sector_changes if change is not None and change < 0]
    rotation = "MIXED"
    if {"Resources", "Technology"}.intersection(outperformers) and _vix_regime(vix) in {"LOW", "NORMAL"}:
        rotation = "RISK_ON"
    elif {"Property", "Broad Market"}.intersection(underperformers) or _vix_regime(vix) in {"ELEVATED", "EXTREME"}:
        rotation = "RISK_OFF"

    summary = f"Rates look {regime.lower()}, China signal is {china_signal.lower()}, and risk sentiment is {_vix_regime(vix).lower()}."
    data_note = None
    if not any((cpi, gdp, unemployment)):
        data_note = "ABS CPI, GDP, and unemployment fields are best-effort and currently unavailable."

    return MacroAnchors(
        as_of_date=date.today().isoformat(),
        rates_environment=RatesEnv(
            rba_cash_rate=cash_rate,
            au_10y_bond_yield=au_10y,
            yield_curve_slope=yield_curve,
            regime=regime,
        ),
        inflation=InflationData(
            latest_cpi_yoy=cpi_yoy,
            latest_trimmed_mean=trimmed,
            above_target=bool(cpi_yoy is not None and cpi_yoy > 3),
        ),
        growth=GrowthData(
            gdp_growth_yoy=gdp.get("gdp_growth_yoy") if gdp else None,
            unemployment_rate=unemployment.get("unemployment_rate") if unemployment else None,
            retail_sales_mom=None,
        ),
        china_exposure=ChinaExposure(
            shanghai_comp_ytd=shanghai_ytd,
            aud_cny_3mo_change=aud_cny_3m,
            iron_ore_proxy_ytd=iron_ore_ytd,
            china_signal=china_signal,
        ),
        risk_sentiment=RiskSentiment(
            vix_level=vix,
            asx200_volatility_20d=_asx_volatility_20d(),
            vix_regime=_vix_regime(vix),
        ),
        sector_rotation=SectorRotation(
            outperforming_sectors=outperformers,
            underperforming_sectors=underperformers,
            rotation_signal=rotation,
        ),
        summary=summary,
        data_note=data_note,
        errors=errors,
    )
