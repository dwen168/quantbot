function fmt(value, suffix = "", prefix = "") {
  return value === null || value === undefined ? "n/a" : `${prefix}${value}${suffix}`;
}

function kv(id, title, rows, options = {}) {
  return { id, type: "kv", title, rows, ...options };
}

function factors(id, title, items) {
  return { id, type: "factors", title, items: items || [] };
}

function group(id, widgets) {
  return { id, type: "group", widgets: widgets || [] };
}

function signals(id, title, items) {
  return { id, type: "signals", title, items: items || [] };
}

function news(id, title, items) {
  return { id, type: "news", title, items: items || [] };
}

function miniCharts(id, title, items) {
  return { id, type: "mini-charts", title, items: items || [] };
}

function table(id, title, columns, rows) {
  return { id, type: "table", title, columns, rows };
}

function chart(id, type, title, config, options = {}) {
  return { id, type, title, config, ...options };
}

function buildStockCharts(data) {
  const price = data.last_price;
  const ma = data.moving_averages || {};

  // Helper: % diff of current price vs a moving average
  function maDiff(val) {
    if (!val || !price) return null;
    return ((price - val) / val * 100).toFixed(2);
  }

  return {
    widgets: [
      // Row 1: Full-width price hero
      {
        id: "stock-hero",
        type: "stock-hero",
        symbol: data.symbol,
        price: price,
        changePct: data.price_change_pct,
        trend: data.trend?.trend_signal,
        volumeRatio: data.volume?.volume_ratio,
      },

      // Row 2: Three indicator groups side by side
      {
        id: "indicators-group",
        type: "group",
        columns: 3,
        widgets: [
          kv("momentum", "Momentum", [
            ["RSI 14", fmt(data.momentum?.rsi_14)],
            ["MACD", fmt(data.momentum?.macd)],
            ["MACD Signal", fmt(data.momentum?.macd_signal)],
            ["MACD Hist", fmt(data.momentum?.macd_histogram)],
            ["Stoch K", fmt(data.momentum?.stoch_k)],
            ["Stoch D", fmt(data.momentum?.stoch_d)],
          ], { description: "Price momentum indicators. RSI > 70 = overbought, < 30 = oversold. MACD above signal line is bullish." }),
          kv("trend-vol", "Trend & Volatility", [
            ["Trend", data.trend?.trend_signal || "n/a"],
            ["ADX 14", fmt(data.trend?.adx_14)],
            ["ATR 14", fmt(data.volatility?.atr_14)],
            ["Volume Ratio", fmt(data.volume?.volume_ratio)],
          ], { description: "ADX > 25 = strong trend. ATR measures average daily price range. Volume Ratio > 1 = above-average activity." }),
          kv("bollinger", "Bollinger Bands", [
            ["Upper", fmt(data.volatility?.bb_upper)],
            ["Middle", fmt(data.volatility?.bb_middle)],
            ["Lower", fmt(data.volatility?.bb_lower)],
            ["Width", fmt(data.volatility?.bb_width)],
          ], { description: "Price near Upper Band = overbought risk. Near Lower Band = oversold opportunity. Width = current volatility." }),
        ]
      },

      // Row 3: Moving Averages as a comparison table
      {
        id: "moving-averages",
        type: "ma-table",
        title: "Moving Averages vs Current Price",
        description: `Current price: ${fmt(price)}. Green = price is above the MA (bullish alignment). Red = price is below (bearish).`,
        rows: [
          { label: "SMA 20", value: fmt(ma.sma_20), diff: maDiff(ma.sma_20), period: "20-day" },
          { label: "SMA 50", value: fmt(ma.sma_50), diff: maDiff(ma.sma_50), period: "50-day" },
          { label: "SMA 200", value: fmt(ma.sma_200), diff: maDiff(ma.sma_200), period: "200-day" },
          { label: "EMA 20", value: fmt(ma.ema_20), diff: maDiff(ma.ema_20), period: "20-day EMA" },
          { label: "EMA 50", value: fmt(ma.ema_50), diff: maDiff(ma.ema_50), period: "50-day EMA" },
        ]
      },

      // Row 4: Signals (full width)
      signals("technical-signals", "Technical Signals", data.signals),
    ],
    charts: [
      chart("price-action", "candlestick", "2Y Price Action", {
        series: data.price_series || []
      }, { fullWidth: true }),
    ]
  };
}


