from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

import pandas as pd

from mcp_server.models.macro import (
    ASXMarket,
    ChinaExposure,
    Commodities,
    Currencies,
    GlobalIndices,
    GrowthData,
    InflationData,
    MacroRegime,
    MarketSnapshot,
    NewsItem,
    RatesEnv,
    RiskSentiment,
    SectorPerf,
    SectorRotation,
)
from mcp_server.models.recommendation import (
    AnalysisScores,
    KeyLevels,
    MacroAssessment,
    MarketContext,
    PriceGuidance,
    Recommendation,
    SignalFactor,
    StockAnalysis,
    TechnicalAssessment,
)
from mcp_server.models.technical import (
    Momentum,
    MovingAverages,
    TechnicalCandle,
    TechnicalIndicators,
    Trend,
    Volatility,
    VolumeData,
)

# ... (previous helper functions)

def get_mock_macro_regime() -> MacroRegime:
    # Generate mock cumulative trend data
    labels = [(datetime.now() - timedelta(days=60-i)).strftime("%Y-%m-%d") for i in range(60)]
    datasets = [
        {"label": "Broad Market", "data": [round(random.uniform(-1, 5) + (i * 0.05), 2) for i in range(60)], "borderColor": "#64748b", "borderWidth": 2, "pointRadius": 0, "tension": 0.3},
        {"label": "Resources", "data": [round(random.uniform(-2, 2) + (i * 0.02), 2) for i in range(60)], "borderColor": "#f59e0b", "borderWidth": 2, "pointRadius": 0, "tension": 0.3},
        {"label": "Financials", "data": [round(random.uniform(-1, 3) + (i * 0.04), 2) for i in range(60)], "borderColor": "#3b82f6", "borderWidth": 2, "pointRadius": 0, "tension": 0.3},
        {"label": "Technology", "data": [round(random.uniform(0, 10) + (i * 0.1), 2) for i in range(60)], "borderColor": "#10b981", "borderWidth": 2, "pointRadius": 0, "tension": 0.3},
    ]

    return MacroRegime(
        as_of_date=datetime.now().strftime("%Y-%m-%d"),
        rates_env=RatesEnv(rba_cash_rate=4.35, regime="RESTRICTIVE"),
        inflation=InflationData(latest_cpi_yoy=3.6, latest_trimmed_mean=3.8, above_target=True),
        growth=GrowthData(gdp_growth_yoy=1.5, unemployment_rate=4.1),
        china_exposure=ChinaExposure(shanghai_comp_ytd=-5.2, aud_cny_3mo_change=2.1, china_signal="NEGATIVE"),
        risk_sentiment=RiskSentiment(vix_level=14.5, vix_regime="NORMAL"),
        sector_rotation=SectorRotation(
            rotation_signal="RISK_OFF",
            trend_labels=labels,
            trend_datasets=datasets
        ),
        summary="Mock summary: The market is currently in a restrictive rates environment with mixed signals from China.",
        geopolitical_context="Ongoing regional tensions are keeping energy prices volatile.",
        news_headlines=[
            NewsItem(title="Inflation pressures remain sticky", publisher="Economic Times", published=datetime.now().isoformat(), category="Macro")
        ]
    )


