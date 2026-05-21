import { el, chartInstances, resizeObservers, currentContext } from "./dashboard-components.js";

export const indicatorExplanations = {
  // --- Technical Indicators ---
  "RSI": "Relative Strength Index: Measures momentum. > 70 is overbought (risk of pullback), < 30 is oversold (potential bounce).",
  "MACD": "Moving Average Convergence Divergence: Shows the relationship between two moving averages of a security's price. Crosses are key signals.",
  "ADX": "Average Directional Index: Measures trend strength. > 25 indicates a strong trend, < 20 suggests a range-bound market.",
  "ATR": "Average True Range: A volatility indicator showing how much an asset moves, on average, during a given time frame.",
  "Stoch": "Stochastic Oscillator: A momentum indicator comparing a closing price to its price range over a period. > 80 is overbought, < 20 is oversold.",
  "Upper": "Upper Bollinger Band: Represents +2 standard deviations. Prices touching this are statistically high.",
  "Middle": "Middle Bollinger Band: The 20-period moving average that serves as the base for the Bollinger Bands.",
  "Lower": "Lower Bollinger Band: Represents -2 standard deviations. Prices touching this are statistically low.",
  "Width": "Bollinger Band Width: A volatility gauge. Narrowing 'squeeze' often precedes a major price breakout.",
  "SMA": "Simple Moving Average: The arithmetic mean of price over a specific period (e.g., 20, 50, or 200 days).",
  "EMA": "Exponential Moving Average: A moving average that places a greater weight and significance on the most recent data points.",
  "Trend": "The prevailing direction of price movement. Bullish (Up), Bearish (Down), or Neutral (Side-ways).",
  "Volume Ratio": "Current volume relative to the average. > 1.5 indicates high conviction in the current price move.",
  "Volatility": "A measure of the dispersion of returns. High volatility indicates large price swings and higher risk.",
  "Volume": "The number of shares or contracts traded. High volume confirms the strength of a price trend.",

  // --- Price Targets & Trade Planning ---
  "Support": "A price level where a downtrend tends to pause due to a concentration of demand (buying interest).",
  "Resistance": "A price level where an uptrend tends to pause due to a concentration of supply (selling interest).",
  "Stop Loss": "A pre-defined price level to exit a losing trade to prevent further capital erosion.",
  "Target Price": "The projected price level where a trade is expected to be profitable and closed.",
  "Entry": "The suggested price range or 'zone' to initiate a new position for optimal risk/reward.",

  // --- Macro & Economic (Domestic) ---
  "Cash Rate": "The RBA's target interest rate for overnight loans between banks. The anchor for all Australian interest rates.",
  "CPI YoY": "Consumer Price Index: The primary measure of inflation. RBA targets a 2-3% band.",
  "Inflation": "The rate at which the general level of prices for goods and services is rising.",
  "GDP Growth": "The annual growth rate of the Australian economy. Measures structural health.",
  "Unemployment": "The percentage of the labor force that is jobless and actively seeking work.",
  "AU 10Y": "Australian 10-Year Government Bond Yield. Reflects long-term inflation and growth expectations.",
  "Yield Curve": "The spread between long and short-term debt. An inversion (short > long) often warns of recession.",
  "Regime": "The current policy environment. Restrictive (High rates) vs Accommodative (Low rates).",
  "Energy": "The S&P/ASX 200 Energy index. Includes companies involved in the exploration, production, and distribution of oil, gas, and coal.",
  "Rates Headwind": "Indicates if rising or high interest rates are creating a negative environment for the stock.",
  "China Tailwind": "Indicates if positive economic data or demand from China is benefiting the stock.",
  "ASX Vol 20D": "The 20-day realized volatility of the ASX 200 index. Measures recent market stress.",
  "ASX200 Level": "The current price level of the S&P/ASX 200 index, Australia's primary stock market benchmark.",

  // --- Global Markets & Commodities ---
  "S&P 500": "Standard & Poor's 500: An index of 500 leading US publicly traded companies. The global equity benchmark.",
  "Nasdaq": "The tech-heavy US index. Highly sensitive to interest rate changes and growth sentiment.",
  "Shanghai": "Shanghai Composite Index: The primary indicator for the Chinese economy and a key driver for ASX miners.",
  "Hang Seng": "Hong Kong's main stock index. Reflects Asian financial sentiment and China's offshore market.",
  "AUD/USD": "The 'Aussie' dollar vs the US dollar. High levels favor importers; low levels favor exporters and miners.",
  "AUD/CNY": "The Australian Dollar vs the Chinese Yuan. Critical for trade dynamics with Australia's largest partner.",
  "Gold": "USD Gold price. Traditionally a 'safe haven' asset that rises during geopolitical stress or high inflation.",
  "Coal Proxy": "Coal Market Proxy (WHC.AX): Whitehaven Coal is used as a proxy for the Australian coal market. Reflects global demand for thermal and metallurgical coal.",
  "Crude Oil": "The global energy benchmark. High prices drive inflation and input costs for most businesses.",
  "Copper": "Often called 'Dr. Copper' because it's a leading indicator of global industrial and economic health.",
  "Iron Ore": "Australia's top export. Performance is highly correlated with Chinese infrastructure and steel demand.",

  // --- Scoring & Analysis ---
  "Technical Score": "Algorithmic score (-100 to +100) based on trend, momentum, and volatility signals.",
  "Macro Score": "Algorithmic score (-100 to +100) based on RBA policy, China data, and global risk sentiment.",
  "Combined Score": "The final weighted score (60% Tech / 40% Macro) used to generate the trade verdict.",
  "Conviction": "The statistical confidence in the current recommendation based on signal strength.",
  "Risk Level": "The estimated volatility and downside potential of the current trade setup.",
  "Verdict": "The final analyst conclusion: Buy (Bullish), Sell (Bearish), or Hold (Neutral).",
  "Risk Sentiment": "The prevailing market mood. 'Risk-On' (Bullish/Aggressive) vs 'Risk-Off' (Bearish/Defensive).",
  "VIX": "The CBOE Volatility Index. Known as the 'Fear Gauge', it rises when market uncertainty increases.",
  "Signal": "The aggregated directional indicator (e.g., Bullish/Bearish) for a specific data set.",
};

