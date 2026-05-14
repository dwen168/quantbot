# ASX Quantitative Research Chatbot

A local, fully free quantitative research assistant for ASX stocks.

## Prerequisites

1. **Ollama**: Install from [ollama.com](https://ollama.com).
   - Pull the model: `ollama pull llama3.3` (or `deepseek-r1`)
2. **Python 3.10+**
3. **Node.js 18+**

## Setup & Running

### 1. Python MCP Server
The MCP server handles data fetching (yfinance, news sentiment, macro indicators).

```bash
cd mcp-server
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
python main.py
```
The server will run on `http://localhost:8000`.

### 2. Node.js Express Server
The Express server orchestrates between Ollama and the MCP server.

```bash
cd server
npm start # or node app.js
```
The server will run on `http://localhost:3000`.

### 3. Chat UI
Open `client/index.html` in your browser.

## Architecture

- **Ollama**: Local LLM processing.
- **Python MCP Server**: Financial data tools using `yfinance` and `FinBERT` sentiment analysis.
- **Node.js Server**: Session management, SSE streaming, and context enrichment.
- **SSE (Server-Sent Events)**: Real-time streaming of LLM responses.

## Features
- **Model Selection**: Choose from any locally installed Ollama models (e.g., llama3.3, deepseek-r1) directly from the UI.
- **Fundamentals**: Market cap, PE, yield, etc.
- **Quantitative Analysis**: SMA, RSI, Volatility, Trend detection.
- **Sentiment Analysis**: Real-time news sentiment using FinBERT.
- **Macro Context**: AU Cash rate, inflation, and structural "Macro Anchors".
