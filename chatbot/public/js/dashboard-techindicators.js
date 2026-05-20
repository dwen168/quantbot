import { el, chartInstances, resizeObservers, currentContext } from "./dashboard-components.js";

export const indicatorExplanations = {
  "RSI": "Relative Strength Index: Measures momentum. > 70 is generally overbought, < 30 is oversold.",
  "MACD": "Moving Average Convergence Divergence: A trend-following momentum indicator showing the relationship between two moving averages.",
  "ADX": "Average Directional Index: Measures the strength of a trend. > 25 indicates a strong trend.",
  "Stoch": "Stochastic Oscillator: A momentum indicator. > 80 is generally overbought, < 20 is oversold.",
  "Upper": "Upper Bollinger Band: Price touching or exceeding this may indicate an overbought condition.",
  "Lower": "Lower Bollinger Band: Price touching or falling below this may indicate an oversold condition.",
  "Width": "Bollinger Band Width: Measures market volatility. Wider means high volatility.",
  "SMA": "Simple Moving Average: The average price over a specific number of periods.",
  "EMA": "Exponential Moving Average: A moving average that gives more weight to recent prices.",
  "Trend": "The general direction of the market or price of an asset.",
  "Cash Rate": "The interest rate set by the RBA for overnight loans between banks. Influences all other interest rates.",
  "AU 10Y": "Australian 10-Year Government Bond Yield. A key benchmark for long-term interest rates.",
  "Yield Curve": "The difference between long-term and short-term interest rates. An inverted curve can signal an economic slowdown.",
  "Regime": "The current macroeconomic environment classification based on rates and growth.",
  "CPI YoY": "Consumer Price Index Year-over-Year. A primary measure of broad inflation.",
  "Trimmed Mean": "Core inflation measure that excludes the most volatile price changes.",
  "Above Target": "Indicates whether current inflation is exceeding the central bank's target.",
  "Target": "The central bank's target range for inflation (e.g., 2-3% for RBA).",
  "Shanghai YTD": "Year-to-date performance of the Shanghai Composite Index. Indicates Chinese market health.",
  "AUD/CNY 3M": "3-month change in the Australian Dollar vs Chinese Yuan exchange rate. Reflects trade dynamics.",
  "Iron Ore Proxy YTD": "Year-to-date performance of major iron ore miners. Serves as a proxy for Chinese industrial demand.",
  "Signal": "Overall algorithmic assessment (e.g., bullish/bearish, tailwind/headwind).",
  "Level": "Current index level.",
  "1D": "1-day percentage change.",
  "Technical Score": "Quantitative score (-100 to +100) based on momentum, trend, moving averages, and volatility.",
  "Macro Score": "Quantitative score (-100 to +100) based on interest rates, China exposure, commodities, and risk sentiment.",
  "Combined Score": "Weighted combination of Technical (60%) and Macro (40%) scores. > 40 implies Buy, < -40 implies Sell.",
  "1M": "1-month percentage change.",
  "YTD": "Year-to-date percentage change.",
  "Direction": "Current direction of central bank monetary policy.",
  "Last Change": "Date of the last policy rate change.",
  "Change": "Magnitude of the last policy rate change.",
  "AUD/USD": "Australian Dollar vs US Dollar exchange rate.",
  "Gold": "Gold price in USD per ounce. Often viewed as a safe-haven asset.",
  "Oil": "Crude oil price in USD. A key driver of global inflation and economic costs.",
  "Copper": "Copper price in USD. Often seen as a leading indicator of global economic health."
};

export function getIndicatorExplanation(label) {
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
