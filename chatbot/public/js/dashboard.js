const chartInstances = new Map();
const resizeObservers = new Map();

function clearCharts() {
  for (const instance of chartInstances.values()) {
    if (Array.isArray(instance)) {
      instance.forEach((chart) => {
        if (chart && typeof chart.destroy === "function") chart.destroy();
      });
    } else if (instance && typeof instance.destroy === "function") {
      instance.destroy();
    }
  }
  chartInstances.clear();
  
  for (const observer of resizeObservers.values()) {
    observer.disconnect();
  }
  resizeObservers.clear();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let currentContext = { price: null };

function getIndicatorInterpretation(label, value) {
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

  // Bollinger Bands Interpretation
  if (label === "Upper" && price) {
    if (price >= val) return { text: "Price > Upper (Overbought)", class: "bearish" };
  }
  if (label === "Lower" && price) {
    if (price <= val) return { text: "Price < Lower (Oversold)", class: "bullish" };
  }
  if (label === "Width") {
    // Width interpretation is harder without history, but we can label it
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

function renderKv(widget) {
  const card = el("section", "widget");
  card.append(el("h3", null, widget.title));
  const grid = el("div", "kv-grid");
  
  for (const [label, value] of widget.rows || []) {
    // Capture price for context if this is the snapshot
    if (label === "Last Price") {
      currentContext.price = parseFloat(value);
    }

    const row = el("div", "kv-row");
    const interpretation = getIndicatorInterpretation(label, value);
    
    row.append(el("span", null, label));
    
    const strong = el("strong", null, value === null || value === undefined ? "n/a" : String(value));
    if (interpretation) {
      const badge = el("span", `sentiment-badge ${interpretation.class}`, interpretation.text);
      strong.append(badge);
    }
    row.append(strong);

    if (interpretation && interpretation.progress !== undefined) {
      const bar = el("div", "indicator-bar");
      const fill = el("div", `indicator-bar-fill ${label.toLowerCase().includes("rsi") ? "rsi" : "adx"}`);
      fill.style.width = `${Math.min(100, Math.max(0, interpretation.progress))}%`;
      bar.append(fill);
      row.append(bar);
    }
    
    grid.append(row);
  }
  card.append(grid);
  return card;
}

function renderSignals(widget) {
  const card = el("section", "widget");
  card.append(el("h3", null, widget.title));
  const list = el("ul", "signals");
  for (const item of widget.items?.length ? widget.items : ["No signals returned"]) {
    list.append(el("li", null, item));
  }
  card.append(list);
  return card;
}

function renderTable(widget) {
  const card = el("section", "widget full-width");
  card.append(el("h3", null, widget.title));
  const table = el("table", "data-table");
  const thead = el("thead");
  const headRow = el("tr");
  for (const column of widget.columns || []) headRow.append(el("th", null, column));
  thead.append(headRow);
  const tbody = el("tbody");
  for (const row of widget.rows || []) {
    const tr = el("tr");
    for (const cell of row) {
      const td = el("td");
      td.innerHTML = cell ?? "";
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(thead, tbody);
  card.append(table);
  return card;
}

function renderBanner(widget) {
  const card = el("section", "widget banner");
  card.textContent = widget.text;
  return card;
}

function renderHero(widget) {
  const card = el("section", `widget hero ${widget.action || ""}`);
  card.innerHTML = `
    <div class="action">${widget.action || "HOLD"}</div>
    <div style="font-weight: 600; opacity: 0.9;">${widget.confidence ?? "n/a"}% Confidence</div>
    <div style="font-size: 13px; opacity: 0.8;">${widget.riskLevel || "n/a"} risk • ${widget.horizon || "n/a"} horizon</div>
  `;
  return card;
}

function renderText(widget) {
  const card = el("section", "widget full-width");
  card.append(el("h3", null, widget.title));
  const body = el("div");
  body.textContent = widget.text;
  card.append(body);
  return card;
}

function renderWidget(widget) {
  if (widget.type === "kv") return renderKv(widget);
  if (widget.type === "signals") return renderSignals(widget);
  if (widget.type === "table") return renderTable(widget);
  if (widget.type === "banner") return renderBanner(widget);
  if (widget.type === "hero") return renderHero(widget);
  if (widget.type === "text") return renderText(widget);
  return el("section", "widget", widget.title || widget.id);
}

function renderCandlestick(panel, descriptor) {
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
    },
    grid: {
      vertLines: { color: lineColor },
      horzLines: { color: lineColor },
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.1, bottom: 0.35 } // Leave space at bottom for indicators
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

  // Price Series
  const candleSeries = chart.addCandlestickSeries({
    upColor: "#10b981",
    downColor: "#ef4444",
    borderVisible: false,
    wickUpColor: "#10b981",
    wickDownColor: "#ef4444",
  });

  // Overlays
  const ma20 = chart.addLineSeries({ color: "#38bdf8", lineWidth: 2, priceLineVisible: false });
  const ma50 = chart.addLineSeries({ color: "#a78bfa", lineWidth: 2, priceLineVisible: false });

  // Volume (Separate scale)
  const volumeSeries = chart.addHistogramSeries({
    priceScaleId: "volume",
    color: "#38bdf8",
    priceFormat: { type: "volume" },
    priceLineVisible: false,
  });
  chart.priceScale("volume").applyOptions({
    scaleMargins: { top: 0.7, bottom: 0.15 }, // Overlap bottom of price, above MACD
  });

  // MACD (Separate scale)
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
    scaleMargins: { top: 0.85, bottom: 0 }, // Very bottom
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
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    })));
    
    ma20.setData(visible.filter((c) => c.sma_20 != null).map((c) => ({ time: c.time, value: c.sma_20 })));
    ma50.setData(visible.filter((c) => c.sma_50 != null).map((c) => ({ time: c.time, value: c.sma_50 })));

    volumeSeries.setData(visible.filter((c) => c.volume != null).map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(16, 185, 129, 0.5)" : "rgba(239, 68, 68, 0.5)"
    })));

    macdHist.setData(visible.filter((c) => c.macd_histogram != null).map((c) => ({
      time: c.time,
      value: c.macd_histogram,
      color: c.macd_histogram >= 0 ? "rgba(56, 189, 248, 0.5)" : "rgba(239, 68, 68, 0.5)"
    })));
    macdLine.setData(visible.filter((c) => c.macd != null).map((c) => ({ time: c.time, value: c.macd })));
    macdSignal.setData(visible.filter((c) => c.macd_signal != null).map((c) => ({ time: c.time, value: c.macd_signal })));

    chart.timeScale().fitContent();
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.range === rangeKey));
  };

  // Resize handling
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

