export const chartInstances = new Map();
export const resizeObservers = new Map();
export const currentContext = { price: null };

export function clearCharts() {
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

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function refreshTheme() {
  const isDark = document.body.classList.contains("dark") || !document.body.classList.contains("light");
  const textColor = isDark ? "#94a3b8" : "#64748b";
  const lineColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";

  for (const [id, instance] of chartInstances.entries()) {
    if (instance instanceof Chart) {
      // Chart.js
      instance.options.plugins.legend.labels.color = textColor;
      if (instance.options.scales) {
        if (instance.options.scales.x) {
          instance.options.scales.x.ticks.color = textColor;
          instance.options.scales.x.grid.color = lineColor;
        }
        if (instance.options.scales.y) {
          instance.options.scales.y.ticks.color = textColor;
          instance.options.scales.y.grid.color = lineColor;
        }
      }
      instance.update();
    } else if (instance && typeof instance.applyOptions === "function") {
      // Lightweight Charts
      instance.applyOptions({
        layout: {
          textColor: textColor
        },
        grid: {
          vertLines: { color: lineColor },
          horzLines: { color: lineColor }
        }
      });
    }
  }
}

// Generic Widgets

export function renderKv(widget, getIndicatorExplanation, getIndicatorInterpretation) {
  const card = el("section", "widget");
  card.append(el("h3", null, widget.title));
  if (widget.description) {
    const desc = el("p", "widget-description");
    desc.textContent = widget.description;
    card.append(desc);
  }
  const grid = el("div", "kv-grid");
  
  for (const [label, value] of widget.rows || []) {
    if (label === "Last Price") {
      currentContext.price = parseFloat(value);
    }

    const row = el("div", "kv-row");
    const interpretation = widget.hideBadges ? null : (getIndicatorInterpretation ? getIndicatorInterpretation(label, value) : null);
    
    const labelSpan = el("span", "kv-label", label);
    const explanation = getIndicatorExplanation ? getIndicatorExplanation(label) : null;
    if (explanation) {
      labelSpan.classList.add("has-tooltip");
      labelSpan.setAttribute("data-tooltip", explanation);
    }
    
    row.append(labelSpan);
    
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

export function renderSignals(widget) {
  const card = el("section", "widget");
  card.append(el("h3", null, widget.title));
  const list = el("ul", "signals");
  for (const item of widget.items?.length ? widget.items : ["No signals returned"]) {
    list.append(el("li", null, item));
  }
  card.append(list);
  return card;
}

export function renderTable(widget) {
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

export function renderNews(widget) {
  const card = el("section", `widget ${widget.fullWidth ? "full-width" : ""} news-widget`);
  card.append(el("h3", null, widget.title));
  const grid = el("div", "news-grid");
  
  for (const item of widget.items || []) {
    const article = el("a", "news-card");
    if (item.url) {
      article.href = item.url;
      article.target = "_blank";
      article.rel = "noreferrer";
    }
    const title = el("div", "news-title", item.title);
    const meta = el("div", "news-meta");
    if (item.category) {
      const tag = el("span", `news-tag tag-${item.category.toLowerCase()}`, item.category);
      meta.append(tag);
    }
    if (item.publisher || item.related_ticker) {
      const source = el("span", "news-source", item.publisher || item.related_ticker);
      meta.append(source);
    }
    article.append(title, meta);
    grid.append(article);
  }
  card.append(grid);
  return card;
}

export function renderMiniCharts(widget, getIndicatorExplanation) {
  const card = el("section", `widget ${widget.fullWidth ? "full-width" : ""}`);
  card.append(el("h3", null, widget.title));
  const grid = el("div", "mini-charts-grid");
  
  for (const item of widget.items || []) {
    const itemCard = el("div", "mini-chart-card");
    const header = el("div", "mini-chart-header");
    
    const labelSpan = el("span", "kv-label", item.label);
    const explanation = getIndicatorExplanation ? getIndicatorExplanation(item.label) : null;
    if (explanation) {
      labelSpan.classList.add("has-tooltip");
      labelSpan.setAttribute("data-tooltip", explanation);
    }
    const valStr = item.value === null || item.value === undefined ? "n/a" : String(item.value);
    const strong = el("strong", null, valStr);
    header.append(labelSpan, strong);
    itemCard.append(header);
    
    const chartContainer = el("div", "mini-chart-container");
    itemCard.append(chartContainer);
    
    if (item.series && item.series.length > 0) {
      const isDark = document.body.classList.contains("dark") || !document.body.classList.contains("light");
      const textColor = isDark ? "#94a3b8" : "#64748b";
      
      const chart = LightweightCharts.createChart(chartContainer, {
        layout: { background: { type: "solid", color: "transparent" }, textColor: textColor, fontFamily: "'Inter', sans-serif", attributionLogo: false },
        grid: { vertLines: { visible: false }, horzLines: { visible: false } },
        rightPriceScale: { visible: false },
        timeScale: { visible: false },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        handleScroll: false,
        handleScale: false
      });
      const candleSeries = chart.addCandlestickSeries({
        upColor: "#10b981", downColor: "#ef4444", borderVisible: false,
        wickUpColor: "#10b981", wickDownColor: "#ef4444"
      });
      candleSeries.setData(item.series);
      chart.timeScale().fitContent();
      
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            chart.resize(width, height);
            chart.timeScale().fitContent();
          }
        }
      });
      observer.observe(chartContainer);
      resizeObservers.set(`${widget.id}-${item.label}`, observer);
      chartInstances.set(`${widget.id}-${item.label}`, chart);
    } else {
      chartContainer.textContent = "No data";
      chartContainer.classList.add("empty-state");
    }
    grid.append(itemCard);
  }
  card.append(grid);
  return card;
}