function buildMacroInfoCharts(data) {
  return {
    widgets: [
      kv("rba-policy", "RBA Policy", [
        ["Cash Rate", fmt(data.rba_policy?.cash_rate, "%")],
        ["Direction", data.rba_policy?.rate_direction || "n/a"],
        ["Last Change", data.rba_policy?.last_change_date || "n/a"],
        ["Change", fmt(data.rba_policy?.last_change_bps, " bps")]
      ]),
      kv("asx200", "ASX200", [
        ["Level", fmt(data.asx_market?.asx200_level)],
        ["1D", fmt(data.asx_market?.asx200_1d_change, "%")],
        ["1M", fmt(data.asx_market?.asx200_1mo_change, "%")],
        ["YTD", fmt(data.asx_market?.asx200_ytd_change, "%")]
      ]),
      miniCharts("currency-commodity", "Currency & Commodity", [
        { label: "AUD/USD", value: fmt(data.currencies?.aud_usd), series: data.currencies?.aud_usd_series },
        { label: "AUD/CNY", value: fmt(data.currencies?.aud_cny), series: data.currencies?.aud_cny_series },
        { label: "Gold", value: fmt(data.commodities?.gold_usd), series: data.commodities?.gold_usd_series },
        { label: "Oil", value: fmt(data.commodities?.crude_oil_usd), series: data.commodities?.crude_oil_usd_series },
        { label: "Copper", value: fmt(data.commodities?.copper_usd), series: data.commodities?.copper_usd_series }
      ]),
      news("news", "News Headlines", data.news_headlines || [])
    ],
    charts: [
      chart("global-indices", "bar", "Global Indices 1D Change", {
        indexAxis: "y",
        labels: ["S&P 500", "Nasdaq", "Shanghai", "Hang Seng"],
        datasets: [{
          label: "% change",
          data: [
            data.global_indices?.sp500_1d_change,
            data.global_indices?.nasdaq_1d_change,
            data.global_indices?.shanghai_1d_change,
            data.global_indices?.hang_seng_1d_change
          ]
        }]
      })
    ]
  };
}

