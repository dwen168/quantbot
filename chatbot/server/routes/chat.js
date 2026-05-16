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

function macroInfoMessage(data) {
  return `**ASX macro snapshot (${data.as_of_date})**\n\n- RBA cash rate: **${pct(data.rba_policy?.cash_rate)}** (${data.rba_policy?.rate_direction || "unknown"})\n- ASX200: **${data.asx_market?.asx200_level ?? "n/a"}**, 1D **${pct(data.asx_market?.asx200_1d_change)}**\n- AUD/USD: **${data.currencies?.aud_usd ?? "n/a"}**\n- Gold: **${data.commodities?.gold_usd ?? "n/a"}**, Oil: **${data.commodities?.crude_oil_usd ?? "n/a"}**`;
}

function macroAnchorMessage(data) {
  return `**Macro anchors (${data.as_of_date})**\n\n${data.summary}\n\n- Cash rate: **${pct(data.rates_environment?.rba_cash_rate)}**\n- Rate regime: **${data.rates_environment?.regime || "n/a"}**\n- VIX: **${data.risk_sentiment?.vix_level ?? "n/a"}** (${data.risk_sentiment?.vix_regime || "n/a"})\n- China signal: **${data.china_exposure?.china_signal || "n/a"}**`;
}

function analysisMessage(data) {
  const bullish = (data.bullish_signals || []).slice(0, 3).map((item) => `- ${item}`).join("\n");
  const bearish = (data.bearish_signals || []).slice(0, 3).map((item) => `- ${item}`).join("\n");
  return `**${data.symbol} analysis**: combined score **${data.scores?.combined_score}** (${data.technical_assessment?.overall || "neutral"} technicals, ${data.macro_assessment?.overall || "neutral"} macro).\n\n**Bullish factors**\n${bullish || "- None detected"}\n\n**Negative drivers**\n${bearish || "- None detected"}`;
}

function recommendationMessage(data) {
  const reasons = (data.key_reasons || []).slice(0, 4).map((item) => `- ${item}`).join("\n");
  const risks = (data.key_risks || []).slice(0, 3).map((item) => `- ${item}`).join("\n");
  return `**${data.symbol}: ${data.action}** with **${data.confidence}%** confidence.\n\nRisk level: **${data.risk_level}**. Target: **${money(data.price_guidance?.target_price)}**. Stop: **${money(data.price_guidance?.stop_loss)}**.\n\n**Reasons**\n${reasons || "- Score-based decision"}\n\n**Risks**\n${risks || "- Market data may be incomplete"}`;
}

function templateMessage(tool, data) {
  if (tool === "get_technical_indicators") return stockMessage(data);
  if (tool === "get_macro_info") return macroInfoMessage(data);
  if (tool === "get_macro_anchors") return macroAnchorMessage(data);
  if (tool === "analyze_stock") return analysisMessage(data);
  if (tool === "recommend_stock") return recommendationMessage(data);
  return "I found data, but could not format a response for that tool.";
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
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required.", code: "MESSAGE_REQUIRED" });
  }

  const routed = await routeIntent(message);
  const tool = toolForIntent(routed.intent);
  if (!tool) {
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
      return res.json({ message: fallbackMessage, tool: null, params: {}, rawData: null, charts: [], widgets: [] });
    }

    return res.status(400).json({
      error: "Could not resolve ticker or intent from your message. Try an ASX ticker such as BHP, CBA, RIO, or ask about macro conditions.",
      code: "INTENT_NOT_FOUND"
    });
  }

  if (["get_technical_indicators", "analyze_stock", "recommend_stock"].includes(tool) && !routed.params?.ticker) {
    return res.status(400).json({
      error: "Could not resolve ticker from your message. Please include an ASX ticker (e.g. BHP, CBA).",
      code: "TICKER_NOT_FOUND"
    });
  }

  try {
    const params = { ...routed.params };
    if (tool === "get_technical_indicators" && !params.period) {
      params.period = "2y";
    }
    const rawData = await callTool(tool, params);
    const { charts, widgets } = buildDashboard(tool, rawData);
    const responseMessage = await maybeSummarize({ tool, data: rawData, model });
    return res.json({ message: responseMessage, tool, params, rawData, charts, widgets });
  } catch (error) {
    return res.status(502).json({
      error: error.message || "MCP tool call failed.",
      code: "MCP_TOOL_FAILED"
    });
  }
});

export default router;
