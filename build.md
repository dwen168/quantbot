# QuantBot ASX MCP Server — Implementation Plan

## Overview

A Python-based MCP (Model Context Protocol) server that exposes five tools for analysing
ASX (Australian Securities Exchange) stocks. The server integrates technical analysis,
macro-economic data, and rule-based scoring with an optional LLM-powered narrative summary.
All data sources are free and require no API keys. Built with FastMCP, yfinance, and pandas-ta.

---

## Architecture

```
quantbot/
├── plan.md
├── pyproject.toml               # MCP server: project metadata, dependencies, entry point
├── .env.example                 # Template for optional LLM env vars
├── README.md
├── mcp_server/                  # Python MCP server package
│   ├── __init__.py
│   ├── server.py                # FastMCP app + tool registrations
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── technical.py         # Tool 1: get_technical_indicators
│   │   ├── macro_info.py        # Tool 2: get_macro_info
│   │   ├── macro_anchor.py      # Tool 3: get_macro_anchors
│   │   ├── analysis.py          # Tool 4: analyze_stock
│   │   └── recommendation.py   # Tool 5: recommend_stock
│   ├── models/
│   │   ├── __init__.py
│   │   ├── technical.py         # Pydantic models for technical data
│   │   ├── macro.py             # Pydantic models for macro / anchor data
│   │   └── recommendation.py   # Pydantic models for analysis & recommendation
│   ├── data/
│   │   ├── __init__.py
│   │   ├── yfinance_client.py   # Thin wrapper around yfinance
│   │   ├── rba_client.py        # Fetches RBA cash rate CSV
│   │   └── abs_client.py        # Fetches ABS indicator CSVs
│   └── analysis/
│       ├── __init__.py
│       ├── scoring.py           # Rule-based signal scoring engine
│       └── llm_narrative.py     # LLM narrative — Ollama (default) / OpenAI / Anthropic
└── chatbot/                     # Express.js chatbot frontend
    ├── package.json
    ├── .env.example             # OLLAMA_BASE_URL, OLLAMA_MODEL, MCP_SERVER_PATH, PORT, etc.
    ├── server/
    │   ├── index.js             # Express app entry point
    │   ├── routes/
    │   │   └── chat.js          # POST /api/chat — main conversation endpoint
    │   ├── services/
    │   │   ├── intentRouter.js  # Classifies user message → tool selection
    │   │   ├── mcpClient.js     # MCP stdio client — calls Python MCP server
    │   │   └── llmService.js    # LLM orchestration — Ollama (default), OpenAI, Anthropic
    │   └── utils/
    │       └── chartBuilder.js  # Converts MCP data → dashboard chart/widget descriptors
    └── public/
        ├── index.html           # Single-page app shell
        ├── css/
        │   └── app.css
        └── js/
            ├── app.js           # App bootstrap, layout split
            ├── chat.js          # Chat panel: send/receive, message rendering
            └── dashboard.js     # Dashboard panel: Chart.js + Lightweight Charts + data tables
```

---

## Tool Specifications

### Tool 1 — `get_technical_indicators(ticker, period="2y")`

**Purpose**: Fetch OHLCV data for an ASX stock and compute key technical indicators.

**Input**
| Parameter | Type   | Description                               |
|-----------|--------|-------------------------------------------|
| ticker    | str    | ASX ticker without suffix (e.g. "BHP")   |
| period    | str    | yfinance period string (default "2y")    |

**Output** — `TechnicalIndicators` Pydantic model:
```
symbol           str       e.g. "BHP.AX"
period           str
last_price       float
price_change_pct float     % change over period
moving_averages  MovingAverages
  sma_20         float | None
  sma_50         float | None
  sma_200        float | None
  ema_20         float | None
  ema_50         float | None
momentum         Momentum
  rsi_14         float | None     (0–100)
  macd           float | None
  macd_signal    float | None
  macd_histogram float | None
  stoch_k        float | None
  stoch_d        float | None
volatility       Volatility
  bb_upper       float | None
  bb_middle      float | None
  bb_lower       float | None
  bb_width       float | None
  atr_14         float | None
trend            Trend
  adx_14         float | None
  plus_di        float | None
  minus_di       float | None
  trend_signal   str         "UPTREND" | "DOWNTREND" | "SIDEWAYS"
volume           VolumeData
  obv            float | None
  volume_sma_20  float | None
  volume_ratio   float | None    (current vol / sma vol)
signals          list[str]    human-readable signal strings
price_series     list[TechnicalCandle]
  time           str             ISO date (YYYY-MM-DD)
  open           float | None
  high           float | None
  low            float | None
  close          float | None
  volume         float | None
  sma_20         float | None
  sma_50         float | None
```

**Implementation notes**:
- Append ".AX" to ticker before calling `yf.Ticker`
- Use `ticker.history(period=period)` for OHLCV
- Apply `pandas-ta` via the DataFrame accessor: `df.ta.rsi()`, `df.ta.macd()`, `df.ta.bbands()`, etc.
- Return latest-row indicator snapshot plus 2-year OHLCV+MA20/MA50 series for frontend candlesticks
- Dashboard renders candlestick view as a full-width row (separate from smaller metric cards)
- `signals` field: generate text like "RSI oversold (<30)", "Price above SMA200 — bullish" from computed values

