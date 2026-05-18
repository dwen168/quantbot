import { generateJsonCompletion } from "./llmService.js";

// Common words to exclude from ticker extraction (they look like tickers but aren't)
const EXCLUSIONS = new Set([
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER", "WAS",
  "ONE", "OUR", "OUT", "HIS", "ITS", "WHO", "USE", "HOW", "DID", "NOW", "OLD",
  "NEW", "WAY", "MAY", "SAY", "ASK", "SET", "PUT", "LET", "SEE", "ASX", "ETF",
  "CEO", "CFO", "IPO", "LLM", "API", "USD", "AUD", "RBA", "GDP", "CPI", "FED",
  "BPS", "ATR", "RSI", "EMA", "SMA", "ADX", "MACD", "HOLD", "BUY", "SELL",
  "TELL", "WHAT", "WHEN", "WHY", "WHO", "FROM", "THAT", "THIS", "WITH", "INTO",
  "TRADE", "STOCK", "SHARE", "PRICE", "CHART", "SHOW", "GIVE", "VIEW", "CHECK",
  "SHOULD", "COULD", "WOULD", "THINK", "ABOUT", "EVERY", "RECOM", "SCORE",
  "MACD", "MACRO", "CONTEXT", "INFO", "LIST", "NEWS", "HELP", "WORK",
  "TODAY", "DAY", "WEEK", "MONTH", "YEAR", "TIME", "LOOK", "GOOD", "BAD",
  "HIGH", "LOW", "LAST", "NEXT", "VERY", "MUCH", "SOME", "MANY", "MOST",
  "AM", "IS", "IT", "IF", "ON", "OR", "SO", "UP", "DO", "GO", "MY", "ME", "BE", "BY", "AT", "AN", "AS"
]);

const INTENTS = {
  STOCK_QUERY: "STOCK_QUERY",
  MARKET_SNAPSHOT: "MARKET_SNAPSHOT",
  MACRO_REGIME: "MACRO_REGIME",
  ANALYSIS: "ANALYSIS",
  RECOMMENDATION: "RECOMMENDATION",
  INVALID_TICKER: "INVALID_TICKER",
  UNKNOWN: "UNKNOWN"
};

function extractTicker(message) {
  // Match 2–5 uppercase letter sequences that look like ASX tickers
  const candidates = message.toUpperCase().match(/\b[A-Z]{2,5}\b/g) || [];
  // Reverse search: typically tickers are at the end of a question/phrase
  return candidates.reverse().find((c) => !EXCLUSIONS.has(c)) || null;
}

async function getIntentWithLLM(message, provider, model) {
  const systemPrompt = `You are a classifier for an ASX stock research chatbot.
Classify the user message into one of these intents:
- RECOMMENDATION: Actionable trade advice, signals, or "buy/sell/hold" questions for a specific ticker.
- ANALYSIS: In-depth research, scoring, or assessment of a stock.
- STOCK_QUERY: Raw technical data, prices, or charts.
- MARKET_SNAPSHOT: General market pulse, status, "how is the market", interest rates, news, commodities.
- MACRO_REGIME: Structural economic context, inflation, GDP.
- UNKNOWN: General chat or unrecognised requests.

Return JSON with "ticker" (2-5 letter symbol or null) and "intent".`;

  try {
    const content = await generateJsonCompletion({
      prompt: message,
      systemInstruction: systemPrompt,
      provider,
      model
    });

    if (!content) return { intent: INTENTS.UNKNOWN, params: {} };

    const parsed = JSON.parse(content);
    const raw = parsed.ticker ? String(parsed.ticker).toUpperCase().replace(/\.AX$/i, "").trim() : null;
    const ticker = (raw && /^[A-Z]{2,5}[0-9]?[A-Z]?$/.test(raw) && !EXCLUSIONS.has(raw)) ? raw : null;
    
    let intent = parsed.intent || INTENTS.UNKNOWN;
    
    // Explicitly catch "market" or "how is the..." for MARKET_SNAPSHOT if LLM is vague
    if (intent === INTENTS.UNKNOWN || (intent === INTENTS.STOCK_QUERY && !ticker)) {
      if (/\b(market|status|today|how is|news|snapshot)\b/i.test(message)) {
        intent = INTENTS.MARKET_SNAPSHOT;
      }
    }

    return { intent, params: ticker ? { ticker } : {} };
  } catch (e) {
    console.error("LLM intent routing failed:", e);
    return { intent: INTENTS.UNKNOWN, params: {} };
  }
}

export async function routeIntent(message, provider, model) {
  const text = String(message || "");
  const lower = text.toLowerCase();

  // 1. FAST PATH: Check for unambiguous global intent keywords FIRST
  // This prevents words like "IS" or "TODAY" from being caught by ticker logic
  if (/\b(macro regime|macro anchors|yield curve|risk sentiment|inflation|cpi|gdp)\b/i.test(lower)) {
    return { intent: INTENTS.MACRO_REGIME, params: {} };
  }
  
  if (/\b(market snapshot|market status|market today|how is the market|market news|market context)\b/i.test(lower)) {
    return { intent: INTENTS.MARKET_SNAPSHOT, params: {} };
  }

  // 2. PRIMARY: Use LLM to understand intent and ticker contextually
  try {
    const llmResult = await getIntentWithLLM(text, provider, model);
    if (llmResult.intent !== INTENTS.UNKNOWN) {
      if (llmResult.intent === INTENTS.STOCK_QUERY && llmResult.params.ticker && !llmResult.params.period) {
        llmResult.params.period = "2y";
      }
      return llmResult;
    }
  } catch (err) {
    console.error("LLM intent routing failed, falling back to heuristics:", err);
  }

  // 3. HEURISTICS: Fallback logic
  if (/\b(regime|macro|economy|anchors|snapshot|market|news|interest rate|rba|inflation|rates)\b/i.test(lower)) {
    if (/\b(regime|macro|anchors)\b/i.test(lower)) return { intent: INTENTS.MACRO_REGIME, params: {} };
    return { intent: INTENTS.MARKET_SNAPSHOT, params: {} };
  }

  const ticker = extractTicker(text);
  if (ticker) {
    if (/\b(recommend|buy|sell|hold|should i|trade|signal|target|stop)\b/i.test(lower)) {
      return { intent: INTENTS.RECOMMENDATION, params: { ticker } };
    }
    if (/\b(analy[sz]e|analysis|assess|score|research|evaluate|rating)\b/i.test(lower)) {
      return { intent: INTENTS.ANALYSIS, params: { ticker } };
    }
    return { intent: INTENTS.STOCK_QUERY, params: { ticker, period: "2y" } };
  }

  return { intent: INTENTS.UNKNOWN, params: {} };
}

export function toolForIntent(intent) {
  return {
    [INTENTS.STOCK_QUERY]: "get_technical_indicators",
    [INTENTS.MARKET_SNAPSHOT]: "get_market_snapshot",
    [INTENTS.MACRO_REGIME]: "get_macro_regime",
    [INTENTS.ANALYSIS]: "analyze_stock",
    [INTENTS.RECOMMENDATION]: "recommend_stock"
  }[intent] || null;
}

export { INTENTS, extractTicker };
