from __future__ import annotations

from datetime import date

from mcp_server.analysis.llm_narrative import generate_narrative
from mcp_server.analysis.scoring import score_stock
from mcp_server.data.yfinance_client import get_info, normalize_asx_ticker
from mcp_server.models.recommendation import (
    AnalysisScores,
    KeyLevels,
    MacroAssessment,
    StockAnalysis,
    TechnicalAssessment,
)
from mcp_server.tools.macro_anchor import get_macro_anchors
from mcp_server.tools.macro_info import get_macro_info
from mcp_server.tools.technical import get_technical_indicators


def _overall(score: int, positive: str, negative: str, neutral: str) -> str:
    if score >= 20:
        return positive
    if score <= -20:
        return negative
    return neutral


def _key_levels(prices: list[float], current: float | None) -> KeyLevels:
    if not prices or current is None:
        return KeyLevels()
    recent = prices[-60:]
    support = min(recent) if recent else None
    resistance = max(recent) if recent else None
    return KeyLevels(
        support=round(support, 4) if support else None,
        resistance=round(resistance, 4) if resistance else None,
        stop_loss_suggestion=round(current * 0.92, 4),
    )


def analyze_stock(ticker: str) -> StockAnalysis:
    symbol = normalize_asx_ticker(ticker)
    technical = get_technical_indicators(ticker, "2y")
    macro = get_macro_info()
    anchors = get_macro_anchors()
    scored = score_stock(technical, macro, anchors)
    info = get_info(symbol)
    closes = [candle.close for candle in technical.price_series if candle.close is not None]

    momentum_signal = "NEUTRAL"
    if technical.momentum.rsi_14 is not None:
        if technical.momentum.rsi_14 < 30:
            momentum_signal = "OVERSOLD"
        elif technical.momentum.rsi_14 > 70:
            momentum_signal = "OVERBOUGHT"
        elif technical.momentum.macd is not None and technical.momentum.macd_signal is not None:
            momentum_signal = "BULLISH" if technical.momentum.macd > technical.momentum.macd_signal else "BEARISH"

    volatility_signal = "NORMAL"
    if technical.volatility.bb_width is not None:
        volatility_signal = "EXPANDED" if technical.volatility.bb_width > 0.18 else "COMPRESSED"

    volume_signal = "NORMAL"
    if technical.volume.volume_ratio is not None:
        volume_signal = "ELEVATED" if technical.volume.volume_ratio > 1.5 else "NORMAL"

    macro_overall = _overall(scored.macro_score, "FAVORABLE", "UNFAVORABLE", "NEUTRAL")
    analysis = StockAnalysis(
        symbol=symbol,
        company_name=info.get("longName") or info.get("shortName") or symbol,
        sector=info.get("sector"),
        analysis_date=date.today().isoformat(),
        scores=AnalysisScores(
            technical_score=scored.technical_score,
            macro_score=scored.macro_score,
            combined_score=scored.combined_score,
            signal_count_bullish=len(scored.bullish_signals),
            signal_count_bearish=len(scored.bearish_signals),
        ),
        technical_assessment=TechnicalAssessment(
            overall=_overall(scored.technical_score, "BULLISH", "BEARISH", "NEUTRAL"),
            trend_signal=technical.trend.trend_signal,
            momentum_signal=momentum_signal,
            volatility_signal=volatility_signal,
            volume_signal=volume_signal,
            key_levels=_key_levels(closes, technical.last_price),
        ),
        macro_assessment=MacroAssessment(
            overall=macro_overall,
            rates_headwind=anchors.rates_environment.regime == "RESTRICTIVE",
            china_tailwind=anchors.china_exposure.china_signal == "POSITIVE",
            commodity_tailwind=macro.commodities.copper_usd is not None or macro.commodities.gold_usd is not None,
            risk_sentiment=anchors.risk_sentiment.vix_regime,
        ),
        bullish_signals=scored.bullish_signals[:8],
        bearish_signals=scored.bearish_signals[:8],
        risk_factors=(scored.risk_factors or scored.bearish_signals)[:6],
    )
    prompt = (
        f"Summarise {analysis.symbol} in 4 sentences. Combined score {analysis.scores.combined_score}. "
        f"Bullish: {[s.factor for s in analysis.bullish_signals]}. Bearish: {[s.factor for s in analysis.bearish_signals]}. Risks: {[s.factor for s in analysis.risk_factors]}."
    )
    analysis.narrative = generate_narrative(prompt)
    return analysis