**Data client**: `yfinance_client.py` → `get_ohlcv(ticker_with_suffix, period)`

---

### Tool 2 — `get_macro_info()`

**Purpose**: Return a structured snapshot of macro-economic and geopolitical context
relevant to ASX stocks. All data from free sources.

**Output** — `MacroInfo` Pydantic model:
```
as_of_date        str   (ISO date)
rba_policy        RBAPolicy
  cash_rate           float           latest RBA official cash rate
  rate_direction      str             "HIKING" | "HOLDING" | "CUTTING"
  last_change_date    str | None
  last_change_bps     int | None      basis points of last move
  data_source         str             "RBA A2 Table CSV"

asx_market        ASXMarket
  asx200_level        float
  asx200_1d_change    float
  asx200_1mo_change   float
  asx200_ytd_change   float
  top_sectors         list[SectorPerf]    (code, name, 1d_pct)

currencies        Currencies
  aud_usd             float
  aud_cny             float | None
  aud_usd_1mo_change  float

commodities       Commodities         (key for ASX resource stocks)
  iron_ore_etf_proxy  float | None    use BHP/RIO as proxy if no direct feed
  gold_usd            float           using GC=F
  crude_oil_usd       float           using CL=F
  copper_usd          float           using HG=F
  coal_proxy_ticker   float | None

global_indices    GlobalIndices
  sp500_1d_change     float
  nasdaq_1d_change    float
  shanghai_1d_change  float | None
  hang_seng_1d_change float | None

news_headlines    list[NewsItem]   (up to 10 items from yfinance ASX-related tickers)
  NewsItem:
    title          str
    publisher      str
    published      str   (ISO datetime)
    url            str
    related_ticker str
```

**Implementation notes**:
- RBA cash rate: `pd.read_csv("https://www.rba.gov.au/statistics/tables/csv/a2-data.csv")`, extract latest row
- ASX200: `yf.Ticker("^AXJO").history(period="1mo")`
- Sector ETFs proxy: use a mapping of ASX sector ETF tickers (e.g., VAS, VAP, etc.) via yfinance
- Currencies: `yf.Ticker("AUDUSD=X")`, `yf.Ticker("AUDCNY=X")`
- Commodities: `yf.Ticker("GC=F")` (Gold), `yf.Ticker("CL=F")` (Oil), `yf.Ticker("HG=F")` (Copper)
- News: aggregate `.news` from `yf.Ticker("^AXJO")` and major ASX stocks (BHP.AX, CBA.AX)

**Data clients**: `yfinance_client.py`, `rba_client.py`

---

### Tool 3 — `get_macro_anchors()`

**Purpose**: Return the key structural / long-term macro anchor levels that define the
macro regime for ASX investors (rates environment, inflation, China exposure, risk sentiment).

**Output** — `MacroAnchors` Pydantic model:
```
as_of_date            str

rates_environment     RatesEnv
  rba_cash_rate         float
  au_10y_bond_yield     float | None    use ^IRAUDT or ETF proxy
  yield_curve_slope     float | None    10y minus cash rate
  regime                str             "RESTRICTIVE" | "NEUTRAL" | "ACCOMMODATIVE"

inflation             InflationData
  latest_cpi_yoy        float | None    from ABS release CSV
  latest_trimmed_mean   float | None
  rba_inflation_target  str             "2–3%"
  above_target          bool

growth                GrowthData
  gdp_growth_yoy        float | None    from ABS
  unemployment_rate     float | None    from ABS
  retail_sales_mom      float | None

china_exposure        ChinaExposure
  shanghai_comp_ytd     float | None
  aud_cny_3mo_change    float | None
  iron_ore_proxy_ytd    float | None
  china_signal          str     "POSITIVE" | "NEUTRAL" | "NEGATIVE"

risk_sentiment        RiskSentiment
  vix_level             float           using ^VIX via yfinance
  asx200_volatility_20d float | None
  vix_regime            str             "LOW" (<15) | "NORMAL" (15–25) | "ELEVATED" (25–35) | "EXTREME" (>35)

sector_rotation       SectorRotation
  outperforming_sectors  list[str]
  underperforming_sectors list[str]
  rotation_signal        str     "RISK_ON" | "RISK_OFF" | "MIXED"

summary               str     short text describing the overall macro regime
```

**Implementation notes**:
- ABS data: attempt to fetch latest CPI/GDP/unemployment from ABS CSV releases;
  fall back to `None` with a `data_note` field if unavailable
- VIX: `yf.Ticker("^VIX").history(period="5d")`
- AU 10Y yield: `yf.Ticker("^IRAUDT")` or use bond ETF proxy
- `summary` field: generated programmatically from regime values (not LLM; kept deterministic)

---