export function getIndicatorExplanation(label) {
  // Prioritize exact matches
  if (indicatorExplanations[label]) return indicatorExplanations[label];

  // Then partial matches
  for (const [key, text] of Object.entries(indicatorExplanations)) {
    if (label.includes(key)) return text;
  }
  return null;
}

export function getIndicatorInterpretation(label, value) {
  const val = parseFloat(value);
  if (isNaN(val) && typeof value !== "string") return null;

  const price = currentContext.price;

  if (label.includes("RSI")) {
    if (val >= 70) return { text: "Overbought", class: "bearish", progress: val };
    if (val <= 30) return { text: "Oversold", class: "bullish", progress: val };
    return { text: "Neutral", class: "neutral", progress: val };
  }
  
  if (label.includes("ADX")) {
    if (val >= 25) return { text: "Strong Trend", class: "bullish" };
    if (val < 20) return { text: "Weak Trend", class: "neutral" };
    return { text: "Moderate", class: "neutral" };
  }

  if (label.includes("Stoch")) {
    if (val >= 80) return { text: "Overbought", class: "bearish" };
    if (val <= 20) return { text: "Oversold", class: "bullish" };
    return { text: "Neutral", class: "neutral" };
  }

  if (label === "Upper" && price) {
    if (price >= val) return { text: "Price > Upper (Overbought)", class: "bearish" };
  }
  if (label === "Lower" && price) {
    if (price <= val) return { text: "Price < Lower (Oversold)", class: "bullish" };
  }
  if (label === "Width") {
    return { text: "Volatility Gauge", class: "neutral" };
  }
  if (label === "MACD Histogram") {
    if (val > 0) return { text: "Bullish", class: "bullish" };
    if (val < 0) return { text: "Bearish", class: "bearish" };
  }
  if (label === "Trend") {
    const v = String(value).toLowerCase();
    if (v.includes("bullish")) return { text: "Bullish", class: "bullish" };
    if (v.includes("bearish")) return { text: "Bearish", class: "bearish" };
  }
  return null;
}

