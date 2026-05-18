function fmt(value, suffix = "", prefix = "", fallback = "n/a") {
  return value === null || value === undefined ? fallback : `${prefix}${value}${suffix}`;
}

function kv(id, title, rows, options = {}) {
  return { id, type: "kv", title, rows, ...options };
}

function factors(id, title, items, options = {}) {
  return { id, type: "factors", title, items: items || [], ...options };
}

function group(id, widgets, options = {}) {
  return { id, type: "group", widgets: widgets || [], ...options };
}

function signals(id, title, items, options = {}) {
  return { id, type: "signals", title, items: items || [], ...options };
}

function news(id, title, items, options = {}) {
  return { id, type: "news", title, items: items || [], ...options };
}

function miniCharts(id, title, items, options = {}) {
  return { id, type: "mini-charts", title, items: items || [], ...options };
}

function table(id, title, columns, rows, options = {}) {
  return { id, type: "table", title, columns, rows, ...options };
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
      // 1. ASX200 Hero — Full-width header
      {
        id: "market-hero",
        type: "stock-hero",
        symbol: "ASX 200",
        price: data.asx_market?.asx200_level,
        changePct: data.asx_market?.asx200_1d_change,
        trend: null,
        fullWidth: true
      },

      // 2. FX with Sparklines — Half-width
      miniCharts("fx-sparklines", "Foreign Exchange", [
        { label: "AUD/USD", value: data.currencies?.aud_usd != null ? `1D: ${fmt(data.currencies.aud_usd_1mo_change, "%")}` : "n/a", series: data.currencies?.aud_usd_series },
        { label: "AUD/CNY", value: data.currencies?.aud_cny, series: data.currencies?.aud_cny_series },
      ]),

      // 3. Commodities & Rates - Combined Trends and Info
      {
        id: "commodities-group",
        type: "group",
        columns: 2,
        widgets: [
          miniCharts("metals", "Metals Trends (3M)", [
            { label: "Gold (USD)", value: data.commodities?.gold_usd, series: data.commodities?.gold_usd_series },
            { label: "Copper (USD)", value: data.commodities?.copper_usd, series: data.commodities?.copper_usd_series },
            { label: "Iron Ore", value: data.commodities?.iron_ore_etf_proxy, series: data.commodities?.iron_ore_series },
          ]),
          {
            id: "energy-rates-group",
            type: "group",
            columns: 1,
            widgets: [
              miniCharts("energy", "Energy Trends (3M)", [
                { label: "Crude Oil", value: data.commodities?.crude_oil_usd, series: data.commodities?.crude_oil_usd_series },
                { label: "Coal Proxy", value: data.commodities?.coal_proxy_ticker, series: data.commodities?.coal_series },
              ]),
              kv("rates-info", "Rates & News", [
                ["RBA Cash Rate", fmt(data.asx_market?.rba_cash_rate, "%")],
              ], { hideBadges: true })
            ]
          }
        ]
      },

      // 4. Sector Performance - Consolidated Card
      {
        id: "sector-performance-group",
        type: "group",
        title: "Sector Performance",
        fullWidth: true,
        columns: 1,
        widgets: [
          miniCharts("sector-trends", "3-Month Sector Trends", sectors.map(s => ({
            label: s.name,
            value: s.one_d_pct != null ? `1D: ${fmt(s.one_d_pct, "%")}` : "n/a",
            series: s.series
          }))),
          chart("sector-performance-bar", "bar", "Daily Performance (%)", {
            indexAxis: "y",
            labels: sectors.map(s => s.name),
            datasets: [{
              data: sectors.map(s => s.one_d_pct),
              backgroundColor: sectors.map(s => (s.one_d_pct >= 0 ? "rgba(16, 185, 129, 0.7)" : "rgba(239, 68, 68, 0.7)")),
              borderRadius: 4
            }]
          }, { isChart: true })
        ]
      },

      // 5. Global Indices - Consolidated Card
      {
        id: "global-indices-group",
        type: "group",
        title: "Global Indices",
        fullWidth: true,
        columns: 1,
        widgets: [
          miniCharts("global-trends", "3-Month Global Trends", [
            { label: "S&P 500", value: data.global_indices?.sp500_1d_change != null ? `1D: ${fmt(data.global_indices.sp500_1d_change, "%")}` : "n/a", series: data.global_indices?.sp500_series },
            { label: "Nasdaq", value: data.global_indices?.nasdaq_1d_change != null ? `1D: ${fmt(data.global_indices.nasdaq_1d_change, "%")}` : "n/a", series: data.global_indices?.nasdaq_series },
            { label: "Shanghai", value: data.global_indices?.shanghai_1d_change != null ? `1D: ${fmt(data.global_indices.shanghai_1d_change, "%")}` : "n/a", series: data.global_indices?.shanghai_series },
            { label: "Hang Seng", value: data.global_indices?.hang_seng_1d_change != null ? `1D: ${fmt(data.global_indices.hang_seng_1d_change, "%")}` : "n/a", series: data.global_indices?.hang_seng_series },
          ]),
          chart("global-indices-bar", "bar", "Daily Change (%)", {
            indexAxis: "y",
            labels: ["S&P 500", "Nasdaq", "Shanghai", "Hang Seng"],
            datasets: [{
              data: [
                data.global_indices?.sp500_1d_change,
                data.global_indices?.nasdaq_1d_change,
                data.global_indices?.shanghai_1d_change,
                data.global_indices?.hang_seng_1d_change
              ],
              backgroundColor: [
                data.global_indices?.sp500_1d_change,
                data.global_indices?.nasdaq_1d_change,
                data.global_indices?.shanghai_1d_change,
                data.global_indices?.hang_seng_1d_change
              ].map(v => (v >= 0 ? "rgba(16, 185, 129, 0.7)" : "rgba(239, 68, 68, 0.7)")),
              borderRadius: 4
            }]
          }, { isChart: true })
        ]
      },

      // 6. News - Full-width at the bottom
      news("news", "Market Headlines", data.news_headlines || [], { fullWidth: true })
    ],
    charts: []
  };
}