### Tool 4 — `analyze_stock(ticker)`

**Purpose**: Synthesise the output of Tools 1, 2, and 3 into a structured stock analysis.
This tool calls `get_technical_indicators`, `get_macro_info`, and `get_macro_anchors`
internally, then runs the rule-based scoring engine.

**Frontend presentation**:
- Research-oriented view for demos: score, score breakdown, positive vs negative signal balance, technical assessment, macro assessment, risk factors, narrative
- Distinct from Tool 5 by focusing on diagnostic process and evidence weighting rather than trade execution

**Input**: `ticker` (str) — ASX ticker without suffix

**Output** — `StockAnalysis` Pydantic model:
```
symbol                str
company_name          str       from yfinance .info
sector                str | None
analysis_date         str

scores                AnalysisScores
  technical_score       int      -100 to +100 (bearish → bullish)
  macro_score           int      -100 to +100
  combined_score        int      weighted average
  signal_count_bullish  int
  signal_count_bearish  int

technical_assessment  TechnicalAssessment
  overall               str      "BULLISH" | "BEARISH" | "NEUTRAL"
  trend_signal          str
  momentum_signal       str
  volatility_signal     str
  volume_signal         str
  key_levels            KeyLevels
    support               float | None
    resistance            float | None
    stop_loss_suggestion  float | None

macro_assessment      MacroAssessment
  overall               str      "FAVORABLE" | "UNFAVORABLE" | "NEUTRAL"
  rates_headwind        bool
  china_tailwind        bool     (relevant for resources/materials)
  commodity_tailwind    bool
  risk_sentiment        str

bullish_signals       list[str]   specific bullish factors found
bearish_signals       list[str]   specific bearish factors found
risk_factors          list[str]   key risks to thesis

narrative             str | None  LLM-generated narrative summary (if LLM configured)
```

**Scoring engine** (`analysis/scoring.py`):
- Technical score: scored from RSI zones, MACD cross, price vs SMA200, ADX strength,
  Bollinger Band position, volume confirmation
- Macro score: scored from rate regime, VIX level, China signal, commodity direction
- Combined: 60% technical + 40% macro weighting
- Each signal adds/subtracts fixed points from the score

**LLM narrative** (`analysis/llm_narrative.py`):
- **Default**: calls local Ollama via `http://localhost:11434/api/chat`; on startup checks
  if `gemma4:e4b` is available via `ollama list` — uses it if present, otherwise falls back
  to the model configured in `OLLAMA_MODEL` env var (default: `gemma4:e4b`)
- **Fallback chain**: Ollama → OpenAI (if `OPENAI_API_KEY` set) → Anthropic (if `ANTHROPIC_API_KEY` set)
- Returns `None` only if all providers fail or are unreachable

---

### Tool 5 — `recommend_stock(ticker)`

**Purpose**: Convert the analysis into an explicit action-oriented trade decision.

**Frontend presentation**:
- Decision-oriented view for demos: action, confidence, time horizon, risk level, entry zone, stop loss, take profit, key reasons, key risks
- Uses the underlying analysis internally but does not mirror the same score cards in the dashboard
- Includes a risk/reward trade-setup chart so recommendation output is visually distinct from Tool 4

**Purpose**: Produce a final buy/sell/hold recommendation by calling `analyze_stock`
internally and applying a decision rule + optional LLM justification.

**Input**: `ticker` (str) — ASX ticker without suffix

**Output** — `Recommendation` Pydantic model:
```
symbol              str
company_name        str
recommendation_date str

action              str         "BUY" | "SELL" | "HOLD"
confidence          int         0–100 (maps from |combined_score|)
time_horizon        str         "SHORT" (days-weeks) | "MEDIUM" (weeks-months) | "LONG" (months+)
risk_level          str         "LOW" | "MEDIUM" | "HIGH"

price_guidance      PriceGuidance
  current_price       float
  entry_range_low     float | None
  entry_range_high    float | None
  stop_loss           float | None
  target_price        float | None
  upside_pct          float | None
  downside_risk_pct   float | None

key_reasons         list[str]   top 3–5 reasons for the recommendation
key_risks           list[str]   top 3 risks to the call

underlying_analysis StockAnalysis   full analysis object embedded

narrative           str | None   LLM-generated narrative recommendation (if configured)
```

**Decision rules** in `tools/recommendation.py`:
| combined_score  | action | confidence          |
|-----------------|--------|---------------------|
| ≥ 40            | BUY    | score mapped 60–100% |
| 15–39           | BUY    | 50–59%              |
| -14 to 14       | HOLD   | 40–50%              |
| -39 to -15      | SELL   | 50–59%              |
| ≤ -40           | SELL   | 60–100%             |

---

## Phase Plan

### Phase 1 — Project Scaffold
1. Create `pyproject.toml` with dependencies:
   `mcp[cli]`, `yfinance`, `pandas`, `pandas-ta`, `pydantic`, `requests`, `httpx`, `python-dotenv`
