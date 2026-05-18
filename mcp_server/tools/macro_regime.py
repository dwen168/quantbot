from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date
import pandas as pd

from mcp_server.data import abs_client
from mcp_server.data.macro_core import SECTOR_PROXIES, fetch_macro_core
from mcp_server.data.yfinance_client import get_ohlcv
from mcp_server.models.macro import (
    ChinaExposure,
    GrowthData,
    InflationData,
    MacroRegime,
    RatesEnv,
    RiskSentiment,
    SectorRotation,
)

def _clean(value):
    try:
        if value is None or pd.isna(value):
            return None
        return round(float(value), 4)
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


from mcp_server.analysis.llm_narrative import generate_narrative

def get_macro_regime(include_narrative: bool = True) -> MacroRegime:
    """
    Step 4: New analysis-oriented tool.
    Focuses on 'What is underlying economic environment?'
    Used for scoring and deep context.
    """
    core = fetch_macro_core()
    errors = []
    if core.raw_rba.get("error"):
        errors.append(f"RBA data issue: {core.raw_rba['error']}")

    # 1. Rates
    cash_rate = core.cash_rate
    au_10y = None # Still placeholder or could be fetched
    yield_curve = None
    regime = "UNKNOWN"
    if cash_rate is not None:
        regime = "RESTRICTIVE" if cash_rate >= 4 else ("ACCOMMODATIVE" if cash_rate <= 1.5 else "NEUTRAL")

    # 2. ABS Data
    cpi = abs_client.get_cpi()
    gdp = abs_client.get_gdp()
    unemployment = abs_client.get_unemployment()
    
    # 3. China Signal
    china_score = sum(
        1 if value is not None and value > 2 else (-1 if value is not None and value < -2 else 0)
        for value in (core.shanghai_ytd, core.aud_cny_3m, core.iron_ore_ytd)
    )
    china_signal = "POSITIVE" if china_score > 0 else ("NEGATIVE" if china_score < 0 else "NEUTRAL")

    # 4. Risk Sentiment
    vix = core.vix
    vix_regime_str = _vix_regime(vix)

    # 5. Sector Rotation
    sector_changes = core.sector_changes
    outperformers = [name for name, change in sector_changes.items() if change is not None and change > 0]
    underperformers = [name for name, change in sector_changes.items() if change is not None and change < 0]
    
    rotation = "MIXED"
    if {"Resources", "Technology"}.intersection(outperformers) and vix_regime_str in {"LOW", "NORMAL"}:
        rotation = "RISK_ON"
    elif {"Property", "Broad Market"}.intersection(underperformers) or vix_regime_str in {"ELEVATED", "EXTREME"}:
        rotation = "RISK_OFF"

    # Fetch 3-month series for sector trend chart
    trend_labels = []
    trend_datasets = []
    
    def fetch_sector_trend(args):
        code, name = args
        if name == "Property": return None
        df = get_ohlcv(code, "3mo")
        if not df.empty:
            df = df.dropna(subset=["Close"])
            if not df.empty:
                base_price = df["Close"].iloc[0]
                cumulative_pct = ((df["Close"] - base_price) / base_price * 100).round(2)
                return {
                    "name": name,
                    "labels": [d.strftime("%Y-%m-%d") for d in df.index],
                    "data": cumulative_pct.tolist()
                }
        return None

    try:
        colors = {"Broad Market": "#64748b", "Resources": "#f59e0b", "Financials": "#3b82f6", "Technology": "#10b981"}
        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(executor.map(fetch_sector_trend, SECTOR_PROXIES.items()))
            
        for res in results:
            if res:
                if not trend_labels:
                    trend_labels = res["labels"]
                trend_datasets.append({
                    "label": res["name"], "data": res["data"], 
                    "borderColor": colors.get(res["name"], "#999999"), "borderWidth": 2, "pointRadius": 0, "tension": 0.3
                })
    except Exception as e:
        errors.append(f"Failed to fetch sector trend data: {e}")

    # 6. Geopolitical Context & LLM Summary
    summary = f"Rates look {regime.lower()}, China signal is {china_signal.lower()}, and risk sentiment is {vix_regime_str.lower()}."
    geopolitics = "Geopolitical context deferred."
    
    if include_narrative:
        news_text = "\n".join([f"- {n.title}" for n in core.news_headlines])
        prompt = (
            f"Analyze the current Australian macro regime based on these inputs:\n"
            f"- RBA Cash Rate: {cash_rate}% ({regime})\n"
            f"- China Signal: {china_signal}\n"
            f"- Risk Sentiment (VIX): {vix} ({vix_regime_str})\n"
            f"- Commodities: Gold {core.commodities.get('gold')}, Oil {core.commodities.get('oil')}\n"
            f"- Recent Headlines: {news_text}\n\n"
            f"Task:\n"
            f"1. Provide a 2-sentence structural macro summary.\n"
            f"2. Provide a 1-sentence assessment of GEOPOLITICAL RISK if relevant (wars, trade issues). If none, say 'No significant geopolitical escalation detected.'\n"
            f"Format: Separate the two sections with a [GEO] delimiter."
        )
        llm_output = generate_narrative(prompt)
        
        if llm_output:
            if "[GEO]" in llm_output:
                parts = llm_output.split("[GEO]")
                summary = parts[0].strip()
                geopolitics = parts[1].strip()
            else:
                summary = llm_output.strip()
                geopolitics = "Geopolitical assessment integrated into summary."
        else:
            geopolitics = "Geopolitical context unavailable (LLM connection timeout or offline)."

    return MacroRegime(
        as_of_date=date.today().isoformat(),
        rates_env=RatesEnv(
            rba_cash_rate=cash_rate,
            au_10y_bond_yield=au_10y,
            yield_curve_slope=yield_curve,
            regime=regime,
        ),
        inflation=InflationData(
            latest_cpi_yoy=cpi.get("latest_cpi_yoy") if cpi else None,
            latest_trimmed_mean=cpi.get("latest_trimmed_mean") if cpi else None,
            above_target=bool(cpi.get("latest_cpi_yoy") is not None and cpi.get("latest_cpi_yoy") > 3) if cpi else False,
        ),
        growth=GrowthData(
            gdp_growth_yoy=gdp.get("gdp_growth_yoy") if gdp else None,
            unemployment_rate=unemployment.get("unemployment_rate") if unemployment else None,
        ),
        china_exposure=ChinaExposure(
            shanghai_comp_ytd=core.shanghai_ytd,
            aud_cny_3mo_change=core.aud_cny_3m,
            iron_ore_proxy_ytd=core.iron_ore_ytd,
            china_signal=china_signal,
        ),
        risk_sentiment=RiskSentiment(
            vix_level=vix,
            asx200_volatility_20d=_asx_volatility_20d(),
            vix_regime=vix_regime_str,
        ),
        sector_rotation=SectorRotation(
            outperforming_sectors=outperformers,
            underperforming_sectors=underperformers,
            rotation_signal=rotation,
            trend_labels=trend_labels,
            trend_datasets=trend_datasets,
        ),
        commodities=core.commodities,
        global_indices_1d=core.global_indices_1d,
        news_headlines=core.news_headlines,
        geopolitical_context=geopolitics,
        summary=summary,
        errors=errors,
    )