function buildMacroRegimeCharts(data) {
  const ratesDescription = data.rates_env?.regime === "RESTRICTIVE" 
    ? "Current rates are above the neutral level, designed to curb inflation by slowing economic activity."
    : data.rates_env?.regime === "ACCOMMODATIVE"
    ? "Rates are low to support economic growth and investment."
    : "Rates are at a neutral level, neither strongly restricting nor stimulating the economy.";

  const rotation = data.sector_rotation?.rotation_signal || "MIXED";
  const rotationExplanation = rotation === "RISK_OFF" 
    ? "⚠️ RISK_OFF: Defensive sectors outperforming. High market fear/uncertainty."
    : rotation === "RISK_ON"
    ? "✅ RISK_ON: Growth/Cyclical sectors outperforming. Market is seeking higher yields."
    : "⚖️ MIXED: No clear defensive or growth leadership.";

  return {
    widgets: [
      // 1. Sector Rotation Signal Banner - Move to TOP
      {
        id: "rotation-hero",
        type: "banner",
        text: `Rotation Signal: ${rotationExplanation}`
      },

      // 2. Macro Hero — Badge text is the core content
      {
        id: "macro-hero",
        type: "macro-hero",
        regime: data.rates_env?.regime || "UNKNOWN",
        chinaSignal: data.china_exposure?.china_signal || "NEUTRAL",
        vixRegime: data.risk_sentiment?.vix_regime || "UNKNOWN",
        summary: data.summary || "Structural macro environment overview."
      },

      // 3. Structural Drivers Group
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

      // 4. ABS Economic Data — Structural indicators with fallback placeholders
      kv("abs-data", "ABS Economic Indicators", [
        ["CPI YoY (Inflation)", fmt(data.inflation?.latest_cpi_yoy, "%", "", "No data")],
        ["GDP Growth YoY", fmt(data.growth?.gdp_growth_yoy, "%", "", "No data")],
        ["Unemployment Rate", fmt(data.growth?.unemployment_rate, "%", "", "No data")],
      ], { description: "Key domestic metrics from the Australian Bureau of Statistics." }),
    ],
    charts: [
      // 5. 3-Month Cumulative Trend Chart
      ...(data.sector_rotation?.trend_datasets?.length > 0 ? [
        chart("sector-trend", "line", "3M Sector Trend vs ASX 200 (Cumulative % Change)", {
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

      // 2. Technical Assessment — Flattened into 3 columns
      {
        id: "technical-assessment-flattened",
        type: "group",
        title: "Technical Assessment",
        fullWidth: true,
        columns: 3,
        widgets: [
          kv("tech-signal-core", "Price Action", [
            ["Verdict",    data.technical_assessment?.overall],
            ["Trend",      data.technical_assessment?.trend_signal],
            ["Momentum",   data.technical_assessment?.momentum_signal],
          ]),
          kv("tech-market-dynamics", "Market Dynamics", [
            ["Volatility", data.technical_assessment?.volatility_signal],
            ["Volume",     data.technical_assessment?.volume_signal],
          ]),
          kv("tech-price-plan", "Price Targets", [
            ["Support",    fmt(data.technical_assessment?.key_levels?.support,               "", "$")],
            ["Resistance", fmt(data.technical_assessment?.key_levels?.resistance,            "", "$")],
            ["Stop Loss",  fmt(data.technical_assessment?.key_levels?.stop_loss_suggestion,  "", "$")],
          ]),
        ]
      },

      // 3. Macro Assessment — Flattened into 2 columns
      {
        id: "macro-assessment-flattened",
        type: "group",
        title: "Macro Assessment",
        fullWidth: true,
        columns: 2,
        widgets: [
          kv("macro-regime-core", "Regime & Sentiment", [
            ["Verdict",        data.macro_assessment?.overall],
            ["Risk Sentiment", data.macro_assessment?.risk_sentiment],
          ]),
          kv("macro-external-drivers", "External Drivers", [
            ["Rates Headwind", data.macro_assessment?.rates_headwind ? "Yes ⚠️" : "No ✅"],
            ["China Tailwind", data.macro_assessment?.china_tailwind ? "Yes ✅" : "No"],
          ]),
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