function buildMacroAnchorCharts(data) {
  return {
    widgets: [
      // Row 1: Macro Hero banner with the most critical summary
      {
        id: "macro-hero",
        type: "macro-hero",
        regime: data.rates_environment?.regime || "UNKNOWN",
        chinaSignal: data.china_exposure?.china_signal || "NEUTRAL",
        vixRegime: data.risk_sentiment?.vix_regime || "UNKNOWN",
        summary: data.summary || "Macro regime snapshot"
      },
      // Row 2: Grouped core macro data
      {
        id: "macro-core-group",
        type: "group",
        columns: 3,
        widgets: [
          kv("rates-inflation", "Rates & Inflation", [
            ["Cash Rate", fmt(data.rates_environment?.rba_cash_rate, "%")],
            ["AU 10Y Yield", fmt(data.rates_environment?.au_10y_bond_yield)],
            ["Yield Curve", fmt(data.rates_environment?.yield_curve_slope)],
            ["CPI YoY", fmt(data.inflation?.latest_cpi_yoy, "%")],
            ["Trimmed Mean", fmt(data.inflation?.latest_trimmed_mean, "%")]
          ], { description: "Monetary policy and inflation indicators." }),
          kv("growth-china", "Growth & China", [
            ["GDP YoY", fmt(data.growth?.gdp_growth_yoy, "%")],
            ["Unemployment", fmt(data.growth?.unemployment_rate, "%")],
            ["Shanghai YTD", fmt(data.china_exposure?.shanghai_comp_ytd, "%")],
            ["Iron Ore YTD", fmt(data.china_exposure?.iron_ore_proxy_ytd, "%")],
            ["AUD/CNY 3M", fmt(data.china_exposure?.aud_cny_3mo_change, "%")]
          ], { description: "Domestic growth and China exposure proxies." }),
          kv("risk-sectors", "Risk & Sectors", [
            ["VIX Level", fmt(data.risk_sentiment?.vix_level)],
            ["ASX Vol 20D", fmt(data.risk_sentiment?.asx200_volatility_20d, "%")],
            ["Outperforming", data.sector_rotation?.outperforming_sectors?.length || 0],
            ["Underperforming", data.sector_rotation?.underperforming_sectors?.length || 0],
            ["Rotation", data.sector_rotation?.rotation_signal || "MIXED"]
          ], { description: "Market risk sentiment and sector rotation." })
        ]
      },
      // Row 3: Risk Sentiment
      {
        id: "risk-explanation",
        type: "metric-explain",
        label: "Risk Sentiment (VIX)",
        value: fmt(data.risk_sentiment?.vix_level),
        sentiment: "neutral",
        description: `The VIX represents market expectations of near-term volatility. A level of ${fmt(data.risk_sentiment?.vix_level)} indicates a ${data.risk_sentiment?.vix_regime?.toLowerCase()} risk regime.`,
        methodology: "VIX < 15 is LOW risk (complacency). 15-25 is NORMAL. 25-35 is ELEVATED (fear). > 35 is EXTREME (panic). Elevated VIX often precedes market bottoms, while persistently low VIX can precede corrections."
      },
      // Row 4: Trend Chart
      ...(data.sector_rotation?.trend_datasets?.length > 0 ? [
        chart("sector-trend", "line", "3M Sector Trend vs ASX 200 (Base 100)", {
          labels: data.sector_rotation.trend_labels,
          datasets: data.sector_rotation.trend_datasets
        }, { fullWidth: true, isChart: true })
      ] : []),
      // Row 5: Sector Rotation Factors
      factors("sector-rotation-factors", "Sector Rotation Dynamics", [
        ...(data.sector_rotation?.outperforming_sectors || []).map(s => ({
          label: s,
          value: "Outperforming",
          sentiment: "bullish"
        })),
        ...(data.sector_rotation?.underperforming_sectors || []).map(s => ({
          label: s,
          value: "Underperforming",
          sentiment: "bearish"
        }))
      ])
    ],
    charts: []
  };
}

