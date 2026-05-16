import { preferredModel, listModels } from "./llmService.js";

// Common words to exclude from ticker extraction (they look like tickers but aren't)
const EXCLUSIONS = new Set([
  "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER", "WAS",
  "ONE", "OUR", "OUT", "HIS", "ITS", "WHO", "USE", "HOW", "DID", "NOW", "OLD",
  "NEW", "WAY", "MAY", "SAY", "ASK", "SET", "PUT", "LET", "SEE", "ASX", "ETF",
  "CEO", "CFO", "IPO", "LLM", "API", "USD", "AUD", "RBA", "GDP", "CPI", "FED",
  "BPS", "ATR", "RSI", "EMA", "SMA", "ADX", "MACD", "HOLD", "BUY", "SELL",
  "TELL", "WHAT", "WHEN", "WHY", "WHO", "FROM", "THAT", "THIS", "WITH", "INTO"
]);

const INTENTS = {
  STOCK_QUERY: "STOCK_QUERY",
  MACRO_INFO: "MACRO_INFO",
  MACRO_ANCHOR: "MACRO_ANCHOR",
  ANALYSIS: "ANALYSIS",
  RECOMMENDATION: "RECOMMENDATION",
  UNKNOWN: "UNKNOWN"
};

function extractTicker(message) {
  // Match 2–5 uppercase letter sequences that look like ASX tickers
  const candidates = message.toUpperCase().match(/\b[A-Z]{2,5}\b/g) || [];
  return candidates.find((c) => !EXCLUSIONS.has(c)) || null;
}

async function llmFallback(message) {
  const systemPrompt = `You are a classifier for an ASX stock research chatbot.
Given the user message, return ONLY a JSON object with:
- "intent": one of STOCK_QUERY, MACRO_INFO, MACRO_ANCHOR, ANALYSIS, RECOMMENDATION, UNKNOWN
- "ticker": the ASX ticker symbol if mentioned (e.g. BHP, MSB, A2M, XRO), or null

Examples of tickers: BHP, CBA, RIO, MSB, CSL, A2M, XRO, PLS
Return JSON only, no explanation.`;

  const tryParseResult = (content) => {
    try {
      const parsed = JSON.parse(content || "{}");
      const raw = parsed.ticker ? String(parsed.ticker).toUpperCase().replace(/\.AX$/i, "").trim() : null;
      // Accept any 2–5 letter ticker the LLM returns, not filtered by whitelist
      const ticker = (raw && /^[A-Z]{1,5}[0-9]?[A-Z]?$/.test(raw) && !EXCLUSIONS.has(raw)) ? raw : null;
      return { intent: parsed.intent || INTENTS.UNKNOWN, params: ticker ? { ticker } : {} };
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
  const lower = text.toLowerCase();
  const ticker = extractTicker(text);

  if (/\b(anchor|regime|cpi|gdp|unemployment|yield curve|risk sentiment|macro context|macro anchor|anchors)\b/i.test(text)) {
    return { intent: INTENTS.MACRO_ANCHOR, params: {} };
  }
  if (/\b(geopolit|trade war|tariff|interest rate|rates|rba|inflation|macro|news|commodit|currency|context)\b/i.test(text)) {
    return { intent: INTENTS.MACRO_INFO, params: {} };
  }
  if (ticker && /\b(recommend|buy|sell|hold|should i|trade|target|stop loss)\b/i.test(text)) {
    return { intent: INTENTS.RECOMMENDATION, params: { ticker } };
  }
  if (ticker && /\b(analy[sz]e|analysis|assess|score|signal|bullish|bearish|research)\b/i.test(text)) {
    return { intent: INTENTS.ANALYSIS, params: { ticker } };
  }
  if (ticker && /\b(price|chart|technical|indicator|52 week|p\/e|pe|rsi|macd|trend|volume|tell me)\b/i.test(lower)) {
    return { intent: INTENTS.STOCK_QUERY, params: { ticker, period: "2y" } };
  }
  if (ticker) {
    return { intent: INTENTS.STOCK_QUERY, params: { ticker, period: "2y" } };
  }

  return llmFallback(text);
}

export function toolForIntent(intent) {
  return {
    [INTENTS.STOCK_QUERY]: "get_technical_indicators",
    [INTENTS.MACRO_INFO]: "get_macro_info",
    [INTENTS.MACRO_ANCHOR]: "get_macro_anchors",
    [INTENTS.ANALYSIS]: "analyze_stock",
    [INTENTS.RECOMMENDATION]: "recommend_stock"
  }[intent] || null;
}

export { INTENTS, extractTicker };