2. Create `mcp_server/__init__.py` and `server.py` with bare `FastMCP` app
3. Create `.env.example` with optional keys:
   `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
4. Register entry point in `pyproject.toml`: `quantbot-mcp = "mcp_server.server:main"`
   Also set `packages = [{include = "mcp_server"}]` (no `from = "src"` since flat layout)

### Phase 2 — Data Clients (parallel, no inter-dependencies)
5. Implement `data/yfinance_client.py`:
   - `get_ohlcv(ticker_dotax, period) -> pd.DataFrame`
   - `get_info(ticker_dotax) -> dict`
   - `get_news(ticker_dotax, n=10) -> list[dict]`
   - `get_price_series(tickers: list[str], period) -> pd.DataFrame`
6. Implement `data/rba_client.py`:
   - `get_cash_rate() -> dict` (fetch A2 CSV, parse latest rate + direction)
7. Implement `data/abs_client.py`:
   - `get_cpi() -> dict | None`
   - `get_gdp() -> dict | None`
   - `get_unemployment() -> dict | None`
   - All methods return `None` gracefully if CSV unavailable

### Phase 3 — Pydantic Models (depends on Phase 2 specs)
8. Implement `models/technical.py` — all models for Tool 1 output
9. Implement `models/macro.py` — all models for Tool 2 and Tool 3 output
10. Implement `models/recommendation.py` — all models for Tool 4 and Tool 5 output

### Phase 4 — Tool Implementations (depends on Phases 2 & 3)
11. Implement `tools/technical.py` — `get_technical_indicators()` using yfinance + pandas-ta
12. Implement `tools/macro_info.py` — `get_macro_info()` using yfinance + rba_client
13. Implement `tools/macro_anchor.py` — `get_macro_anchors()` using yfinance + rba_client + abs_client
    *(Steps 11, 12, 13 are parallel)*

### Phase 5 — Analysis Engine (depends on Phase 4)
14. Implement `analysis/scoring.py` — rule-based signal scoring functions
15. Implement `analysis/llm_narrative.py` — optional LLM narrative call (OpenAI/Anthropic),
    graceful fallback to `None`
16. Implement `tools/analysis.py` — `analyze_stock()` orchestrating tools 1–3 + scoring engine
17. Implement `tools/recommendation.py` — `recommend_stock()` with decision rules

### Phase 6 — Server Registration & Testing (depends on Phase 5)
18. Register all five tools in `server.py` via `@mcp.tool()` decorators
19. Validate with `mcp dev mcp_server/server.py` (MCP inspector)
20. Write smoke tests for each tool using real tickers: BHP, CBA, RIO, FMG, NAB

---

## Relevant Files to Create

| File | Purpose |
|------|---------|
| `pyproject.toml` | Build config, dependencies, entry point |
| `mcp_server/server.py` | FastMCP app + tool registrations |
| `mcp_server/tools/technical.py` | Tool 1 implementation |
| `mcp_server/tools/macro_info.py` | Tool 2 implementation |
| `mcp_server/tools/macro_anchor.py` | Tool 3 implementation |
| `mcp_server/tools/analysis.py` | Tool 4 implementation |
| `mcp_server/tools/recommendation.py` | Tool 5 implementation |
| `mcp_server/models/technical.py` | Pydantic models — technical |
| `mcp_server/models/macro.py` | Pydantic models — macro |
| `mcp_server/models/recommendation.py` | Pydantic models — analysis & recommendation |
| `mcp_server/data/yfinance_client.py` | yfinance wrapper |
| `mcp_server/data/rba_client.py` | RBA CSV client |
| `mcp_server/data/abs_client.py` | ABS CSV client |
| `mcp_server/analysis/scoring.py` | Rule-based scoring engine |
| `mcp_server/analysis/llm_narrative.py` | Optional LLM narrative |
| `.env.example` | Env var template |

---

## Data Sources Summary

| Data | Source | Method | Requires Key? |
|------|--------|---------|---------------|
| ASX stock OHLCV | Yahoo Finance | `yfinance` `.history()` | No |
| Stock fundamentals & news | Yahoo Finance | `yfinance` `.info`, `.news` | No |
| ASX200 index | Yahoo Finance `^AXJO` | `yfinance` | No |
| AUD/USD | Yahoo Finance `AUDUSD=X` | `yfinance` | No |
| Gold / Oil / Copper futures | Yahoo Finance `GC=F`, `CL=F`, `HG=F` | `yfinance` | No |
| VIX | Yahoo Finance `^VIX` | `yfinance` | No |
| RBA cash rate | RBA A2 CSV | `requests` + `pandas.read_csv` | No |
| CPI / GDP / Unemployment | ABS CSV releases | `requests` + `pandas.read_csv` | No |
| LLM narrative (optional) | OpenAI / Anthropic | API call | Optional env var |

---

## Verification Steps

1. `pip install -e ".[dev]"` — confirm clean install
2. `mcp dev mcp_server/server.py` — open MCP inspector, confirm all 5 tools listed with correct schemas
3. Call `get_technical_indicators("BHP", "3mo")` — verify all indicator fields populated, no NaN leakage
4. Call `get_macro_info()` — verify RBA cash rate matches published value at rba.gov.au
5. Call `get_macro_anchors()` — verify VIX, AUD/USD, yield curve fields are present
6. Call `analyze_stock("CBA")` — verify `combined_score` is within -100 to +100, signals lists non-empty
7. Call `recommend_stock("RIO")` — verify `action` is one of BUY/SELL/HOLD, `confidence` % is plausible
8. Set `OPENAI_API_KEY` in `.env` and re-call `recommend_stock("FMG")` — verify `narrative` field populated
9. Test graceful degradation: run with no network and confirm tools return partial results with error fields, not crashes

---

## Decisions & Scope

- **In scope**: 5 tools as specified, ASX stocks only (.AX suffix), free data sources
- **Out of scope**: Portfolio-level analysis, backtesting, order execution, authentication
- **LLM narrative**: opt-in via env vars; server runs fully without any LLM key
- **ABS data**: best-effort; tools return `None` for ABS fields rather than failing if CSV unavailable
- **Sector ETF proxies**: use XJO sector sub-indices via yfinance where available
- **ASX ticker format**: user supplies ticker WITHOUT ".AX" suffix; server appends it internally

---

## Further Considerations

1. **Rate limiting**: yfinance may throttle rapid calls. `analyze_stock` and `recommend_stock`
   call multiple tools internally — consider caching results per ticker per session using
   `functools.lru_cache` or a simple in-memory dict with TTL.

2. **ABS CSV link stability**: ABS release CSV URLs change with each release. The `abs_client`
   should target a stable entry-point URL and follow redirects or links to the latest release,
   or fall back to hardcoded recent values with a `stale_data_warning` flag.

3. **MCP client config**: To connect this server to Claude Desktop, add to `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "quantbot": {
         "command": "uvx",
         "args": ["--from", "/path/to/quantbot", "quantbot-mcp"]
       }
     }
   }
   ```
   The CLI command `quantbot-mcp` stays the same; `uvx` resolves it via the entry point
   `mcp_server.server:main` declared in `pyproject.toml`.

---

---

# Part 2 — Chatbot Frontend (Express.js + Node.js)

## Overview

A web-based chatbot application that sits in front of the MCP server. Users type natural-language
questions; the Express backend classifies intent, calls the appropriate MCP tool, and returns
both a text answer (rendered in the chat panel) and structured data (rendered as charts/tables
in the dashboard panel). The UI is a single-page app split into two panes — no framework required
(vanilla JS + Chart.js + Lightweight Charts), keeping the dependency surface minimal.

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  QuantBot  [ASX Stock Intelligence]                              │
├─────────────────────────┬────────────────────────────────────────┤
│                         │                                        │
│   CHAT PANEL            │   DASHBOARD PANEL                      │
│                         │                                        │
│  ┌─ user ─────────────┐ │  ┌─ full-width: 2Y Candlestick ─────┐ │
│  │ Tell me about CBA  │ │  │  K-line + MA20 + MA50            │ │
│  └────────────────────┘ │  └──────────────────────────────────┘ │
│  ┌─ bot ──────────────┐ │  ┌─ card: Stock Snapshot ───────────┐ │
│  │ CBA.AX — last      │ │  │  Price | RSI | ADX | Trend      │ │
│  │ price $XX.XX ...   │ │  └──────────────────────────────────┘ │
│  └────────────────────┘ │  ┌─ card: Tool-Specific View ───────┐ │
│                         │  │  Research View / Execution View  │ │
│  [Type a question...]   │  └──────────────────────────────────┘ │
└─────────────────────────┴────────────────────────────────────────┘
```

