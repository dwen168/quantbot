const TOP_ASX_TICKERS = new Set([
  "BHP", "CBA", "CSL", "NAB", "WBC", "ANZ", "MQG", "WES", "WOW", "TLS",
  "RIO", "FMG", "GMG", "TCL", "ALL", "REA", "XRO", "WDS", "COL", "QBE",
  "STO", "SUN", "IAG", "S32", "BXB", "RMD", "COH", "CPU", "ASX", "ORG",
  "NST", "MIN", "JHX", "AMC", "SHL", "RHC", "TWE", "MPL", "APA", "EDV",
  "FPH", "CAR", "SEK", "VCX", "SGP", "ALD", "QAN", "BPT", "LYC", "PLS",
  "EVN", "NEM", "IGO", "A2M", "MGR", "SOL", "DMP", "JBH", "HVN", "TPG",
  "BEN", "BOQ", "AMP", "AZJ", "ALX", "DXS", "GPT", "SCG", "CHC", "QUB",
  "IEL", "FLT", "WEB", "LOV", "PME", "MTS", "ORI", "BSL", "ORA", "LLC",
  "HUB", "DOW", "NEC", "SUL", "WHC", "YAL", "PDN", "LTR", "AKE", "AGL"
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
  const candidates = message.toUpperCase().match(/\b[A-Z]{2,5}\b/g) || [];
  return candidates.find((candidate) => TOP_ASX_TICKERS.has(candidate)) || null;
}

async function llmFallback(message) {
  if (!process.env.OPENAI_API_KEY) {
    return { intent: INTENTS.UNKNOWN, params: {} };
  }
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Classify ASX stock chatbot requests. Return JSON only: {\"intent\":\"STOCK_QUERY|MACRO_INFO|MACRO_ANCHOR|ANALYSIS|RECOMMENDATION|UNKNOWN\",\"ticker\":\"BHP\"}."
        },
        { role: "user", content: message }
      ]
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const ticker = parsed.ticker && TOP_ASX_TICKERS.has(String(parsed.ticker).toUpperCase())
      ? String(parsed.ticker).toUpperCase()
      : null;
    return { intent: parsed.intent || INTENTS.UNKNOWN, params: ticker ? { ticker } : {} };
  } catch {
    return { intent: INTENTS.UNKNOWN, params: {} };
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
