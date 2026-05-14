import yfinance as yf
import requests

def get_news_sentiment(ticker: str, model: str = "llama3.3"):
    """
    Fetch news for a ticker and perform sentiment analysis using local Ollama.
    """
    if not ticker.endswith(".AX"):
        ticker += ".AX"
        
    stock = yf.Ticker(ticker)
    news_items = stock.news[:5]  # Get latest 5 news items
    
    results = []
    for item in news_items:
        title = item.get("title")
        if not title:
            continue
            
        # Perform sentiment analysis using Ollama
        try:
            prompt = f"Analyze the financial sentiment of this news headline: '{title}'. Respond with EXACTLY ONE WORD: Positive, Negative, or Neutral."
            
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False
            }
            
            response = requests.post("http://localhost:11434/api/generate", json=payload)
            response.raise_for_status()
            
            data = response.json()
            sentiment_text = data.get("response", "").strip()
            
            # Basic parsing to ensure it's one of the labels
            sentiment = "Neutral"
            if "positive" in sentiment_text.lower():
                sentiment = "Positive"
            elif "negative" in sentiment_text.lower():
                sentiment = "Negative"

            results.append({
                "title": title,
                "publisher": item.get("publisher", "Unknown"),
                "link": item.get("link", ""),
                "sentiment": sentiment,
                "score": 0.0 # Ollama doesn't give a confidence score natively like FinBERT
            })
        except Exception as e:
            print(f"Sentiment analysis failed for title '{title}': {e}")
            continue
        
    return results