export function renderStockHero(widget) {
  const trendRaw = (widget.trend || "").toLowerCase();
  const trendSentiment = trendRaw.includes("uptrend") || trendRaw.includes("bullish")
    ? "bullish"
    : trendRaw.includes("downtrend") || trendRaw.includes("bearish")
    ? "bearish"
    : "neutral";

  const change = parseFloat(widget.changePct);
  const changeUp = change >= 0;
  const changeArrow = changeUp ? "▲" : "▼";
  const changeClass = changeUp ? "bullish" : "bearish";
  const changeLabel = isNaN(change) ? "n/a" : `${changeArrow} ${Math.abs(change).toFixed(2)}%`;

  const volRatio = widget.volumeRatio != null ? parseFloat(widget.volumeRatio).toFixed(2) : null;
  const volNote = volRatio ? (parseFloat(volRatio) > 1.5 ? "high" : parseFloat(volRatio) < 0.7 ? "low" : "normal") : "";

  const card = el("section", `widget ${widget.fullWidth ? "full-width" : ""} stock-hero-card ${widget.trend ? trendSentiment : changeClass}`);
  
  const trendChipHtml = widget.trend 
    ? `<span class="stock-meta-chip ${trendSentiment}">${widget.trend}</span>`
    : "";
  const trendNoteHtml = widget.trend
    ? `<span class="stock-hero-trend-note">Current Technical Trend</span>`
    : "";

  const volHtml = volRatio ? `
    <div class="stock-hero-stat">
      <span class="stock-stat-label">Volume Ratio</span>
      <span class="stock-stat-value neutral">×${volRatio} <em>(${volNote})</em></span>
    </div>
  ` : "";

  const isIndex = widget.isIndex || (widget.symbol && (widget.symbol.includes("ASX") || widget.symbol.startsWith("^")));
  const pricePrefix = isIndex ? "" : "$";
  const priceLabel = widget.priceLabel || (isIndex ? "Index Level" : "Last Price (AUD)");

  card.innerHTML = `
    <div class="stock-hero-left">
      <div class="stock-hero-symbol">${widget.symbol || "—"}</div>
      <div class="stock-hero-price">${widget.price != null ? pricePrefix + widget.price : "n/a"}</div>
      <div class="stock-hero-price-label">${priceLabel}</div>
    </div>
    <div class="stock-hero-divider"></div>
    <div class="stock-hero-right">
      ${trendChipHtml ? `<div class="stock-hero-trend-row">${trendChipHtml}${trendNoteHtml}</div>` : ""}
      <div class="stock-hero-stats">
        <div class="stock-hero-stat">
          <span class="stock-stat-label">${widget.trend ? '2Y Period Change' : (isIndex ? 'Today\'s Change' : 'Today\'s Change')}</span>
          <span class="stock-stat-value ${changeClass}">${changeLabel}</span>
        </div>
        ${volHtml}
      </div>
    </div>
  `;
  return card;
}

export function renderMaTable(widget) {
  const card = el("section", "widget full-width ma-table-card");
  card.append(el("h3", null, widget.title));
  if (widget.description) {
    card.append(el("p", "widget-description", widget.description));
  }
  const table = el("div", "ma-table");
  for (const row of widget.rows || []) {
    const diff = parseFloat(row.diff);
    const isAbove = !isNaN(diff) && diff >= 0;
    const chip = isNaN(diff) ? "n/a" : `${isAbove ? "▲" : "▼"} ${Math.abs(diff).toFixed(2)}%`;
    const chipClass = isNaN(diff) ? "neutral" : (isAbove ? "bullish" : "bearish");

    const rowEl = el("div", "ma-row");
    rowEl.innerHTML = `
      <span class="ma-label">${row.label}</span>
      <span class="ma-period">${row.period || ""}</span>
      <span class="ma-value">${row.value}</span>
      <span class="ma-chip ${chipClass}">${chip}</span>
    `;
    table.append(rowEl);
  }
  card.append(table);
  return card;
}

