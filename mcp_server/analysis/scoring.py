from __future__ import annotations

from dataclasses import dataclass, field

from mcp_server.models.macro import MacroAnchors, MacroInfo
from mcp_server.models.technical import TechnicalIndicators


@dataclass
class ScoreResult:
    technical_score: int
    macro_score: int
    combined_score: int
    bullish_signals: list[str] = field(default_factory=list)
    bearish_signals: list[str] = field(default_factory=list)
    risk_factors: list[str] = field(default_factory=list)


def _clamp(value: int) -> int:
    return max(-100, min(100, value))


def score_stock(technical: TechnicalIndicators, macro: MacroInfo, anchors: MacroAnchors) -> ScoreResult:
    technical_score = 0
    macro_score = 0
    bullish: list[str] = []
    bearish: list[str] = []
    risks: list[str] = []

    rsi = technical.momentum.rsi_14
    if rsi is not None:
        if rsi < 30:
            technical_score += 15
            bullish.append({"factor": "RSI is oversold, suggesting potential mean reversion", "score": 15})
        elif rsi > 70:
            technical_score -= 15
            bearish.append({"factor": "RSI is overbought, raising pullback risk", "score": -15})

    if technical.momentum.macd is not None and technical.momentum.macd_signal is not None:
        if technical.momentum.macd > technical.momentum.macd_signal:
            technical_score += 15
            bullish.append({"factor": "MACD is above its signal line", "score": 15})
        else:
            technical_score -= 15
            bearish.append({"factor": "MACD is below its signal line", "score": -15})

    sma200 = technical.moving_averages.sma_200
    if technical.last_price is not None and sma200 is not None:
        if technical.last_price > sma200:
            technical_score += 20
            bullish.append({"factor": "Price is trading above the 200-day moving average", "score": 20})
        else:
            technical_score -= 20
            bearish.append({"factor": "Price is trading below the 200-day moving average", "score": -20})

    if technical.trend.adx_14 is not None:
        if technical.trend.trend_signal == "UPTREND" and technical.trend.adx_14 >= 20:
            technical_score += 15
            bullish.append({"factor": "ADX confirms an upward trend", "score": 15})
        elif technical.trend.trend_signal == "DOWNTREND" and technical.trend.adx_14 >= 20:
            technical_score -= 15
            bearish.append({"factor": "ADX confirms a downward trend", "score": -15})

    if technical.volatility.bb_upper and technical.volatility.bb_lower and technical.last_price:
        if technical.last_price < technical.volatility.bb_lower:
            technical_score += 10
            bullish.append({"factor": "Price is below the lower Bollinger Band", "score": 10})
        elif technical.last_price > technical.volatility.bb_upper:
            technical_score -= 10
            bearish.append({"factor": "Price is above the upper Bollinger Band", "score": -10})

    if technical.volume.volume_ratio is not None and technical.volume.volume_ratio >= 1.5:
        if technical.trend.trend_signal == "UPTREND":
            technical_score += 10
            bullish.append({"factor": "Volume confirms the upward move", "score": 10})
        elif technical.trend.trend_signal == "DOWNTREND":
            technical_score -= 10
            bearish.append({"factor": "Elevated volume confirms selling pressure", "score": -10})

    regime = anchors.rates_environment.regime
    if regime == "RESTRICTIVE":
        macro_score -= 15
        risks.append({"factor": "Restrictive RBA policy can pressure equity valuations", "score": -15})
    elif regime == "ACCOMMODATIVE":
        macro_score += 15
        bullish.append({"factor": "Accommodative rates are supportive for equities", "score": 15})

    vix_regime = anchors.risk_sentiment.vix_regime
    if vix_regime in {"LOW", "NORMAL"}:
        macro_score += 10
        bullish.append({"factor": f"VIX regime is {vix_regime.lower()}, supporting risk appetite", "score": 10})
    elif vix_regime in {"ELEVATED", "EXTREME"}:
        macro_score -= 20
        risks.append({"factor": f"VIX regime is {vix_regime.lower()}, implying higher market stress", "score": -20})

    if anchors.china_exposure.china_signal == "POSITIVE":
        macro_score += 10
        bullish.append({"factor": "China-linked macro indicators are positive", "score": 10})
    elif anchors.china_exposure.china_signal == "NEGATIVE":
        macro_score -= 10
        risks.append({"factor": "China-linked macro indicators are negative", "score": -10})

    if macro.commodities.gold_usd or macro.commodities.crude_oil_usd or macro.commodities.copper_usd:
        commodity_values = [macro.commodities.gold_usd, macro.commodities.crude_oil_usd, macro.commodities.copper_usd]
        if sum(value is not None for value in commodity_values) >= 2:
            macro_score += 5
            bullish.append({"factor": "Key commodity market data is available for resource-stock context", "score": 5})

    combined = round((_clamp(technical_score) * 0.6) + (_clamp(macro_score) * 0.4))
    return ScoreResult(
        technical_score=_clamp(technical_score),
        macro_score=_clamp(macro_score),
        combined_score=_clamp(combined),
        bullish_signals=bullish,
        bearish_signals=bearish,
        risk_factors=risks,
    )
