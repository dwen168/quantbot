function fmt(value, suffix = "") {
  return value === null || value === undefined ? "n/a" : `${value}${suffix}`;
}

function kv(id, title, rows, options = {}) {
  return { id, type: "kv", title, rows, ...options };
}

function signals(id, title, items) {
  return { id, type: "signals", title, items: items || [] };
}

function table(id, title, columns, rows) {
  return { id, type: "table", title, columns, rows };
}

function chart(id, type, title, config, options = {}) {
  return { id, type, title, config, ...options };
}

function buildStockCharts(data) {
  return {
    widgets: [
      kv("stock-snapshot", "Stock Snapshot", [
        ["Symbol", data.symbol],
        ["Last Price", fmt(data.last_price)],
        ["Period Change", fmt(data.price_change_pct, "%")],
        ["RSI 14", fmt(data.momentum?.rsi_14)],
        ["ADX 14", fmt(data.trend?.adx_14)],
        ["Trend", data.trend?.trend_signal || "n/a"],
        ["Volume Ratio", fmt(data.volume?.volume_ratio)]
      ]),
      kv("technical-indicators", "Technical Indicators", [
        ["MACD", fmt(data.momentum?.macd)],
        ["MACD Signal", fmt(data.momentum?.macd_signal)],
        ["MACD Histogram", fmt(data.momentum?.macd_histogram)],
        ["Stoch K", fmt(data.momentum?.stoch_k)],
        ["Stoch D", fmt(data.momentum?.stoch_d)],
        ["ATR 14", fmt(data.volatility?.atr_14)]
      ]),
      kv("bollinger-bands", "Bollinger Bands", [
        ["Upper", fmt(data.volatility?.bb_upper)],
        ["Middle", fmt(data.volatility?.bb_middle)],
        ["Lower", fmt(data.volatility?.bb_lower)],
        ["Width", fmt(data.volatility?.bb_width)]
      ]),
      signals("technical-signals", "Technical Signals", data.signals)
    ],
    charts: [
      chart("price-action", "candlestick", "2Y Price Action", {
        series: data.price_series || []
      }, { fullWidth: true }),
      chart("moving-averages", "bar", "Moving Averages vs Current Price", {
        labels: ["Last", "SMA20", "SMA50", "SMA200", "EMA20", "EMA50"],
        datasets: [{
          label: "Price",
          data: [
            data.last_price,
            data.moving_averages?.sma_20,
            data.moving_averages?.sma_50,
            data.moving_averages?.sma_200,
            data.moving_averages?.ema_20,
            data.moving_averages?.ema_50
          ]
        }]
      })
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
      table("currency-commodity", "Currency & Commodity", ["Metric", "Value"], [
        ["AUD/USD", fmt(data.currencies?.aud_usd)],
        ["AUD/CNY", fmt(data.currencies?.aud_cny)],
        ["Gold", fmt(data.commodities?.gold_usd)],
        ["Oil", fmt(data.commodities?.crude_oil_usd)],
        ["Copper", fmt(data.commodities?.copper_usd)]
      ]),
      table("news", "News Headlines", ["Headline", "Publisher"], (data.news_headlines || []).map((item) => [
        item.url ? `<a href="${item.url}" target="_blank" rel="noreferrer">${item.title}</a>` : item.title,
        item.publisher || item.related_ticker || ""
      ]))
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
      { id: "macro-regime", type: "banner", text: data.summary || "Macro regime snapshot" },
      kv("rates", "Rates Environment", [
        ["Cash Rate", fmt(data.rates_environment?.rba_cash_rate, "%")],
        ["AU 10Y", fmt(data.rates_environment?.au_10y_bond_yield)],
        ["Yield Curve", fmt(data.rates_environment?.yield_curve_slope)],
        ["Regime", data.rates_environment?.regime || "n/a"]
      ]),
      kv("inflation", "Inflation", [
        ["CPI YoY", fmt(data.inflation?.latest_cpi_yoy, "%")],
        ["Trimmed Mean", fmt(data.inflation?.latest_trimmed_mean, "%")],
        ["Target", data.inflation?.rba_inflation_target],
        ["Above Target", data.inflation?.above_target ? "Yes" : "No"]
      ]),
      kv("china", "China Exposure", [
        ["Signal", data.china_exposure?.china_signal],
        ["Shanghai YTD", fmt(data.china_exposure?.shanghai_comp_ytd, "%")],
        ["AUD/CNY 3M", fmt(data.china_exposure?.aud_cny_3mo_change, "%")],
        ["Iron Ore Proxy YTD", fmt(data.china_exposure?.iron_ore_proxy_ytd, "%")]
      ])
    ],
    charts: [
      chart("risk-gauge", "doughnut", "Risk Sentiment", {
        labels: ["VIX", "Remaining"],
        datasets: [{ data: [data.risk_sentiment?.vix_level || 0, Math.max(0, 40 - (data.risk_sentiment?.vix_level || 0))] }]
      }),
      chart("sector-rotation", "bar", "Sector Rotation", {
        labels: ["Outperforming", "Underperforming"],
        datasets: [{ label: "Count", data: [
          data.sector_rotation?.outperforming_sectors?.length || 0,
          data.sector_rotation?.underperforming_sectors?.length || 0
        ] }]
      })
    ]
  };
}