function renderChart(descriptor) {
  const panel = el("section", `chart-panel ${descriptor.fullWidth ? "full-width" : ""}`);
  panel.append(el("h3", null, descriptor.title));
  
  if (descriptor.type === "candlestick") {
    renderCandlestick(panel, descriptor);
    return panel;
  }
  
  const host = el("div", "chart-host");
  const canvas = el("canvas");
  host.append(canvas);
  panel.append(host);
  
  const isDark = document.body.classList.contains("dark") || !document.body.classList.contains("light");
  const textColor = isDark ? "#94a3b8" : "#64748b";
  
  const price = currentContext.price;
  const datasets = (descriptor.config?.datasets || []).map((dataset) => {
    const isMA = descriptor.title.includes("Moving Averages");
    const data = dataset.data || [];
    
    return {
      backgroundColor: isMA ? data.map(val => (price > val ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)")) : ["#38bdf8", "#ef4444", "#10b981", "#a78bfa", "#f59e0b", "#94a3b8"],
      borderColor: "transparent",
      ...dataset
    };
  });

  const config = {
    type: descriptor.type,
    data: {
      labels: descriptor.config?.labels || [],
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: textColor, font: { family: "'Inter', sans-serif" } }
        }
      },
      scales: descriptor.type === "doughnut" ? undefined : {
        x: { grid: { display: false }, ticks: { color: textColor } },
        y: { beginAtZero: false, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: textColor } }
      }
    }
  };
  
  const chart = new Chart(canvas, config);
  chartInstances.set(descriptor.id, chart);
  
  const observer = new ResizeObserver(() => {
    chart.resize();
  });
  observer.observe(host);
  resizeObservers.set(descriptor.id, observer);
  
  return panel;
}

export function render(response) {
  const dashboard = document.getElementById("dashboard");
  const subtitle = document.getElementById("dashboard-subtitle");
  
  // Reset context
  currentContext.price = null;
  
  clearCharts();
  dashboard.innerHTML = "";
  dashboard.classList.remove("empty");
  subtitle.textContent = response.tool ? `Latest tool: ${response.tool}` : "Structured results";

  const charts = response.charts || [];
  const widgets = response.widgets || [];
  
  // Step 1: Find price in snapshot widgets first to set context
  for (const widget of widgets) {
    if (widget.type === "kv") {
      for (const [label, value] of widget.rows || []) {
        if (label === "Last Price") currentContext.price = parseFloat(value);
      }
    }
  }

  // Render full-width charts first
  for (const chart of charts.filter((item) => item.fullWidth)) {
    dashboard.append(renderChart(chart));
  }
  
  // Render widgets
  for (const widget of widgets) {
    dashboard.append(renderWidget(widget));
  }
  
  // Render remaining charts
  for (const chart of charts.filter((item) => !item.fullWidth)) {
    dashboard.append(renderChart(chart));
  }
}

