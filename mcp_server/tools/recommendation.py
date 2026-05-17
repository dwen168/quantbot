from __future__ import annotations

from datetime import date

from mcp_server.analysis.llm_narrative import generate_narrative
from mcp_server.models.recommendation import MarketContext, PriceGuidance, Recommendation
from mcp_server.tools.analysis import analyze_stock
from mcp_server.tools.market_snapshot import get_market_snapshot


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

    # Use last_price directly from analysis
    current = analysis.last_price
    raw_stop = analysis.technical_assessment.key_levels.stop_loss_suggestion
    support = analysis.technical_assessment.key_levels.support
    resistance = analysis.technical_assessment.key_levels.resistance

    # Stop loss: use the pre-calculated suggestion (8% below current)
    stop = raw_stop

    # Target: based on action and resistance level
    if current and action == "BUY":
        target = resistance if resistance and resistance > current else round(current * 1.15, 4)
    elif current and action == "SELL":
        target = support if support and support < current else round(current * 0.88, 4)
    else:
        target = current  # HOLD: no directional target

    # Entry range: for BUY wait for a slight dip; for SELL look for a bounce to sell into
    if current and action == "BUY":
        entry_low = round(current * 0.98, 4)
        entry_high = round(current * 1.005, 4)
    elif current and action == "SELL":
        entry_low = round(current * 0.995, 4)
        entry_high = round(current * 1.02, 4)
    else:
        entry_low = round(current * 0.99, 4) if current else None
        entry_high = round(current * 1.01, 4) if current else None

    upside = round(((target - current) / current) * 100, 2) if target and current else None
    downside = round(((current - stop) / current) * 100, 2) if stop and current else None

    reasons = (analysis.bullish_signals if action == "BUY" else analysis.bearish_signals)[:5]
    if action == "HOLD":
        reasons = [{"factor": "Score is balanced between bullish and bearish drivers", "score": 0}] + analysis.bullish_signals[:2] + analysis.bearish_signals[:2]
    
    fallback_risks = [{"factor": "Market data sources may be incomplete", "score": 0}]
    risks = (analysis.risk_factors or analysis.bearish_signals or fallback_risks)[:3]

    # Fetch snapshot for market context
    snapshot = get_market_snapshot()

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
        market_context=MarketContext(
            asx200_level=snapshot.asx_market.asx200_level,
            aud_usd=snapshot.currencies.aud_usd
        ),
        key_reasons=reasons[:5],
        key_risks=risks,
        underlying_analysis=analysis,
    )
    prompt = (
        f"Write a concise {recommendation.action} recommendation for {recommendation.symbol}. "
        f"Confidence {recommendation.confidence}%, risk {recommendation.risk_level}. "
        f"Reasons: {[r.factor for r in recommendation.key_reasons]}. Risks: {[r.factor for r in recommendation.key_risks]}."
    )
    recommendation.narrative = generate_narrative(prompt)
    return recommendation
