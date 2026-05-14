import yfinance as yf
from .fundamentals import get_fundamentals
from .analysis import perform_quantitative_analysis
from .news import get_news_sentiment

def get_recommendations(ticker: str, model: str = "llama3.3"):
    """
    Consolidates data to generate a multi-factor quantitative score.
    """
    if not ticker.endswith(".AX"):
        ticker += ".AX"
        
    stock = yf.Ticker(ticker)
    info = stock.info
    
    # Base analyst recs
    analyst = {
        "recommendation_key": info.get("recommendationKey"),
        "target_mean_price": info.get("targetMeanPrice"),
        "target_high_price": info.get("targetHighPrice"),
        "target_low_price": info.get("targetLowPrice"),
        "number_of_analyst_opinions": info.get("numberOfAnalystOpinions"),
        "current_price": info.get("currentPrice")
    }
    
    # Gather other data for scoring
    try:
        fund = get_fundamentals(ticker)
    except Exception:
        fund = {}
        
    try:
        tech = perform_quantitative_analysis(ticker)
    except Exception:
        tech = {}
        
    try:
        news = get_news_sentiment(ticker, model)
    except Exception:
        news = []
    
    # 1. Value Score (0-25)
    value_score = 12.5
    pe = fund.get("trailingPE")
    if isinstance(pe, (int, float)):
        if pe < 15: value_score += 12.5
        elif pe > 25: value_score -= 10
    
    yield_val = fund.get("dividendYield")
    if isinstance(yield_val, (int, float)):
        if yield_val > 0.04: value_score += 5
        elif yield_val < 0.01: value_score -= 5
        
    value_score = max(0, min(25, value_score))
    
    # 2. Technical Score (0-25)
    tech_score = 12.5
    if not tech.get("error"):
        if tech.get("trend") == "Bullish": tech_score += 7.5
        else: tech_score -= 7.5
        
        rsi = tech.get("rsi_condition")
        if rsi == "Oversold": tech_score += 5
        elif rsi == "Overbought": tech_score -= 5
    tech_score = max(0, min(25, tech_score))
    
    # 3. Sentiment Score (0-25)
    sent_score = 12.5
    pos = sum(1 for n in news if n.get("sentiment") == "Positive")
    neg = sum(1 for n in news if n.get("sentiment") == "Negative")
    if pos > neg: sent_score += 10
    elif neg > pos: sent_score -= 10
    sent_score = max(0, min(25, sent_score))
    
    # 4. Analyst Consensus Score (0-25)
    analyst_score = 12.5
    rec_key = analyst.get("recommendation_key", "") or ""
    if "buy" in rec_key.lower() or "strong_buy" in rec_key.lower(): analyst_score += 10
    elif "sell" in rec_key.lower() or "underperform" in rec_key.lower(): analyst_score -= 10
    analyst_score = max(0, min(25, analyst_score))
    
    total_score = value_score + tech_score + sent_score + analyst_score
    
    signal = "HOLD / NEUTRAL"
    if total_score >= 75: signal = "STRONG BUY"
    elif total_score >= 60: signal = "BUY"
    elif total_score <= 35: signal = "STRONG SELL"
    elif total_score <= 45: signal = "SELL"
    
    return {
        "ticker": ticker,
        "analyst_data": analyst,
        "scoring": {
            "value_score": round(value_score, 1),
            "technical_score": round(tech_score, 1),
            "sentiment_score": round(sent_score, 1),
            "analyst_score": round(analyst_score, 1),
            "total_score": round(total_score, 1),
            "max_score": 100
        },
        "quant_signal": signal
    }