- **Left pane (40%)**: Chat history + input box. Bot messages include a summary sentence
  and key bullet points. Each message is tagged with the tool(s) that were called.
- **Right pane (60%)**: Dashboard that re-renders on every bot response. Content depends
  on the tool called (see Dashboard Widgets below).

---

## Request / Response Flow

```
User types message
      │
      ▼
POST /api/chat  (Express)
      │
      ▼
intentRouter.js  ─── classifies message into one of:
      │               STOCK_QUERY | MACRO_INFO | MACRO_ANCHOR |
      │               ANALYSIS | RECOMMENDATION | UNKNOWN
      ▼
mcpClient.js  ─── spawns / communicates with Python MCP server via stdio
      │            calls the mapped tool with extracted params
      ▼
MCP Server returns structured JSON
      │
      ▼
llmService.js (optional) ─── calls Ollama (default) or cloud LLM to generate narrative
  │                         model selected by user in UI; passed in POST body as `model`
      │
      ▼
chartBuilder.js ─── converts structured data → dashboard chart/widget descriptors
      │
      ▼
Response to browser:
  {
    "message":   string,           // text for chat panel
    "tool":      string,           // which tool was called
    "rawData":   object,           // full MCP tool response
    "charts":    ChartDescriptor[], // Chart.js or Lightweight Charts descriptors
    "widgets":   WidgetData[]      // key/value cards for dashboard
  }
      │
      ▼
Browser:
  chat.js    → appends bot message to chat history
  dashboard.js → renders charts + widgets in right pane
```