def get_mock_stock_analysis(ticker: str) -> StockAnalysis:
    symbol = ticker.upper() if ".AX" in ticker.upper() else f"{ticker.upper()}.AX"
    last_price = random.uniform(20, 100)

    return StockAnalysis(
        symbol=symbol,
        company_name=f"Mock {ticker.upper()} Ltd",
        sector="Financial Services",
        analysis_date=datetime.now().strftime("%Y-%m-%d"),
        last_price=round(last_price, 2),
        scores=AnalysisScores(
            technical_score=45,
            macro_score=10,
            combined_score=31,
            signal_count_bullish=5,
            signal_count_bearish=2
        ),
        technical_assessment=TechnicalAssessment(
            overall="BULLISH",
            trend_signal="UPTREND",
            momentum_signal="BULLISH",
            volatility_signal="NORMAL",
            volume_signal="ELEVATED",
            key_levels=KeyLevels(support=round(last_price * 0.9, 2), resistance=round(last_price * 1.1, 2), stop_loss_suggestion=round(last_price * 0.85, 2))
        ),
        macro_assessment=MacroAssessment(
            overall="NEUTRAL",
            rates_headwind=True,
            china_tailwind=False,
            commodity_tailwind=True,
            risk_sentiment="NORMAL"
        ),
        bullish_signals=[SignalFactor(factor="Strong Momentum", score=20, category="technical")],
        bearish_signals=[SignalFactor(factor="High Interest Rates", score=-15, category="macro")],
        narrative="Mock analysis narrative: This stock shows strong technical momentum despite macro headwinds."
    )


def get_mock_recommendation(ticker: str) -> Recommendation:
    analysis = get_mock_stock_analysis(ticker)
    last_price = analysis.last_price

    return Recommendation(
        symbol=analysis.symbol,
        company_name=analysis.company_name,
        recommendation_date=analysis.analysis_date,
        action="BUY",
        conviction=75,
        time_horizon="6-12 Months",
        risk_level="MEDIUM",
        price_guidance=PriceGuidance(
            current_price=last_price,
            entry_range_low=round(last_price * 0.95, 2),
            entry_range_high=round(last_price * 1.02, 2),
            stop_loss=round(last_price * 0.88, 2),
            target_price=round(last_price * 1.25, 2),
            upside_pct=25.0,
            downside_risk_pct=12.0
        ),
        key_reasons=[SignalFactor(factor="Technical Breakout", score=25)],
        key_risks=[SignalFactor(factor="Macro Volatility", score=-10)],
        market_context=MarketContext(asx200_level=7800.0, aud_usd=0.66, vix_level=14.0, rba_cash_rate=4.35),
        underlying_analysis=analysis,
        narrative="Mock recommendation rationale: Technical setup is favorable for a medium-term hold."
    )

def _generate_price_series(start_price: float, days: int = 100) -> list[TechnicalCandle]:
    series = []
    current_price = start_price
    base_date = datetime.now() - timedelta(days=days)
    
    for i in range(days):
        date_str = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        change_pct = random.uniform(-0.02, 0.02)
        open_p = round(current_price * (1 + random.uniform(-0.005, 0.005)), 2)
        close_p = round(current_price * (1 + change_pct), 2)
        high_p = round(max(open_p, close_p) * (1 + random.uniform(0, 0.01)), 2)
        low_p = round(min(open_p, close_p) * (1 - random.uniform(0, 0.01)), 2)
        volume = random.randint(100000, 1000000)
        
        series.append(TechnicalCandle(
            time=date_str,
            open=open_p,
            high=high_p,
            low=low_p,
            close=close_p,
            volume=float(volume),
            sma_20=round(current_price * 0.98, 2),
            sma_50=round(current_price * 0.95, 2),
            macd=0.5,
            macd_signal=0.4,
            macd_histogram=0.1
        ))
        current_price = close_p
        
    return series