function buildAnalysisCharts(data) {
  const combinedScore = data.scores?.combined_score ?? null;
  const techScore     = data.scores?.technical_score  ?? null;
  const macroScore    = data.scores?.macro_score       ?? null;

  // Split signals by category so they perfectly explain the math
  const allBullish = data.bullish_signals || [];
  const allBearish = data.bearish_signals || [];
  const allRisks   = data.risk_factors || [];

  const techBullish = allBullish.filter(s => s.category === "technical");
  const techBearish = allBearish.filter(s => s.category === "technical");
  
  const macroBullish = allBullish.filter(s => s.category === "macro");
  const macroRisks   = allRisks.filter(s => s.category === "macro");

  return {
    widgets: [
      { id: "analysis-banner", type: "banner", text: "🔬 Deep Analysis" },

      // 1. Score Hero — verdict, score, formula
      {
        id: "combined-score-hero",
        type: "score-hero",
        combinedScore,
        techScore,
        macroScore,
        techBullCount: techBullish.length,
        techBearCount: techBearish.length,
        macroBullCount: macroBullish.length,
        macroRiskCount: macroRisks.length
      },

      // 2. Technical + Macro side by side
      {
        id: "sub-scores-group",
        type: "group",
        columns: 2,
        widgets: [
          kv("technical-assessment", `Technical Assessment`, [
            ["Verdict",    data.technical_assessment?.overall],
            ["Trend",      data.technical_assessment?.trend_signal],
            ["Momentum",   data.technical_assessment?.momentum_signal],
            ["Volatility", data.technical_assessment?.volatility_signal],
            ["Volume",     data.technical_assessment?.volume_signal],
            ["Support",    fmt(data.technical_assessment?.key_levels?.support,               "", "$")],
            ["Resistance", fmt(data.technical_assessment?.key_levels?.resistance,            "", "$")],
            ["Stop Loss",  fmt(data.technical_assessment?.key_levels?.stop_loss_suggestion,  "", "$")],
          ], { description: "Technical score (60% weight) — evaluates price trend, momentum, moving average alignment, volatility and volume." }),
          kv("macro-assessment", `Macro Assessment`, [
            ["Verdict",        data.macro_assessment?.overall],
            ["Risk Sentiment", data.macro_assessment?.risk_sentiment],
            ["Rates Headwind", data.macro_assessment?.rates_headwind ? "Yes ⚠️" : "No ✅"],
            ["China Tailwind", data.macro_assessment?.china_tailwind ? "Yes ✅" : "No"],
          ], { description: "Macro score (40% weight) — evaluates RBA rates regime, VIX risk environment, and China macro linkage." }),
        ]
      },

      // 4. Signals grouped by category to match the formula!
      factors("technical-signals", "📊 Technical Drivers", [...techBullish, ...techBearish]),
      factors("macro-signals",     "🌍 Macro Factors",    [...macroBullish, ...macroRisks]),

      // 5. Narrative
      data.narrative ? { id: "analysis-summary", type: "text", title: "Analyst Narrative", text: data.narrative } : null,
    ].filter(Boolean),
    charts: []
  };
}