---

## Intent Router (`server/services/intentRouter.js`)

Classifies free-text user input to a tool + extracted parameters. Two-tier approach:

**Tier 1 — Regex / keyword matching** (fast, no LLM cost):
| Pattern | Intent | Extracted params |
|---------|--------|-----------------|
| ticker mentioned (e.g. "CBA", "BHP") + "price\|chart\|technical\|indicator\|52 week\|P/E" | `STOCK_QUERY` | `{ ticker }` |
| "geopolit\|trade war\|tariff\|interest rate\|RBA\|inflation\|macro\|news" | `MACRO_INFO` | `{}` |
| "anchor\|regime\|CPI\|GDP\|unemployment\|yield curve\|risk" | `MACRO_ANCHOR` | `{}` |
| ticker + "analyze\|analyse\|analysis\|assess\|score\|signal\|bullish\|bearish" | `ANALYSIS` | `{ ticker }` |
| ticker + "recommend\|buy\|sell\|hold\|should I" | `RECOMMENDATION` | `{ ticker }` |

**Tier 2 — LLM fallback** (if Tier 1 returns `UNKNOWN`):
- Calls local Ollama by default (`OLLAMA_BASE_URL` + `OLLAMA_MODEL`) with a short
  system prompt asking it to return JSON: `{ "intent": "...", "ticker": "..." }`
- Falls back to OpenAI / Anthropic if Ollama is unreachable and a key is configured
- Used only when regex matching fails

**Ticker extraction**: scan for 2–5 uppercase letter sequences (ASX ticker format);
cross-reference against a bundled list of top-200 ASX tickers to avoid false positives.

---

## MCP Client (`server/services/mcpClient.js`)

The Express server communicates with the Python MCP server using **stdio transport**
(the MCP SDK default for local servers). The client:

1. On first call, spawns the Python process: `python3 -m mcp_server.server`
  with `MCP_SERVER_PATH` as the working directory
2. Uses the `@modelcontextprotocol/sdk` npm package to open a `StdioClientTransport`
   and `Client` instance
3. Exposes a single async function:
   ```js
   async function callTool(toolName, params) -> object
   ```
4. Handles reconnection if the Python process exits unexpectedly

**Intent → Tool mapping**:
| Intent | MCP Tool called | Default params if not extracted |
|--------|----------------|---------------------------------|
| `STOCK_QUERY` | `get_technical_indicators` | `period: "2y"` |
| `MACRO_INFO` | `get_macro_info` | — |
| `MACRO_ANCHOR` | `get_macro_anchors` | — |
| `ANALYSIS` | `analyze_stock` | — |
| `RECOMMENDATION` | `recommend_stock` | — |

Note: `STOCK_QUERY` calls `get_technical_indicators` with `period="2y"` by default so
the response includes 2 years of OHLCV-derived price history suitable for a full-width
candlestick chart with MA20 and MA50 overlays.

---

## Chart Builder (`server/utils/chartBuilder.js`)

Converts MCP structured data into dashboard chart/widget descriptors sent to the browser.
Most charts use Chart.js v4; the stock candlestick view uses Lightweight Charts.

### STOCK_QUERY charts (from `get_technical_indicators` response)

| Widget / Chart | Type | Data fields used |
|----------------|------|-----------------|
| 2Y Price Action chart | `candlestick` (full-width) | `price_series[].open/high/low/close`, `sma_20`, `sma_50` |
| Stock Snapshot card | key-value | `last_price`, `price_change_pct`, `symbol`, `rsi_14`, `adx_14`, `trend_signal`, `volume_ratio` |
| Moving Averages vs Current Price | `bar` | `last_price`, `sma_20`, `sma_50`, `sma_200`, `ema_20`, `ema_50` |
| Technical Indicators card | key-value grid | MACD, MACD signal/histogram, stochastic, Bollinger width, ATR, DI values |
| Bollinger Bands card | key-value | `bb_upper`, `bb_middle`, `bb_lower`, `last_price` |
| Technical Signals list | signals | `signals[]` |

### MACRO_INFO charts (from `get_macro_info` response)

| Widget / Chart | Type | Data fields used |
|----------------|------|-----------------|
| RBA Policy card | key-value | `cash_rate`, `rate_direction`, `last_change_date` |
| ASX200 card | key-value + mini sparkline | `asx200_level`, `asx200_1d_change`, `asx200_ytd_change` |
| Currency & Commodity table | table | `aud_usd`, `gold_usd`, `crude_oil_usd`, `copper_usd` |
| Global indices bar chart | `bar` (horizontal) | `sp500_1d_change`, `nasdaq_1d_change`, `shanghai_1d_change`, `hang_seng_1d_change` |
| News feed list | HTML list | `news_headlines` — title, publisher, datetime, link |

### MACRO_ANCHOR charts (from `get_macro_anchors` response)

