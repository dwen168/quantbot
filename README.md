# QuantBot ASX MCP Server

QuantBot is a local MCP server for ASX stock analysis. It exposes tools for technical
indicators, macro context, macro anchors, stock analysis, and trade recommendations.

## Run

```bash
pip install -e ".[dev]"
quantbot-mcp
```

For the chatbot:

```bash
cd chatbot
npm install
npm start
```

Then open `http://localhost:3000`.

The chatbot starts the Python MCP server over stdio on demand. By default it expects
the Python virtual environment at `.venv/bin/python`; override this with
`PYTHON_BIN` or set `MCP_SERVER_PATH` in `chatbot/.env`.

## Tools

- `get_technical_indicators(ticker, period="2y")`
- `get_macro_info()`
- `get_macro_anchors()`
- `analyze_stock(ticker)`
- `recommend_stock(ticker)`

## Live Smoke Tests

The Python smoke tests use real Yahoo/RBA data and are skipped by default:

```bash
RUN_REAL_MARKET_TESTS=1 .venv/bin/python -m pytest
```
