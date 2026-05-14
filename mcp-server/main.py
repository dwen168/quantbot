import os
import sys

# Ensure the root directory is in the path for absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn

from tools.fundamentals import get_fundamentals
from tools.macro import get_macro_context, get_macro_anchors
from tools.news import get_news_sentiment
from tools.analysis import perform_quantitative_analysis
from tools.recommendation import get_recommendations

app = FastAPI(title="ASX Quantitative Research MCP Server")

class TickerRequest(BaseModel):
    ticker: str

@app.get("/")
async def root():
    return {"status": "online", "message": "ASX QuantBot MCP Server"}

@app.get("/fundamentals/{ticker}")
async def fundamentals(ticker: str):
    try:
        return get_fundamentals(ticker)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/macro/context")
async def macro_context():
    try:
        return get_macro_context()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/macro/anchors")
async def macro_anchors():
    try:
        return get_macro_anchors()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/news/{ticker}")
async def news_sentiment(ticker: str, model: Optional[str] = "llama3.3"):
    try:
        return get_news_sentiment(ticker, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analysis/{ticker}")
async def quantitative_analysis(ticker: str):
    try:
        return perform_quantitative_analysis(ticker)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recommendation/{ticker}")
async def recommendation(ticker: str, model: Optional[str] = "llama3.3"):
    try:
        return get_recommendations(ticker, model)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