| Widget / Chart | Type | Data fields used |
|----------------|------|-----------------|
| Macro Regime card | key-value + badge | `regime`, `vix_regime`, `rotation_signal`, `summary` |
| Rate environment gauge | `doughnut` (custom) | `rba_cash_rate`, `au_10y_bond_yield`, `yield_curve_slope` |
| Inflation card | key-value | `latest_cpi_yoy`, `rba_inflation_target`, `above_target` |
| China exposure card | key-value + signal badge | `china_signal`, `shanghai_comp_ytd`, `aud_cny_3mo_change` |
| Sector rotation bar chart | `bar` | `outperforming_sectors` vs `underperforming_sectors` |

### ANALYSIS charts (from `analyze_stock` response)

| Widget / Chart | Type | Data fields used |
|----------------|------|-----------------|
| Research View banner | full-width banner | demo-only view label for Tool 4 |
| Analysis Process card | key-value | positive count, negative count, technical score, macro score, combined score |
| Score gauge | `doughnut` (semi) | `combined_score` (-100 → +100), `technical_score`, `macro_score` |
| Positive vs Negative Signal Balance | `bar` | `bullish_signals.length`, `bearish_signals.length` |
| Score Breakdown | `bar` | `technical_score`, `macro_score`, `combined_score` |
| Technical Assessment card | badge grid | `overall`, `trend_signal`, `momentum_signal`, `volatility_signal`, `volume_signal`, `support`, `resistance`, `stop_loss_suggestion` |
| Macro Assessment card | badge grid | `overall`, `rates_headwind`, `china_tailwind`, `commodity_tailwind`, `risk_sentiment` |
| Bullish Signals list | signals | `bullish_signals[]` |
| Negative Drivers list | signals | `bearish_signals[]` |
| Risk Factors To Monitor | signals | `risk_factors[]` |
| Analysis Summary | styled text | `narrative` (if present) |

### RECOMMENDATION charts (from `recommend_stock` response)

| Widget / Chart | Type | Data fields used |
|----------------|------|-----------------|
| Execution View banner | full-width banner | demo-only view label for Tool 5 |
| Recommendation Summary | key-value | `action`, `confidence`, `time_horizon`, `risk_level`, `underlying_analysis.scores.combined_score` |
| Recommendation hero card | large badge (BUY/SELL/HOLD) | `action`, `confidence`, `risk_level`, `time_horizon` |
| Execution Plan | key-value | `current_price`, `entry_range_low/high`, `stop_loss`, `target_price`, `upside_pct`, `downside_risk_pct` |
| Trade Setup Risk / Reward | `bar` | `upside_pct`, `downside_risk_pct` |
| Key Reasons list | signals | `key_reasons[]` |
| Key Risks list | signals | `key_risks[]` |
| Recommendation Summary text | styled text | `narrative` (if present) |

---

## API Specification

### `POST /api/chat`