export function renderCandlestick(panel, descriptor) {
  const ranges = [
    { key: "1W", label: "1W", days: 7 },
    { key: "1M", label: "1M", days: 30 },
    { key: "3M", label: "3M", days: 90 },
    { key: "6M", label: "6M", days: 180 },
    { key: "1Y", label: "1Y", days: 365 },
    { key: "2Y", label: "2Y", days: 730 }
  ];

  const controls = el("div", "chart-controls");
  const buttons = ranges.map((range) => {
    const button = el("button", "range-button", range.label);
    button.type = "button";
    button.dataset.range = range.key;
    controls.append(button);
    return button;
  });
  panel.append(controls);

  const host = el("div", "chart-host");
  panel.append(host);

  const isDark = document.body.classList.contains("dark") || !document.body.classList.contains("light");
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const lineColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  const chart = LightweightCharts.createChart(host, {
    layout: {
      background: { type: "solid", color: "transparent" },
      textColor: textColor,
      fontFamily: "'Inter', sans-serif",
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: lineColor },
      horzLines: { color: lineColor },
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.1, bottom: 0.35 }
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    handleScroll: { vertTouchDrag: false },
  });

  const candleSeries = chart.addCandlestickSeries({
    upColor: "#10b981", downColor: "#ef4444", borderVisible: false,
    wickUpColor: "#10b981", wickDownColor: "#ef4444",
  });

  const ma20 = chart.addLineSeries({ color: "#38bdf8", lineWidth: 2, priceLineVisible: false });
  const ma50 = chart.addLineSeries({ color: "#a78bfa", lineWidth: 2, priceLineVisible: false });

  const volumeSeries = chart.addHistogramSeries({
    priceScaleId: "volume",
    color: "#38bdf8",
    priceFormat: { type: "volume" },
    priceLineVisible: false,
  });
  chart.priceScale("volume").applyOptions({
    scaleMargins: { top: 0.7, bottom: 0.15 },
  });

  const macdHist = chart.addHistogramSeries({
    priceScaleId: "macd",
    priceFormat: { type: "price" },
    priceLineVisible: false,
  });
  const macdLine = chart.addLineSeries({ color: "#f59e0b", lineWidth: 1.5, priceScaleId: "macd", priceLineVisible: false });
  const macdSignal = chart.addLineSeries({
    color: "#8b5cf6",
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    priceScaleId: "macd",
    priceLineVisible: false,
  });
  chart.priceScale("macd").applyOptions({
    scaleMargins: { top: 0.85, bottom: 0 },
  });

  const series = descriptor.config?.series || [];
  const candles = series.filter((c) => c.open !== null && c.high !== null && c.low !== null && c.close !== null);

  const updateSeries = (rangeKey) => {
    if (!candles.length) return;
    const latestTime = new Date(candles[candles.length - 1]?.time);
    const range = ranges.find((item) => item.key === rangeKey) || ranges[ranges.length - 1];
    const cutoff = new Date(latestTime);
    cutoff.setDate(cutoff.getDate() - range.days);
    const visible = candles.filter((c) => new Date(c.time) >= cutoff);

    candleSeries.setData(visible.map((c) => ({
      time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
    })));
    ma20.setData(visible.filter((c) => c.sma_20 != null).map((c) => ({ time: c.time, value: c.sma_20 })));
    ma50.setData(visible.filter((c) => c.sma_50 != null).map((c) => ({ time: c.time, value: c.sma_50 })));
    volumeSeries.setData(visible.filter((c) => c.volume != null).map((c) => ({
      time: c.time, value: c.volume, color: c.close >= c.open ? "rgba(16, 185, 129, 0.5)" : "rgba(239, 68, 68, 0.5)"
    })));
    macdHist.setData(visible.filter((c) => c.macd_histogram != null).map((c) => ({
      time: c.time, value: c.macd_histogram, color: c.macd_histogram >= 0 ? "rgba(56, 189, 248, 0.5)" : "rgba(239, 68, 68, 0.5)"
    })));
    macdLine.setData(visible.filter((c) => c.macd != null).map((c) => ({ time: c.time, value: c.macd })));
    macdSignal.setData(visible.filter((c) => c.macd_signal != null).map((c) => ({ time: c.time, value: c.macd_signal })));

    chart.timeScale().fitContent();
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.range === rangeKey));
  };

  const observer = new ResizeObserver(entries => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect;
      if (width > 0) {
        chart.resize(width, height || 500);
        chart.timeScale().fitContent();
      }
    }
  });
  observer.observe(host);
  resizeObservers.set(descriptor.id, observer);

  buttons.forEach((button) => {
    button.addEventListener("click", () => updateSeries(button.dataset.range));
  });

  updateSeries("1Y");
  chartInstances.set(descriptor.id, chart);
}
