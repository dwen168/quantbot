import yfinance as yf
import pandas as pd

def get_fundamentals(ticker: str):
    """
    Fetch fundamental data for a given ASX ticker.
    Automatically appends .AX if not present.
    """
    if not ticker.endswith(".AX"):
        ticker += ".AX"
    
    stock = yf.Ticker(ticker)
    info = stock.info
    
    # Extract relevant fundamentals
    fundamentals = {
        "symbol": info.get("symbol"),
        "longName": info.get("longName"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "marketCap": info.get("marketCap"),
        "trailingPE": info.get("trailingPE"),
        "forwardPE": info.get("forwardPE"),
        "dividendYield": info.get("dividendYield"),
        "beta": info.get("beta"),
        "fiftyTwoWeekHigh": info.get("fiftyTwoWeekHigh"),
        "fiftyTwoWeekLow": info.get("fiftyTwoWeekLow"),
        "averageVolume": info.get("averageVolume"),
    }
    
    # Get recent financials (Income Statement)
    try:
        df = stock.financials.transpose().head(3)
        df.index = df.index.astype(str)
        financials = df.fillna(0).to_dict()
        fundamentals["financials"] = financials
    except Exception:
        fundamentals["financials"] = "N/A"
        
    return fundamentals
