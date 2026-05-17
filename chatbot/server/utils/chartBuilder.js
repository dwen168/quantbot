function fmt(value, suffix = "", prefix = "", fallback = "n/a") {
  return value === null || value === undefined ? fallback : `${prefix}${value}${suffix}`;
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

function buildMarketSnapshotCharts(data) {
  // Sort sectors by performance for the bar chart
  const sectors = [...(data.asx_market?.top_sectors || [])].sort((a, b) => (b.one_d_pct || 0) - (a.one_d_pct || 0));
  
  return {
    widgets: [
      // 1. ASX200 Hero — Big and clear, uses color-only signal
      {
        id: "market-hero",
        type: "stock-hero",
        symbol: "ASX 200",
        price: data.asx_market?.asx200_level,
        changePct: data.asx_market?.asx200_1d_change,
        trend: null, // Strictly no qualitative signal words
      },

      // 2. FX with Sparklines — Pure data
      miniCharts("fx-sparklines", "Foreign Exchange", [
        { label: "AUD/USD", value: fmt(data.currencies?.aud_usd), series: data.currencies?.aud_usd_series },
        { label: "AUD/CNY", value: fmt(data.currencies?.aud_cny), series: data.currencies?.aud_cny_series },
      ]),

      // 3. Commodities - Multi-column KV, hide qualitative badges
      {
        id: "commodities-group",
        type: "group",
        columns: 2,
        widgets: [
          kv("metals", "Metals", [
            ["Gold (USD)", fmt(data.commodities?.gold_usd, "", "$")],
            ["Copper (USD)", fmt(data.commodities?.copper_usd, "", "$")],
            ["Iron Ore Proxy", fmt(data.commodities?.iron_ore_etf_proxy, "", "$")],
          ], { hideBadges: true }),
          kv("energy-other", "Energy & News", [
            ["Crude Oil (USD)", fmt(data.commodities?.crude_oil_usd, "", "$")],
            ["Coal Proxy", fmt(data.commodities?.coal_proxy_ticker, "", "$")],
            ["RBA Cash Rate", fmt(data.asx_market?.rba_cash_rate, "%")],
          ], { hideBadges: true })
        ]
      },

      // 4. News
      news("news", "Latest Market News", data.news_headlines || [])
    ],
    charts: [
      // 5. Sector Performance - Bar chart (Color is the signal)
      chart("sector-performance", "bar", "Sector 1D Performance (%)", {
        labels: sectors.map(s => s.name),
        datasets: [{
          label: "% Change",
          data: sectors.map(s => s.one_d_pct),
          backgroundColor: sectors.map(s => (s.one_d_pct >= 0 ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)"))
        }]
      }, { fullWidth: true }),

      // 6. Global Indices
      chart("global-indices", "bar", "Global Indices 1D Change (%)", {
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
      }, { fullWidth: true })
    ]
  };
}

function buildMacroRegimeCharts(data) {
  const ratesDescription = data.rates_env?.regime === "RESTRICTIVE" 
    ? "Current rates are above the neutral level, designed to curb inflation by slowing economic activity."
    : data.rates_env?.regime === "ACCOMMODATIVE"
    ? "Rates are low to support economic growth and investment."
    : "Rates are at a neutral level, neither strongly restricting nor stimulating the economy.";

  return {
    widgets: [
      // 1. Macro Hero — Badge text is the core content
      {
        id: "macro-hero",
        type: "macro-hero",
        regime: data.rates_env?.regime || "UNKNOWN",
        chinaSignal: data.china_exposure?.china_signal || "NEUTRAL",
        vixRegime: data.risk_sentiment?.vix_regime || "UNKNOWN",
        summary: data.summary || "Structural macro environment overview."
      },

      // 2. Structural Drivers Group
      {
        id: "regime-drivers",
        type: "group",
        columns: 3,
        widgets: [
          kv("rates-regime", "Rates Environment", [
            ["Regime", data.rates_env?.regime],
            ["RBA Cash Rate", fmt(data.rates_env?.rba_cash_rate, "%")],
          ], { description: ratesDescription }),
          
          kv("vix-regime", "Volatility (VIX)", [
            ["Risk Regime", data.risk_sentiment?.vix_regime],
            ["VIX Level", fmt(data.risk_sentiment?.vix_level)],
            ["ASX Vol 20D", fmt(data.risk_sentiment?.asx200_volatility_20d, "%")],
          ], { description: "VIX measures market fear. High VIX = High stress environment." }),

          kv("china-drivers", "China Signal Components", [
            ["Signal", data.china_exposure?.china_signal],
            ["Shanghai YTD", fmt(data.china_exposure?.shanghai_comp_ytd, "%")],
            ["AUD/CNY 3M", fmt(data.china_exposure?.aud_cny_3mo_change, "%")],
            ["Iron Ore YTD", fmt(data.china_exposure?.iron_ore_proxy_ytd, "%")],
          ], { description: "Aggregated signal from major Chinese economic proxies." })
        ]
      },

      // 3. ABS Economic Data — Structural indicators with fallback placeholders
      kv("abs-data", "ABS Economic Indicators", [
        ["CPI YoY (Inflation)", fmt(data.inflation?.latest_cpi_yoy, "%", "", "No data")],
        ["GDP Growth YoY", fmt(data.growth?.gdp_growth_yoy, "%", "", "No data")],
        ["Unemployment Rate", fmt(data.growth?.unemployment_rate, "%", "", "No data")],
      ], { description: "Key domestic metrics from the Australian Bureau of Statistics." }),

      // 4. Sector Rotation Signal Banner
      {
        id: "rotation-hero",
        type: "banner",
        text: `Sector Rotation Signal: ${data.sector_rotation?.rotation_signal || "MIXED"}`
      }
    ],
    charts: [
      // 5. 3-Month Normalized Trend Chart (Structural Evidence)
      ...(data.sector_rotation?.trend_datasets?.length > 0 ? [
        chart("sector-trend", "line", "3M Sector Trend vs ASX 200 (Base 100)", {
          labels: data.sector_rotation.trend_labels,
          datasets: data.sector_rotation.trend_datasets
        }, { fullWidth: true })
      ] : [])
    ]
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
            ["Rates Headwind", data.macro_assessment?.rates_env?.regime === "RESTRICTIVE" ? "Yes ⚠️" : "No ✅"],
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
      
      // Market Context — Pure data for background, hide qualitative badges
      kv("market-context", "Market Context", [
        ["ASX200 Level", fmt(data.market_context?.asx200_level)],
        ["AUD/USD", fmt(data.market_context?.aud_usd)],
      ], { description: "Broader market pulse at the time of recommendation.", hideBadges: true }),

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
  if (tool === "get_market_snapshot") return buildMarketSnapshotCharts(data);
  if (tool === "get_macro_regime") return buildMacroRegimeCharts(data);
  if (tool === "analyze_stock") return buildAnalysisCharts(data);
  if (tool === "recommend_stock") return buildRecommendationCharts(data);
  return { charts: [], widgets: [] };
}
