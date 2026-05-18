import express from "express";

import { buildDashboard } from "../utils/chartBuilder.js";
import { callTool } from "../services/mcpClient.js";
import { generateChatSummary } from "../services/llmService.js";
import { routeIntent, toolForIntent } from "../services/intentRouter.js";

const router = express.Router();

function pct(value) {
  return value === null || value === undefined ? "n/a" : `${value}%`;
}

function money(value) {
  return value === null || value === undefined ? "n/a" : `$${value}`;
}

function stockMessage(data) {
  const rsi = data.momentum?.rsi_14 ?? "n/a";
  const trend = data.trend?.trend_signal || "n/a";
  const signals = (data.signals || []).slice(0, 4).map((item) => `- ${item}`).join("\n");
  return `**${data.symbol}** last traded at **${money(data.last_price)}** over the selected period, with a period change of **${pct(data.price_change_pct)}**.\n\nRSI is **${rsi}**, trend is **${trend}**.\n\n${signals}`;
}

function marketSnapshotMessage(data) {
  return `**ASX market snapshot (${data.as_of_date})**\n\n- ASX200: **${data.asx_market?.asx200_level ?? "n/a"}**, 1D **${pct(data.asx_market?.asx200_1d_change)}**\n- AUD/USD: **${data.currencies?.aud_usd ?? "n/a"}**\n- Gold: **${data.commodities?.gold_usd ?? "n/a"}**, Oil: **${data.commodities?.crude_oil_usd ?? "n/a"}**`;
}

function macroRegimeMessage(data) {
  return `**Macro regime (${data.as_of_date})**\n\n${data.summary}\n\n- Cash rate: **${pct(data.rates_env?.rba_cash_rate)}**\n- Rate regime: **${data.rates_env?.regime || "n/a"}**\n- VIX: **${data.risk_sentiment?.vix_level ?? "n/a"}** (${data.risk_sentiment?.vix_regime || "n/a"})\n- China signal: **${data.china_exposure?.china_signal || "n/a"}**`;
}

function analysisMessage(data) {
  const bullish = (data.bullish_signals || []).slice(0, 3).map((item) => `- ${item.factor}`).join("\n");
  const bearish = (data.bearish_signals || []).slice(0, 3).map((item) => `- ${item.factor}`).join("\n");
  return `**${data.symbol} analysis**: combined score **${data.scores?.combined_score}** (${data.technical_assessment?.overall || "neutral"} technicals, ${data.macro_assessment?.overall || "neutral"} macro).\n\n**Bullish factors**\n${bullish || "- None detected"}\n\n**Negative drivers**\n${bearish || "- None detected"}`;
}

function recommendationMessage(data) {
  const reasons = (data.key_reasons || []).slice(0, 4).map((item) => `- ${item.factor}`).join("\n");
  const risks = (data.key_risks || []).slice(0, 3).map((item) => `- ${item.factor}`).join("\n");
  return `**${data.symbol}: ${data.action}** with **${data.conviction}%** conviction.\n\nRisk level: **${data.risk_level}**. Target: **${money(data.price_guidance?.target_price)}**. Stop: **${money(data.price_guidance?.stop_loss)}**.\n\n**Reasons**\n${reasons || "- Score-based decision"}\n\n**Risks**\n${risks || "- Market data may be incomplete"}`;
}