function buildAnalysisCharts(data) {
  return {
    widgets: [
      { id: "analysis-banner", type: "banner", text: "Research View" },
      kv("analysis-process", "Analysis Process", [
        ["Technical Score", data.scores?.technical_score],
        ["Macro Score", data.scores?.macro_score],
        ["Combined Score", data.scores?.combined_score],
        ["Bullish Signals", data.scores?.signal_count_bullish],
        ["Bearish Signals", data.scores?.signal_count_bearish]
      ]),
      kv("technical-assessment", "Technical Assessment", [
        ["Overall", data.technical_assessment?.overall],
        ["Trend", data.technical_assessment?.trend_signal],
        ["Momentum", data.technical_assessment?.momentum_signal],
        ["Support", fmt(data.technical_assessment?.key_levels?.support)],
        ["Resistance", fmt(data.technical_assessment?.key_levels?.resistance)]
      ]),
      kv("macro-assessment", "Macro Assessment", [
        ["Overall", data.macro_assessment?.overall],
        ["Rates Headwind", data.macro_assessment?.rates_headwind ? "Yes" : "No"],
        ["China Tailwind", data.macro_assessment?.china_tailwind ? "Yes" : "No"],
        ["Risk Sentiment", data.macro_assessment?.risk_sentiment]
      ]),
      signals("bullish-signals", "Bullish Signals", data.bullish_signals),
      signals("bearish-signals", "Negative Drivers", data.bearish_signals),
      signals("risk-factors", "Risk Factors", data.risk_factors),
      data.narrative ? { id: "analysis-summary", type: "text", title: "Analysis Summary", text: data.narrative } : null
    ].filter(Boolean),
    charts: [
      chart("score-gauge", "doughnut", "Combined Score", {
        labels: ["Score", "Remaining"],
        datasets: [{ data: [Math.abs(data.scores?.combined_score || 0), 100 - Math.abs(data.scores?.combined_score || 0)] }]
      }),
      chart("score-breakdown", "bar", "Score Breakdown", {
        labels: ["Technical", "Macro", "Combined"],
        datasets: [{ label: "Score", data: [data.scores?.technical_score, data.scores?.macro_score, data.scores?.combined_score] }]
      }),
      chart("signal-balance", "bar", "Positive vs Negative Signals", {
        labels: ["Bullish", "Bearish"],
        datasets: [{ label: "Count", data: [data.bullish_signals?.length || 0, data.bearish_signals?.length || 0] }]
      })
    ]
  };
}

function buildRecommendationCharts(data) {
  return {
    widgets: [
      { id: "execution-banner", type: "banner", text: "Execution View" },
      { id: "recommendation-hero", type: "hero", action: data.action, confidence: data.confidence, riskLevel: data.risk_level, horizon: data.time_horizon },
      kv("recommendation-summary", "Recommendation Summary", [
        ["Action", data.action],
        ["Confidence", fmt(data.confidence, "%")],
        ["Risk Level", data.risk_level],
        ["Time Horizon", data.time_horizon],
        ["Combined Score", data.underlying_analysis?.scores?.combined_score]
      ]),
      kv("execution-plan", "Execution Plan", [
        ["Current Price", fmt(data.price_guidance?.current_price)],
        ["Entry Low", fmt(data.price_guidance?.entry_range_low)],
        ["Entry High", fmt(data.price_guidance?.entry_range_high)],
        ["Stop Loss", fmt(data.price_guidance?.stop_loss)],
        ["Target", fmt(data.price_guidance?.target_price)]
      ]),
      signals("key-reasons", "Key Reasons", data.key_reasons),
      signals("key-risks", "Key Risks", data.key_risks),
      data.narrative ? { id: "recommendation-text", type: "text", title: "Recommendation Summary", text: data.narrative } : null
    ].filter(Boolean),
    charts: [
      chart("risk-reward-chart", "bar", "Trade Setup Risk / Reward", {
        labels: ["Upside", "Downside Risk"],
        datasets: [{ label: "%", data: [data.price_guidance?.upside_pct || 0, data.price_guidance?.downside_risk_pct || 0] }]
      })
    ]
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