def get_mock_technical_indicators(ticker: str) -> TechnicalIndicators:
    last_price = random.uniform(10, 150)
    series = _generate_price_series(last_price)
    
    return TechnicalIndicators(
        symbol=ticker.upper(),
        period="2y",
        last_price=round(last_price, 2),
        price_change_pct=round(random.uniform(-3, 3), 2),
        moving_averages=MovingAverages(
            sma_20=round(last_price * 0.98, 2),
            sma_50=round(last_price * 0.95, 2),
            sma_200=round(last_price * 0.9, 2),
            ema_20=round(last_price * 0.98, 2),
            ema_50=round(last_price * 0.96, 2)
        ),
        momentum=Momentum(
            rsi_14=round(random.uniform(30, 70), 2),
            macd=0.5,
            macd_signal=0.4,
            macd_histogram=0.1,
            stoch_k=65.0,
            stoch_d=60.0
        ),
        volatility=Volatility(
            bb_upper=round(last_price * 1.05, 2),
            bb_middle=round(last_price, 2),
            bb_lower=round(last_price * 0.95, 2),
            bb_width=0.1,
            atr_14=round(last_price * 0.02, 2)
        ),
        trend=Trend(
            adx_14=22.5,
            trend_signal="BULLISH" if random.random() > 0.5 else "BEARISH"
        ),
        volume=VolumeData(
            volume_ratio=round(random.uniform(0.5, 2.0), 2)
        ),
        signals=["RSI is Neutral", "Price is above 200-day SMA"],
        price_series=series
    )


def _generate_simple_history(start_price: float, days: int = 60) -> list[dict]:
    series = []
    current_price = start_price
    base_date = datetime.now() - timedelta(days=days)
    for i in range(days):
        date_str = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        change_pct = random.uniform(-0.015, 0.015)
        current_price = round(current_price * (1 + change_pct), 2)
        series.append({
            "time": date_str,
            "open": current_price,
            "high": current_price + 0.5,
            "low": current_price - 0.5,
            "close": current_price
        })
    return series


def get_mock_market_snapshot() -> MarketSnapshot:
    sectors = [
        SectorPerf(code="^AXFJ", name="Financials", one_d_pct=0.8, series=_generate_simple_history(7200)),
        SectorPerf(code="^AXMJ", name="Materials", one_d_pct=-1.2, series=_generate_simple_history(18500)),
        SectorPerf(code="^AXIJ", name="Technology", one_d_pct=2.1, series=_generate_simple_history(2100)),
        SectorPerf(code="^AXRE", name="Real Estate", one_d_pct=0.5, series=_generate_simple_history(1450)),
        SectorPerf(code="^AXHJ", name="Health Care", one_d_pct=-0.3, series=_generate_simple_history(42000)),
    ]
    
    return MarketSnapshot(
        as_of_date=datetime.now().strftime("%Y-%m-%d"),
        asx_market=ASXMarket(
            asx200_level=7850.5,
            asx200_1d_change=0.45,
            rba_cash_rate=4.35,
            top_sectors=sectors
        ),
        currencies=Currencies(
            aud_usd=0.6650,
            aud_cny=4.82,
            aud_usd_1mo_change=1.2,
            aud_usd_series=_generate_simple_history(0.66, 90),
            aud_cny_series=_generate_simple_history(4.8, 90)
        ),
        commodities=Commodities(
            gold_usd=2350.0,
            crude_oil_usd=78.5,
            iron_ore_etf_proxy=105.2,
            copper_usd=4.50,
            coal_proxy_ticker=145.0,
            gold_usd_series=_generate_simple_history(2300, 90),
            crude_oil_usd_series=_generate_simple_history(80, 90),
            iron_ore_series=_generate_simple_history(100, 90),
            copper_usd_series=_generate_simple_history(4.4, 90),
            coal_series=_generate_simple_history(140, 90)
        ),
        global_indices=GlobalIndices(
            sp500_1d_change=0.2,
            nasdaq_1d_change=0.5,
            shanghai_1d_change=-0.3,
            hang_seng_1d_change=0.1,
            sp500_series=_generate_simple_history(5200, 90),
            nasdaq_series=_generate_simple_history(16000, 90),
            shanghai_series=_generate_simple_history(3050, 90),
            hang_seng_series=_generate_simple_history(18000, 90)
        ),
        news_headlines=[
            NewsItem(title="Reserve Bank holds rates steady", publisher="Financial Times", published=datetime.now().isoformat(), category="Macro"),
            NewsItem(title="Tech stocks rally on earnings", publisher="Reuters", published=datetime.now().isoformat(), category="Markets")
        ]
    )
