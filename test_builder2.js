import { buildDashboard } from "./chatbot/server/utils/chartBuilder.js";

const data = {
  action: "HOLD",
  confidence: 50,
  risk_level: "MEDIUM",
  time_horizon: "SHORT",
  price_guidance: {
    current_price: 100,
    entry_range_low: 98,
    entry_range_high: 102,
    stop_loss: 92,
    target_price: 100,
    upside_pct: 0,
    downside_risk_pct: 8
  },
  underlying_analysis: { scores: { combined_score: 10 } },
  key_reasons: [],
  key_risks: [],
  narrative: null
};

console.log(JSON.stringify(buildDashboard("recommend_stock", data).widgets, null, 2));