**Request body**:
```json
{
  "message": "Should I buy CBA?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response body**:
```json
{
  "message": "Based on current analysis, CBA.AX shows...",
  "tool": "recommend_stock",
  "params": { "ticker": "CBA" },
  "rawData": { ... },
  "charts": [
    {
      "id": "risk-reward-chart",
      "type": "bar",
      "config": { ... }
    }
  ],
  "widgets": [
    { "id": "recommendation-view-banner", "type": "banner", "text": "..." },
    { "id": "price-guidance", "type": "kv", "rows": [...] }
  ]
}
```

**Error response** (non-2xx):
```json
{
  "error": "Could not resolve ticker from your message. Please include an ASX ticker (e.g. BHP, CBA).",
  "code": "TICKER_NOT_FOUND"
}
```

---

## Frontend Modules

### `public/js/chat.js`
- Maintains in-memory `history[]` (last 20 turns) sent with each request
- On submit: appends user bubble, sends `POST /api/chat`, appends bot bubble
- Bot bubble: renders `message` as markdown (marked.js), shows tool badge
- Typing indicator shown while awaiting response
- On error: displays inline error message in chat
- **Model selector**: dropdown in the chat header listing available Ollama models
  (fetched on load from `GET /api/models`); the dropdown pre-selects `gemma4:e4b` if it
  appears in the list, otherwise defaults to the first available model. Selected model
  sent with each request as `{ model: "gemma4:e4b" }` in the request body. Falls back to
  the server `OLLAMA_MODEL` env var default if the list is empty.

### `public/js/dashboard.js`
- Exports a single `render(response)` function called by `chat.js` on each bot response
- Clears previous dashboard content, renders new widgets/charts based on `response.tool`
- Chart instances stored in a map; destroyed before re-creating to avoid Canvas leaks
- Renders tool-specific full-width banners so Tool 4 and Tool 5 are visually distinct in demos
- Full-width priority charts render first (used for the stock candlestick panel)
- Uses Lightweight Charts for `candlestick` chart types and Chart.js for bar/doughnut charts

### `public/js/app.js`
- Initialises the split-pane layout (CSS Grid, resizable via drag handle)
- Wires up chat.js and dashboard.js
- Handles dark/light theme toggle (stored in localStorage)

---

## Dependencies (`chatbot/package.json`)

```json
{
  "dependencies": {
    "express": "^4.18",
    "@modelcontextprotocol/sdk": "latest",
    "ollama": "^0.5",
    "openai": "^4",
    "dotenv": "^16",
    "marked": "^12"
  },
  "devDependencies": {
    "nodemon": "^3"
  }
}
```

Browser-side (loaded via CDN, no bundler needed):
- `chart.js` v4
- `chartjs-plugin-annotation`
- `lightweight-charts`
- `marked` (markdown rendering for bot messages)

---

## Chatbot Phase Plan

### Phase 7 — Express Scaffold
21. `npm init` in `chatbot/`, install dependencies
22. Create `server/index.js` — Express app, static file serving, `/api/chat` route mount
23. Create `public/index.html` — split-pane shell with chat + dashboard placeholders
24. Create `public/css/app.css` — layout, chat bubbles, dashboard cards, dark theme

### Phase 8 — MCP Client & Intent Router
25. Implement `server/services/mcpClient.js`:
    - Spawn Python MCP server via `StdioClientTransport`
    - `callTool(name, params)` async wrapper
    - Graceful reconnect on process exit
26. Implement `server/services/intentRouter.js`:
    - Regex/keyword tier
    - ASX ticker extractor with top-200 ticker list
    - Optional LLM fallback (if `OPENAI_API_KEY` present)

### Phase 9 — Chat API & LLM Service
27. Implement `server/routes/chat.js`:
    - Validates request, calls intentRouter → mcpClient → chartBuilder
    - Formats `message` string from raw MCP data
    - Returns standardised response shape
28. Implement `server/services/llmService.js`:
    - On startup: call `ollama list`, prefer `gemma4:e4b` if present, otherwise use `OLLAMA_MODEL`
    - Accept `model` param from request body to override (user-selected in UI)
    - `GET /api/models` endpoint: proxy `ollama list` to return available local models
    - Fallback to OpenAI / Anthropic if Ollama unreachable and keys are present
    - Fallback to template-based string if all LLM providers fail

### Phase 10 — Chart Builder
29. Implement `server/utils/chartBuilder.js`:
    - One function per tool: `buildStockCharts()`, `buildMacroInfoCharts()`, etc.
  - Each returns `{ charts: [], widgets: [] }` using dashboard chart/widget descriptors

### Phase 11 — Frontend JS
30. Implement `public/js/chat.js` — message send/receive, markdown rendering, history
31. Implement `public/js/dashboard.js` — Chart.js + Lightweight Charts rendering, widget cards, chart lifecycle
32. Implement `public/js/app.js` — layout, theme, wiring

### Phase 12 — Integration & Smoke Tests
33. Start both servers: `python3 -m mcp_server.server` + `node chatbot/server/index.js`
34. Manual test: "Tell me about CBA" → verify stock charts appear in dashboard
35. Manual test: "What's the geopolitical situation?" → verify macro info dashboard
36. Manual test: "Should I buy FMG?" → verify execution view banner + recommendation hero + execution plan
37. Manual test: ambiguous input → verify graceful error message in chat panel

---

## Environment Variables (`chatbot/.env.example`)

```
PORT=3000
MCP_SERVER_PATH=/Users/wenj1/mycode/quantbot   # path to quantbot project root
OLLAMA_BASE_URL=http://localhost:11434           # local Ollama server (default)
OLLAMA_MODEL=gemma4:e4b                          # preferred default; auto-detected if installed, user can override in UI
OPENAI_API_KEY=                                  # optional cloud fallback
ANTHROPIC_API_KEY=                               # optional cloud fallback
```

---

## Chatbot Decisions & Scope

- **No framework**: vanilla HTML/CSS/JS on the frontend — avoids build toolchain complexity
- **No auth**: single-user local tool; no login, no sessions (stateless per request + client-side history)
- **Chart.js + Lightweight Charts**: Chart.js handles standard dashboard charts; Lightweight Charts handles the professional candlestick view
- **Stdio transport**: MCP client communicates with Python process over stdio — no separate HTTP port needed for MCP
- **Markdown rendering**: bot messages support basic markdown (bold, lists) via marked.js
- **No WebSocket**: polling-free; each chat turn is a single `POST /api/chat` request/response cycle
- **History**: last 20 turns kept in browser memory; sent with each request for context (not stored server-side)
- **LLM default — Ollama**: local Ollama is the default LLM provider (no API key required, fully private).
  Cloud providers (OpenAI, Anthropic) are optional fallbacks configured via env vars.
- **Model selection**: `GET /api/models` returns the list of locally installed Ollama models;
  the chat header renders a `<select>` dropdown populated from this list. The selected model
  is sent as `model` in the `POST /api/chat` body and forwarded to `llmService.js`.
  Server default (`OLLAMA_MODEL`) is used when no model is selected or if the list is empty.
