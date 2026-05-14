# ASX Quantitative Research Chatbot — Implementation Plan

A step-by-step guide to building a local, fully free quantitative research assistant for ASX stocks, powered by Ollama (local LLM), a Node.js/Express chat server, and a Python MCP data server.

---

## Architecture Overview

```
Browser / Chat UI  (React or plain HTML)
        │
        │ HTTP + SSE
        ▼
Node.js / Express Server     ← localhost:3000
  - Chat router
  - Session manager
  - SSE streaming
  - MCP client (calls Python tools)
        │
        │ REST (tool calls)
        ├──────────────────────────────────────┐
        ▼                                      ▼
Ollama (local LLM)               Python MCP Server  ← localhost:8000
  llama3.3 / deepseek-r1           - Fundamentals tool
  Tool-call support                - Macro context tool
                                   - Macro anchors tool
                                   - News & sentiment tool
                                   - Quantitative analysis tool
                                   - Recommendation tool
                                        │
                              ┌─────────┼─────────┐
                              ▼         ▼         ▼
                           yfinance  ABS/RBA   NewsAPI
                           FMP API   FRED      ASX RSS
                           FinBERT   EIA       GDELT
```

---

## Project Structure

```
quantbot/
├── server/                   ← Node.js Express app
│   ├── package.json
│   ├── app.js
│   ├── ollamaClient.js
│   ├── mcpClient.js
│   └── routes/
│       └── chat.js
│
├── mcp-server/               ← Python FastAPI app (independent service)
│   ├── requirements.txt
│   ├── main.py
│   ├── config.py
│   ├── cache.py
│   └── tools/
│       ├── fundamentals.py
│       ├── macro.py
│       ├── anchors.py
│       ├── news.py
│       ├── analysis.py
│       └── recommendation.py
│
├── client/                   ← Chat UI 
│
└── README.md
```