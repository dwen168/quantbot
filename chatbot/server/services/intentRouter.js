import { preferredModel, listModels } from "./llmService.js";

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
  "MACD", "MACRO", "CONTEXT", "INFO", "LIST", "NEWS", "HELP", "WORK"
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

/**
 * Validates a ticker by checking if it exists on ASX via yfinance.
 * This is a lightweight check using the ticker info.
 */
async function validateTicker(ticker) {
  if (!ticker) return false;
  return true; // Placeholder: structural change first.
}

async function getIntentWithLLM(message) {
  const systemPrompt = `You are a classifier for an ASX stock research chatbot.
Classify the user message into one of these intents:
- RECOMMENDATION: Actionable trade advice, signals, or "buy/sell/hold" questions for a specific ticker (e.g., "should I buy BHP?", "give me a recommendation for XRO", "trade signals for CBA").
- ANALYSIS: In-depth research, scoring, or assessment of a stock without asking for a direct trade action (e.g., "analyze MSB", "research for RIO", "stock assessment for FMG").
- STOCK_QUERY: Raw technical data, prices, or charts (e.g., "price of BHP", "show me CBA chart", "technicals for TLS").
- MARKET_SNAPSHOT: General market pulse, interest rates, news, commodities, or currencies (e.g., "market today?", "rba rates", "gold price").
- MACRO_REGIME: Structural economic context and anchors (e.g., "macro regime", "inflation data", "GDP and unemployment").
- UNKNOWN: General chat or unrecognised requests.

Return JSON with "ticker" (2-5 letter symbol or null) and "intent".`;

  const tryParseResult = (content) => {
    try {
      const parsed = JSON.parse(content || "{}");
      const raw = parsed.ticker ? String(parsed.ticker).toUpperCase().replace(/\.AX$/i, "").trim() : null;
      // Accept any 2–5 letter ticker the LLM returns, NOT in exclusions
      const ticker = (raw && /^[A-Z]{2,5}[0-9]?[A-Z]?$/.test(raw) && !EXCLUSIONS.has(raw)) ? raw : null;
      
      let intent = parsed.intent || INTENTS.UNKNOWN;
      // Cross-validation: if intent involves a ticker but no ticker found, downgrade or switch
      if ([INTENTS.STOCK_QUERY, INTENTS.ANALYSIS, INTENTS.RECOMMENDATION].includes(intent) && !ticker) {
        if (/\b(macro|economy|market|news|interest rate|rba)\b/i.test(message)) {
          intent = INTENTS.MARKET_SNAPSHOT;
        } else {
          intent = INTENTS.UNKNOWN;
        }
      }

      return { intent, params: ticker ? { ticker } : {} };
    } catch {
      return { intent: INTENTS.UNKNOWN, params: {} };
    }
  };

  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      });
      return tryParseResult(completion.choices[0]?.message?.content);
    } catch {
      return { intent: INTENTS.UNKNOWN, params: {} };
    }
  } else {
    const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
    try {
      const targetModel = await preferredModel();
      const models = await listModels();
      const modelsToTry = [targetModel, ...models.filter(m => m !== targetModel)];

      for (const model of modelsToTry) {
        if (!model) continue;
        try {
          const response = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              stream: false,
              format: "json",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
              ]
            })
          });
          if (response.ok) {
            const data = await response.json();
            return tryParseResult(data.message?.content);
          }
        } catch {
          continue;
        }
      }
      return { intent: INTENTS.UNKNOWN, params: {} };
    } catch (e) {
      console.error("Ollama fallback failed:", e);
      return { intent: INTENTS.UNKNOWN, params: {} };
    }
  }
}

export async function routeIntent(message) {
  const text = String(message || "");

  const finalizeResult = (result) => {
    return result;
  };

  // 1. Primary: Use LLM to understand intent and ticker contextually
  try {
    const llmResult = await getIntentWithLLM(text);
    if (llmResult.intent !== INTENTS.UNKNOWN) {
      // Add default parameters if missing
      if (llmResult.intent === INTENTS.STOCK_QUERY && llmResult.params.ticker && !llmResult.params.period) {
        llmResult.params.period = "2y";
      }
      return finalizeResult(llmResult);
    }
  } catch (err) {
    console.error("LLM intent routing failed, falling back to heuristics:", err);
  }

  // 2. Secondary: Fast-path / Heuristic fallback if LLM is unsure or offline
  const lower = text.toLowerCase();
  
  // Prioritize Macro Keywords before Ticker Extraction in fallback
  if (/\b(regime|cpi|gdp|unemployment|yield curve|risk sentiment|macro regime|anchors)\b/i.test(text)) {
    return { intent: INTENTS.MACRO_REGIME, params: {} };
  }
  if (/\b(geopolit|trade war|tariff|interest rate|rates|rba|inflation|macro|news|commodit|currency|context|snapshot)\b/i.test(text)) {
    return { intent: INTENTS.MARKET_SNAPSHOT, params: {} };
  }

  const ticker = extractTicker(text);
  // RECOMMENDATION: Strong trade-action keywords
  if (ticker && /\b(recommend|buy|sell|hold|should i|shall i|trade|signal|target|stop loss|is .* buy)\b/i.test(text)) {
    return finalizeResult({ intent: INTENTS.RECOMMENDATION, params: { ticker } });
  }
  // ANALYSIS: Deep research or assessment keywords
  if (ticker && /\b(analy[sz]e|analysis|assess|score|research|evaluate|rating)\b/i.test(text)) {
    return finalizeResult({ intent: INTENTS.ANALYSIS, params: { ticker } });
  }
  // STOCK_QUERY: Raw data, charts, or indicators
  if (ticker && /\b(price|chart|technical|indicator|52 week|p\/e|pe|rsi|macd|trend|volume|tell me)\b/i.test(lower)) {
    return finalizeResult({ intent: INTENTS.STOCK_QUERY, params: { ticker, period: "2y" } });
  }
  if (ticker) {
    return finalizeResult({ intent: INTENTS.STOCK_QUERY, params: { ticker, period: "2y" } });
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