function buildRecommendationCharts(data) {
  const pg = data.price_guidance || {};
  const scores = data.underlying_analysis?.scores || {};
  const upside = pg.upside_pct;
  const downside = pg.downside_risk_pct;
  const rr = (upside !== null && downside !== null && downside !== 0) ? (upside / downside).toFixed(2) : null;

  const entryLabel = data.action === "BUY" ? "Buy Zone" : data.action === "SELL" ? "Sell Zone" : "Fair Value Zone";
  const entryRange = (pg.entry_range_low && pg.entry_range_high)
    ? `${fmt(pg.entry_range_low, "", "$")} – ${fmt(pg.entry_range_high, "", "$")}`
    : "n/a";

  return {
    widgets: [
      { id: "execution-banner", type: "banner", text: "Execution View" },
      { id: "recommendation-hero", type: "hero", action: data.action, confidence: data.confidence, riskLevel: data.risk_level, horizon: data.time_horizon },

      // Conviction metrics row — each with a methodology explanation
      {
        id: "conviction-group",
        type: "group",
        columns: 3,
        widgets: [
          {
            id: "confidence-explain",
            type: "metric-explain",
            label: "Confidence",
            value: `${data.confidence ?? "n/a"}%`,
            sentiment: (data.confidence ?? 0) >= 70 ? "bullish" : (data.confidence ?? 0) >= 50 ? "neutral" : "bearish",
            methodology: "Derived from the Combined Score magnitude across 5 bands. Score ≥ 40: 60–100% confidence BUY. Score 15–39: 50–59% confidence BUY. Score −14 to +14: 40–50% HOLD. Score −15 to −39: 50–59% confidence SELL. Score ≤ −40: 60–100% confidence SELL.",
          },
          {
            id: "risk-explain",
            type: "metric-explain",
            label: "Risk Level",
            value: data.risk_level ?? "n/a",
            sentiment: data.risk_level === "LOW" ? "bullish" : data.risk_level === "HIGH" ? "bearish" : "neutral",
            methodology: "HIGH if |Combined Score| < 15 or ≥ 4 bearish signals present. MEDIUM if |Combined Score| < 40 or ≥ 2 bearish signals. LOW only when |score| ≥ 40 and fewer than 2 bearish signals.",
          },
          {
            id: "score-explain",
            type: "metric-explain",
            label: "Combined Score",
            value: scores.combined_score !== undefined ? (scores.combined_score > 0 ? `+${scores.combined_score}` : String(scores.combined_score)) : "n/a",
            sentiment: (scores.combined_score ?? 0) >= 15 ? "bullish" : (scores.combined_score ?? 0) <= -15 ? "bearish" : "neutral",
            methodology: "Weighted sum: Technical Score × 60% + Macro Score × 40%. Ranges: ≥ 40 → Strong BUY, 15–39 → Mild BUY, −14 to +14 → HOLD, −15 to −39 → Mild SELL, ≤ −40 → Strong SELL. Each band maps continuously with no gaps.",
          }
        ]
      },

      // Price levels and R/R side-by-side
      {
        id: "trade-plan-group",
        type: "group",
        columns: 2,
        widgets: [
          {
            id: "price-levels",
            type: "price-plan",
            title: "Trade Price Levels",
            description: "Prices are derived from 52-week high/low range and an 8% ATR-based stop loss rule.",
            rows: [
              { label: "Current Price", value: fmt(pg.current_price, "", "$"), note: "Estimated by reversing: Stop Loss ÷ 0.92 (since stop = current × 0.92)." },
              { label: entryLabel, value: entryRange, note: data.action === "BUY" ? "−2% to +0.5% of current price: patient entry on a slight pullback." : data.action === "SELL" ? "−0.5% to +2%: sell into a bounce for a better average price." : "±1% around current price — no directional edge detected." },
              { label: "Stop Loss", value: fmt(pg.stop_loss, "", "$"), note: "Set at 8% below current price. Exit immediately if this level is breached to cap losses." },
              { label: "Target Price", value: fmt(pg.target_price, "", "$"), note: data.action === "BUY" ? "52-week resistance level, or +15% if no resistance is available." : data.action === "SELL" ? "52-week support, or −12% if no support data." : "No directional target — hold at current levels." },
            ]
          },
          {
            id: "risk-reward-explain",
            type: "price-plan",
            title: "Risk / Reward Profile",
            description: "How much you could gain versus how much you could lose per dollar risked.",
            rows: [
              { label: "Potential Upside", value: upside !== null ? `+${upside}%` : "n/a", note: "(Target − Current) ÷ Current × 100. The maximum gain if target is reached." },
              { label: "Downside Risk", value: downside !== null ? `-${downside}%` : "n/a", note: "(Current − Stop Loss) ÷ Current × 100. The maximum loss if stop loss is triggered." },
              { label: "Risk / Reward Ratio", value: rr ? `1 : ${rr}` : "n/a", note: `For every 1% at risk, the potential reward is ${rr ?? "n/a"}%. Ratios ≥ 1:2 are considered acceptable; ≥ 1:3 is excellent.` },
              { label: "Time Horizon", value: data.time_horizon ?? "n/a", note: "MEDIUM = 1–6 months based on trend signals. SHORT = days to weeks for tactical setups." },
            ]
          }
        ]
      },

      factors("key-reasons", "✅ Why This Recommendation", data.key_reasons),
      factors("key-risks", "🔴 Key Risks to Monitor", data.key_risks),
      data.narrative ? { id: "recommendation-text", type: "text", title: "Analyst Narrative", text: data.narrative } : null
    ].filter(Boolean),
    charts: []
  };
}


export function buildDashboard(tool, data) {
  if (tool === "get_technical_indicators") return buildStockCharts(data);
  if (tool === "get_macro_info") return buildMacroInfoCharts(data);
  if (tool === "get_macro_anchors") return buildMacroAnchorCharts(data);
  if (tool === "analyze_stock") return buildAnalysisCharts(data);
  if (tool === "recommend_stock") return buildRecommendationCharts(data);
  return { charts: [], widgets: [] };
}
