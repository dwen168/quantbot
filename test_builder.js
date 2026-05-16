import { buildDashboard } from "./chatbot/server/utils/chartBuilder.js";

const data = {
  action: "BUY",
  confidence: 80,
  risk_level: "LOW",
  time_horizon: "MEDIUM",
  price_guidance: {
    current_price: 100,
    entry_range_low: 98,
    entry_range_high: 102,
    stop_loss: 92,
    target_price: 115,
    upside_pct: 15,
    downside_risk_pct: 8
  },
  underlying_analysis: { scores: { combined_score: 50 } },
  key_reasons: [],
  key_risks: [],
  narrative: "Testing"
};

console.log(JSON.stringify(buildDashboard("recommend_stock", data).widgets, null, 2));