function templateMessage(tool, data) {
  if (tool === "get_technical_indicators") return stockMessage(data);
  if (tool === "get_market_snapshot") return marketSnapshotMessage(data);
  if (tool === "get_macro_regime") return macroRegimeMessage(data);
  if (tool === "analyze_stock") return analysisMessage(data);
  if (tool === "recommend_stock") return recommendationMessage(data);
  return "I found data, but could not format a response for that tool.";
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function maybeSummarize({ tool, data, model }) {
  const base = templateMessage(tool, data);
  const summary = await generateChatSummary({
    model,
    prompt: `Turn this structured QuantBot result into a concise chat answer. Preserve key numbers.\n\n${JSON.stringify({ tool, data }, null, 2).slice(0, 7000)}`
  });
  return summary || base;
}

router.post("/", async (req, res) => {
  const { message, model } = req.body || {};
  
  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  if (!message || typeof message !== "string") {
    sendSSE(res, { type: "error", error: "Message is required.", code: "MESSAGE_REQUIRED" });
    return res.end();
  }

  try {
    sendSSE(res, { type: "progress", pct: 15, message: "Identifying intent and ticker..." });
    const routed = await routeIntent(message);

    if (routed.intent === "INVALID_TICKER") {
      sendSSE(res, {
        type: "error",
        error: `The ticker "${routed.params?.ticker}" does not appear to be a valid ASX stock. Please check the symbol and try again.`,
        code: "INVALID_TICKER"
      });
      return res.end();
    }

    const tool = toolForIntent(routed.intent);
    if (!tool) {
      sendSSE(res, { type: "progress", pct: 50, message: "Thinking about your question..." });
      let fallbackMessage = null;
      try {
        if (process.env.OPENAI_API_KEY) {
          const { default: OpenAI } = await import("openai");
          const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await client.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are QuantBot, an AI assistant for Australian market analysis. The user asked a general question. Answer it helpfully and concisely in markdown." },
              { role: "user", content: message }
            ]
          });
          fallbackMessage = completion.choices[0]?.message?.content;
        } else {
          fallbackMessage = await generateChatSummary({
            model,
            prompt: `The user asked a general question: "${message}". Please answer it helpfully and concisely in markdown.`
          });
        }
      } catch (e) {
        console.error("Fallback LLM failed:", e);
      }
      
      if (fallbackMessage) {
        sendSSE(res, { 
          type: "complete", 
          payload: { message: fallbackMessage, tool: null, params: {}, rawData: null, charts: [], widgets: [] } 
        });
        return res.end();
      }

      sendSSE(res, {
        type: "error",
        error: "Could not resolve ticker or intent from your message. Try an ASX ticker such as BHP, CBA, RIO, or ask about macro conditions.",
        code: "INTENT_NOT_FOUND"
      });
      return res.end();
    }

    if (["get_technical_indicators", "analyze_stock", "recommend_stock"].includes(tool) && !routed.params?.ticker) {
      sendSSE(res, {
        type: "error",
        error: "Could not resolve ticker from your message. Please include an ASX ticker (e.g. BHP, CBA).",
        code: "TICKER_NOT_FOUND"
      });
      return res.end();
    }

    sendSSE(res, { type: "progress", pct: 40, message: `Requesting ${tool.replace(/_/g, " ")} data...` });
    const params = { ...routed.params };
    if (tool === "get_technical_indicators" && !params.period) {
      params.period = "2y";
    }
    const rawData = await callTool(tool, params);

    // Check if the data returned contains an error from yfinance
    if (rawData && (rawData.error || (rawData.symbol && !rawData.last_price && !rawData.price_series?.length))) {
      const errorMsg = rawData.error || "";
      if (errorMsg.includes("No OHLCV data") || errorMsg.includes("not found") || errorMsg.includes("Ticker is required")) {
        sendSSE(res, {
          type: "error",
          error: `I couldn't find any data for "${params.ticker}". It may not be listed on the ASX or the ticker symbol is incorrect.`,
          code: "TICKER_NOT_FOUND_ON_ASX"
        });
        return res.end();
      }
    }

    sendSSE(res, { type: "progress", pct: 70, message: "Generating charts and analysis..." });
    const { charts, widgets } = buildDashboard(tool, rawData);
    
    sendSSE(res, { type: "progress", pct: 90, message: "Finalizing AI summary..." });
    const responseMessage = await maybeSummarize({ tool, data: rawData, model });
    
    sendSSE(res, { 
      type: "complete", 
      payload: { message: responseMessage, tool, params, rawData, charts, widgets } 
    });
    res.end();
  } catch (error) {
    console.error("Chat route error:", error);
    const errorMsg = error.message || "";
    if (errorMsg.includes("No OHLCV data") || errorMsg.includes("not found")) {
      sendSSE(res, {
        type: "error",
        error: `The stock "${message}" was not found on the ASX. Please verify the ticker symbol.`,
        code: "TICKER_NOT_FOUND_ON_ASX"
      });
    } else {
      sendSSE(res, {
        type: "error",
        error: error.message || "An unexpected error occurred.",
        code: "INTERNAL_ERROR"
      });
    }
    res.end();
  }
});

export default router;
