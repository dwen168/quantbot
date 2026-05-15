const chartInstances = new Map();

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
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderKv(widget) {
  const card = el("section", "widget");
  card.append(el("h3", null, widget.title));
  const grid = el("div", "kv-grid");
  for (const [label, value] of widget.rows || []) {
    const row = el("div", "kv-row");
    row.append(el("span", null, label));
    row.append(el("strong", null, value === null || value === undefined ? "n/a" : String(value)));
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
    <div>${widget.confidence ?? "n/a"}% confidence</div>
    <div>${widget.riskLevel || "n/a"} risk - ${widget.horizon || "n/a"} horizon</div>
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
  host.style.width = "100%";
  host.style.height = "600px";
  panel.append(host);

  const series = descriptor.config?.series || [];
  const candles = series.filter((c) => c.open !== null && c.high !== null && c.low !== null && c.close !== null);

  const chart = LightweightCharts.createChart(host, {
    width: host.clientWidth,
    height: 600,
    layout: {
      background: { color: "transparent" },
      textColor: getComputedStyle(document.body).getPropertyValue("--text").trim()
    },
    grid: { vertLines: { color: "rgba(120,120,120,0.15)" }, horzLines: { color: "rgba(120,120,120,0.15)" } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, visible: true },
    crosshair: { horzLine: { visible: true }, vertLine: { visible: true } }
  });

  const candleSeries = chart.addCandlestickSeries({
    upColor: "#16a34a",
    downColor: "#dc2626",
    borderVisible: false,
    wickUpColor: "#16a34a",
    wickDownColor: "#dc2626"
  });
  const ma20 = chart.addLineSeries({ color: "#0f766e", lineWidth: 2 });
  const ma50 = chart.addLineSeries({ color: "#7c3aed", lineWidth: 2 });

  const volumeSeries = chart.addHistogramSeries({
    priceScaleId: "volume",
    color: "#0f766e",
    priceFormat: { type: "volume" },
    priceLineVisible: false,
    scaleMargins: { top: 0.66, bottom: 0.08 }
  });

  const macdHist = chart.addHistogramSeries({
    priceScaleId: "macd",
    color: "#2563eb",
    priceFormat: { type: "price" },
    priceLineVisible: false,
    scaleMargins: { top: 0.84, bottom: 0 }
  });
  const macdLine = chart.addLineSeries({ color: "#f59e0b", lineWidth: 2, priceScaleId: "macd" });
  const macdSignal = chart.addLineSeries({
    color: "#7c3aed",
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    priceScaleId: "macd"
  });

  const updateSeries = (rangeKey) => {
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
    ma20.setData(visible.filter((c) => c.sma_20 !== null && c.sma_20 !== undefined).map((c) => ({ time: c.time, value: c.sma_20 })));
    ma50.setData(visible.filter((c) => c.sma_50 !== null && c.sma_50 !== undefined).map((c) => ({ time: c.time, value: c.sma_50 })));

    volumeSeries.setData(visible.filter((c) => c.volume !== null && c.volume !== undefined).map((c) => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "#0f766e" : "#dc2626"
    })));

    macdHist.setData(visible.filter((c) => c.macd_histogram !== null && c.macd_histogram !== undefined).map((c) => ({
      time: c.time,
      value: c.macd_histogram,
      color: c.macd_histogram >= 0 ? "#2563eb" : "#ef4444"
    })));
    macdLine.setData(visible.filter((c) => c.macd !== null && c.macd !== undefined).map((c) => ({ time: c.time, value: c.macd })));
    macdSignal.setData(visible.filter((c) => c.macd_signal !== null && c.macd_signal !== undefined).map((c) => ({ time: c.time, value: c.macd_signal })));

    chart.timeScale().fitContent();
    buttons.forEach((button) => {
      button.classList.toggle("active", button.dataset.range === rangeKey);
    });
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => updateSeries(button.dataset.range));
  });

  updateSeries("2Y");
  setTimeout(() => chart.resize(host.clientWidth, 600), 0);
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
  const config = {
    type: descriptor.type,
    data: {
      labels: descriptor.config?.labels || [],
      datasets: (descriptor.config?.datasets || []).map((dataset) => ({
        backgroundColor: ["#0f766e", "#b42318", "#2563eb", "#7c3aed", "#f59e0b", "#475569"],
        borderColor: "#0f766e",
        ...dataset
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: descriptor.config?.indexAxis,
      plugins: { legend: { display: true } },
      scales: descriptor.type === "doughnut" ? undefined : { y: { beginAtZero: false } }
    }
  };
  chartInstances.set(descriptor.id, new Chart(canvas, config));
  return panel;
}

export function render(response) {
  const dashboard = document.getElementById("dashboard");
  const subtitle = document.getElementById("dashboard-subtitle");
  clearCharts();
  dashboard.innerHTML = "";
  dashboard.classList.remove("empty");
  subtitle.textContent = response.tool ? `Latest tool: ${response.tool}` : "Structured results";

  const charts = response.charts || [];
  const widgets = response.widgets || [];
  for (const chart of charts.filter((item) => item.fullWidth)) {
    dashboard.append(renderChart(chart));
  }
  for (const widget of widgets) {
    dashboard.append(renderWidget(widget));
  }
  for (const chart of charts.filter((item) => !item.fullWidth)) {
    dashboard.append(renderChart(chart));
  }
}