export function renderFactors(widget) {
  const card = el("section", "widget full-width");
  card.append(el("h3", null, widget.title));
  const list = el("ul", "factors-list");
  if (!widget.items || widget.items.length === 0) {
    const li = el("li", "empty-factor", "No factors identified.");
    list.append(li);
  } else {
    for (const item of widget.items) {
      const li = el("li", "factor-item");
      const textSpan = el("span", "factor-text", item.label || item.factor || String(item));
      li.append(textSpan);
      if (item.score !== undefined) {
        let badgeClass = "neutral";
        let prefix = "";
        if (item.score > 0) { badgeClass = "bullish"; prefix = "+"; }
        else if (item.score < 0) { badgeClass = "bearish"; }
        const scoreBadge = el("span", `sentiment-badge ${badgeClass}`, `${prefix}${item.score}`);
        li.append(scoreBadge);
      } else if (item.value !== undefined) {
        const badgeClass = item.sentiment || "neutral";
        const valBadge = el("span", `sentiment-badge ${badgeClass}`, item.value);
        li.append(valBadge);
      }
      list.append(li);
    }
  }
  card.append(list);
  return card;
}

export function renderBanner(widget) {
  const card = el("section", "widget banner");
  card.textContent = widget.text;
  return card;
}

export function renderText(widget) {
  const card = el("section", "widget full-width narrative-card");
  const header = el("div", "narrative-header");
  header.append(el("h3", null, widget.title));
  card.append(header);
  const body = el("div", "narrative-body");
  const paragraphs = (widget.text || "").split(/\n+/).filter(s => s.trim());
  for (const para of paragraphs) {
    const p = el("p", "narrative-para");
    p.textContent = para.trim();
    body.append(p);
  }
  card.append(body);
  return card;
}

export function renderGroup(widget, renderWidgetFn) {
  const cols = widget.columns || 3;
  const container = el("div", `widget-group ${widget.fullWidth ? "full-width" : ""} widget-group-cols-${cols}`);
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  
  if (widget.title) {
    const card = el("section", `widget ${widget.fullWidth ? "full-width" : ""} group-card`);
    card.append(el("h3", null, widget.title));
    const innerContainer = el("div", `widget-group widget-group-cols-${cols}`);
    innerContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for (const child of widget.widgets || []) {
      const childEl = renderWidgetFn(child);
      if (childEl) innerContainer.append(childEl);
    }
    card.append(innerContainer);
    return card;
  }
  for (const child of widget.widgets || []) {
    const childEl = renderWidgetFn(child);
    if (childEl) container.append(childEl);
  }
  return container;
}

export function renderChart(descriptor) {
  const panel = el("section", `chart-panel ${descriptor.fullWidth ? "full-width" : ""}`);
  panel.append(el("h3", null, descriptor.title));
  
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
      indexAxis: descriptor.config?.indexAxis || "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: descriptor.config?.plugins?.legend?.display !== undefined ? descriptor.config.plugins.legend.display : (datasets.length > 1),
          labels: { color: textColor, font: { family: "'Inter', sans-serif" } }
        }
      },
      scales: descriptor.type === "doughnut" ? undefined : {
        x: { 
          grid: { display: descriptor.config?.indexAxis === "y", color: "rgba(255,255,255,0.05)" }, 
          ticks: { color: textColor },
          beginAtZero: true
        },
        y: { 
          beginAtZero: true, 
          grid: { display: descriptor.config?.indexAxis !== "y", color: "rgba(255,255,255,0.05)" }, 
          ticks: { color: textColor } 
        }
      }
    }
  };
  const chart = new Chart(canvas, config);
  chartInstances.set(descriptor.id, chart);
  const observer = new ResizeObserver(() => chart.resize());
  observer.observe(host);
  resizeObservers.set(descriptor.id, observer);
  return panel;
}
