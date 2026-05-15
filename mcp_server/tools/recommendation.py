from __future__ import annotations

from datetime import date

from mcp_server.analysis.llm_narrative import generate_narrative
from mcp_server.models.recommendation import PriceGuidance, Recommendation
from mcp_server.tools.analysis import analyze_stock


def _decision(score: int) -> tuple[str, int]:
    if score >= 40:
        return "BUY", min(100, 60 + round((score - 40) * 40 / 60))
    if score >= 15:
        return "BUY", 50 + round((score - 15) * 9 / 24)
    if score >= -14:
        return "HOLD", 40 + round((14 - abs(score)) * 10 / 14)
    if score >= -39:
        return "SELL", 50 + round((abs(score) - 15) * 9 / 24)
    return "SELL", min(100, 60 + round((abs(score) - 40) * 40 / 60))


def _risk_level(score: int, bearish_count: int) -> str:
    if abs(score) < 15 or bearish_count >= 4:
        return "HIGH"
    if abs(score) < 40 or bearish_count >= 2:
        return "MEDIUM"
    return "LOW"


def recommend_stock(ticker: str) -> Recommendation:
    analysis = analyze_stock(ticker)
    score = analysis.scores.combined_score
    action, confidence = _decision(score)
    current = analysis.technical_assessment.key_levels.stop_loss_suggestion
    stop = analysis.technical_assessment.key_levels.stop_loss_suggestion
    if stop is not None:
        current = round(stop / 0.92, 4)
    target = round(current * 1.15, 4) if current and action == "BUY" else (round(current * 0.9, 4) if current else None)
    entry_low = round(current * 0.98, 4) if current and action != "SELL" else None
    entry_high = round(current * 1.02, 4) if current and action != "SELL" else None
    upside = round(((target - current) / current) * 100, 2) if target and current else None
    downside = round(((current - stop) / current) * 100, 2) if stop and current else None

    reasons = (analysis.bullish_signals if action == "BUY" else analysis.bearish_signals)[:5]
    if action == "HOLD":
        reasons = ["Score is balanced between bullish and bearish drivers"] + analysis.bullish_signals[:2] + analysis.bearish_signals[:2]
    risks = (analysis.risk_factors or analysis.bearish_signals or ["Market data sources may be incomplete"])[:3]

    recommendation = Recommendation(
        symbol=analysis.symbol,
        company_name=analysis.company_name,
        recommendation_date=date.today().isoformat(),
        action=action,
        confidence=confidence,
        time_horizon="MEDIUM" if action != "HOLD" else "SHORT",
        risk_level=_risk_level(score, len(analysis.bearish_signals)),
        price_guidance=PriceGuidance(
            current_price=current,
            entry_range_low=entry_low,
            entry_range_high=entry_high,
            stop_loss=stop,
            target_price=target,
            upside_pct=upside,
            downside_risk_pct=downside,
        ),
        key_reasons=reasons[:5],
        key_risks=risks,
        underlying_analysis=analysis,
    )
    prompt = (
        f"Write a concise {recommendation.action} recommendation for {recommendation.symbol}. "
        f"Confidence {recommendation.confidence}%, risk {recommendation.risk_level}. "
        f"Reasons: {recommendation.key_reasons}. Risks: {recommendation.key_risks}."
    )
    recommendation.narrative = generate_narrative(prompt)
    return recommendation
