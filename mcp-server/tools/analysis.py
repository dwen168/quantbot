import yfinance as yf
import pandas as pd
import numpy as np

def perform_quantitative_analysis(ticker: str):
    """
    Perform quantitative analysis including Moving Averages, RSI, and Volatility.
    """
    if not ticker.endswith(".AX"):
        ticker += ".AX"
        
    stock = yf.Ticker(ticker)
    df = stock.history(period="1y")
    
    if df.empty:
        return {"error": "No historical data found"}
    
    # Simple Moving Averages
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    df['SMA_200'] = df['Close'].rolling(window=200).mean()
    
    # RSI (Relative Strength Index)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # Volatility (Annualized)
    df['Returns'] = df['Close'].pct_change()
    volatility = df['Returns'].std() * np.sqrt(252)
    
    latest = df.iloc[-1]
    
    analysis = {
        "ticker": ticker,
        "current_price": float(latest['Close']) if not pd.isna(latest['Close']) else 0.0,
        "sma_50": float(latest['SMA_50']) if not pd.isna(latest['SMA_50']) else 0.0,
        "sma_200": float(latest['SMA_200']) if not pd.isna(latest['SMA_200']) else 0.0,
        "rsi_14": float(latest['RSI']) if not pd.isna(latest['RSI']) else 0.0,
        "annualized_volatility": float(volatility) if not pd.isna(volatility) else 0.0,
        "trend": "Bullish" if latest['Close'] > latest['SMA_200'] else "Bearish",
        "rsi_condition": "Overbought" if latest['RSI'] > 70 else ("Oversold" if latest['RSI'] < 30 else "Neutral")
    }
    
    return analysis
