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

const indicatorExplanations = {
  // Technical Indicators
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
  
  // Macro Anchors
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
  
  // Macro Info & General
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

function getIndicatorExplanation(label) {
  for (const [key, text] of Object.entries(indicatorExplanations)) {
    if (label.includes(key)) return text;
  }
  return null;
}

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
  if (widget.description) {
    const desc = el("p", "widget-description");
    desc.textContent = widget.description;
    card.append(desc);
  }
  const grid = el("div", "kv-grid");
  
  for (const [label, value] of widget.rows || []) {
    // Capture price for context if this is the snapshot
    if (label === "Last Price") {
      currentContext.price = parseFloat(value);
    }

    const row = el("div", "kv-row");
    // Respect the directive: if hideBadges is set, don't show qualitative signal words
    const interpretation = widget.hideBadges ? null : getIndicatorInterpretation(label, value);
    
    const labelSpan = el("span", "kv-label", label);
    const explanation = getIndicatorExplanation(label);
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

function renderNews(widget) {
  const card = el("section", "widget full-width news-widget");
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
    if (item.publisher || item.related_ticker) {
      meta.textContent = item.publisher || item.related_ticker;
    }
    
    article.append(title, meta);
    grid.append(article);
  }
  
  card.append(grid);
  return card;
}

function renderMiniCharts(widget) {
  const card = el("section", "widget full-width");
  card.append(el("h3", null, widget.title));
  
  const grid = el("div", "mini-charts-grid");
  
  for (const item of widget.items || []) {
    const itemCard = el("div", "mini-chart-card");
    const header = el("div", "mini-chart-header");
    
    const labelSpan = el("span", "kv-label", item.label);
    const explanation = getIndicatorExplanation(item.label);
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

function renderFactors(widget) {
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
      
      // Support for numeric score badges
      if (item.score !== undefined) {
        let badgeClass = "neutral";
        let prefix = "";
        if (item.score > 0) { badgeClass = "bullish"; prefix = "+"; }
        else if (item.score < 0) { badgeClass = "bearish"; }
        
        const scoreBadge = el("span", `sentiment-badge ${badgeClass}`, `${prefix}${item.score}`);
        li.append(scoreBadge);
      } 
      // Support for descriptive value badges (like Sector Rotation)
      else if (item.value !== undefined) {
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

function renderStockHero(widget) {
  // Trend determines the overall card sentiment if present
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

  const volRatio = widget.volumeRatio != null ? parseFloat(widget.volumeRatio).toFixed(2) : "n/a";
  const volNote = parseFloat(volRatio) > 1.5 ? "high" : parseFloat(volRatio) < 0.7 ? "low" : "normal";

  const card = el("section", `widget full-width stock-hero-card ${widget.trend ? trendSentiment : changeClass}`);
  
  // Conditionally render the trend chip ONLY if a trend word is provided (for individual stocks, not snapshots)
  const trendChipHtml = widget.trend 
    ? `<span class="stock-meta-chip ${trendSentiment}">${widget.trend}</span>`
    : "";
  const trendNoteHtml = widget.trend
    ? `<span class="stock-hero-trend-note">Current Technical Trend</span>`
    : "";

  card.innerHTML = `
    <div class="stock-hero-left">
      <div class="stock-hero-symbol">${widget.symbol || "—"}</div>
      <div class="stock-hero-price">${widget.price != null ? '$' + widget.price : "n/a"}</div>
      <div class="stock-hero-price-label">Last Price (AUD)</div>
    </div>
    <div class="stock-hero-divider"></div>
    <div class="stock-hero-right">
      ${trendChipHtml ? `<div class="stock-hero-trend-row">${trendChipHtml}${trendNoteHtml}</div>` : ""}
      <div class="stock-hero-stats">
        <div class="stock-hero-stat">
          <span class="stock-stat-label">${widget.trend ? '2Y Period Change' : 'Today\'s Change'}</span>
          <span class="stock-stat-value ${changeClass}">${changeLabel}</span>
        </div>
        <div class="stock-hero-stat">
          <span class="stock-stat-label">Volume Ratio</span>
          <span class="stock-stat-value neutral">×${volRatio} <em>(${volNote})</em></span>
        </div>
      </div>
    </div>
  `;
  return card;
}
function renderMacroHero(widget) {
  const card = el("section", "widget full-width macro-hero-card");
  
  const getRegimeColor = (r) => {
    if (r === "RESTRICTIVE") return "bearish";
    if (r === "ACCOMMODATIVE") return "bullish";
    return "neutral";
  };
  const getChinaColor = (c) => {
    if (c === "POSITIVE") return "bullish";
    if (c === "NEGATIVE") return "bearish";
    return "neutral";
  };
  const getVixColor = (v) => {
    if (v === "LOW") return "bullish";
    if (v === "NORMAL") return "neutral";
    return "bearish"; // ELEVATED or EXTREME
  };

  card.innerHTML = `
    <div class="macro-hero-header">
      <h3 class="macro-hero-title">Macro Anchors Snapshot</h3>
      <p class="macro-hero-summary">${widget.summary || ""}</p>
    </div>
    <div class="macro-hero-badges">
      <div class="macro-badge">
        <span class="macro-badge-label">Rates Regime</span>
        <span class="macro-badge-value ${getRegimeColor(widget.regime)}">${widget.regime}</span>
      </div>
      <div class="macro-badge">
        <span class="macro-badge-label">China Signal</span>
        <span class="macro-badge-value ${getChinaColor(widget.chinaSignal)}">${widget.chinaSignal}</span>
      </div>
      <div class="macro-badge">
        <span class="macro-badge-label">Risk (VIX)</span>
        <span class="macro-badge-value ${getVixColor(widget.vixRegime)}">${widget.vixRegime}</span>
      </div>
    </div>
  `;
  return card;
}

function renderMaTable(widget) {
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

function renderText(widget) {
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

function renderScoreHero(widget) {
  const score  = widget.combinedScore ?? 0;
  const techScore  = widget.techScore  ?? 0;
  const macroScore = widget.macroScore ?? 0;

  let verdict = "NEUTRAL", sentiment = "neutral";
  if      (score >=  40) { verdict = "STRONG BULLISH"; sentiment = "bullish"; }
  else if (score >=  15) { verdict = "BULLISH";        sentiment = "bullish"; }
  else if (score <= -40) { verdict = "STRONG BEARISH"; sentiment = "bearish"; }
  else if (score <= -15) { verdict = "BEARISH";        sentiment = "bearish"; }

  const card = el("section", `widget full-width score-hero-card ${sentiment}`);

  const scoreStr     = score     > 0 ? `+${score}`     : String(score);
  const techStr      = techScore  > 0 ? `+${techScore}`  : String(techScore);
  const macroStr     = macroScore > 0 ? `+${macroScore}` : String(macroScore);
  const techContrib  = Math.round(techScore  * 0.6);
  const macroContrib = Math.round(macroScore * 0.4);
  const tcStr = techContrib  > 0 ? `+${techContrib}`  : String(techContrib);
  const mcStr = macroContrib > 0 ? `+${macroContrib}` : String(macroContrib);

  card.innerHTML = `
    <div class="sh-top">
      <div class="sh-verdict-block">
        <span class="sh-eyebrow">Research Verdict</span>
        <span class="sh-verdict ${sentiment}">${verdict}</span>
      </div>
      <div class="sh-score-block">
        <span class="sh-eyebrow">Combined Score</span>
        <span class="sh-score ${sentiment}">${scoreStr}</span>
      </div>
      <div class="sh-chips">
        <span class="sh-chip bullish">&#9650; ${widget.bullishCount ?? 0} bullish</span>
        <span class="sh-chip bearish">&#9660; ${widget.bearishCount ?? 0} bearish</span>
      </div>
    </div>
    <div class="sh-formula-bar">
      <span class="sh-formula-label">Score breakdown</span>
      <div class="sh-formula">
        <span class="sh-f-cat">Technical</span>
        <span class="sh-f-raw">${techStr}</span>
        <span class="sh-f-weight">\xd7 60%</span>
        <span class="sh-f-contrib ${techContrib >= 0 ? 'pos' : 'neg'}">${tcStr}</span>
        <span class="sh-f-op">+</span>
        <span class="sh-f-cat">Macro</span>
        <span class="sh-f-raw">${macroStr}</span>
        <span class="sh-f-weight">\xd7 40%</span>
        <span class="sh-f-contrib ${macroContrib >= 0 ? 'pos' : 'neg'}">${mcStr}</span>
        <span class="sh-f-op">=</span>
        <span class="sh-f-total ${sentiment}">${scoreStr}</span>
      </div>
    </div>
  `;
  return card;
}

function renderGroup(widget) {
  const cols = widget.columns || 3;
  const container = el("div", `widget-group full-width widget-group-cols-${cols}`);
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  for (const child of widget.widgets || []) {
    const childEl = renderWidget(child);
    if (childEl) container.append(childEl);
  }
  return container;
}

function renderMetricExplain(widget) {
  const card = el("section", `widget metric-explain-card ${widget.sentiment || "neutral"}`);

  const labelRow = el("div", "metric-explain-label");
  labelRow.textContent = widget.label;
  card.append(labelRow);

  const valueEl = el("div", `metric-explain-value ${widget.sentiment || ""}`);
  valueEl.textContent = widget.value;
  card.append(valueEl);

  if (widget.description) {
    const desc = el("p", "widget-description", widget.description);
    desc.style.marginTop = "8px";
    desc.style.marginBottom = "12px";
    card.append(desc);
  }

  if (widget.methodology) {
    const details = el("details", "metric-methodology");
    const summary = el("summary", null, "How is this calculated? ▾");
    const body = el("p", "metric-methodology-text", widget.methodology);
    details.append(summary, body);
    card.append(details);
  }

  return card;
}

function renderPricePlan(widget) {
  const card = el("section", "widget price-plan-card");
  card.append(el("h3", null, widget.title));
  if (widget.description) {
    const desc = el("p", "widget-description", widget.description);
    card.append(desc);
  }
  const table = el("div", "price-plan-table");
  for (const row of widget.rows || []) {
    const rowEl = el("div", "price-plan-row");
    const left = el("div", "price-plan-left");
    left.append(el("span", "price-plan-label", row.label));
    if (row.note) {
      const note = el("span", "price-plan-note", row.note);
      left.append(note);
    }
    const right = el("div", "price-plan-value", row.value ?? "n/a");
    rowEl.append(left, right);
    table.append(rowEl);
  }
  card.append(table);
  return card;
}

function renderWidget(widget) {
  if (widget.type === "group") return renderGroup(widget);
  if (widget.type === "score-hero") return renderScoreHero(widget);
  if (widget.type === "stock-hero") return renderStockHero(widget);
  if (widget.type === "macro-hero") return renderMacroHero(widget);
  if (widget.type === "ma-table") return renderMaTable(widget);
  if (widget.type === "metric-explain") return renderMetricExplain(widget);
  if (widget.type === "price-plan") return renderPricePlan(widget);
  if (widget.type === "kv") return renderKv(widget);
  if (widget.type === "signals") return renderSignals(widget);
  if (widget.type === "factors") return renderFactors(widget);
  if (widget.type === "table") return renderTable(widget);
  if (widget.type === "news") return renderNews(widget);
  if (widget.type === "mini-charts") return renderMiniCharts(widget);
  if (widget.type === "banner") return renderBanner(widget);
  if (widget.type === "hero") return renderHero(widget);
  if (widget.type === "text") return renderText(widget);
  if (widget.isChart) return renderChart(widget);
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
      attributionLogo: false,
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

let sessionCounter = 0;

export function clearDashboard() {
  const dashboard = document.getElementById("dashboard");
  clearCharts();
  dashboard.innerHTML = "";
  dashboard.classList.add("empty");
  sessionCounter = 0;
}

export function render(response, sessionId) {
  const dashboard = document.getElementById("dashboard");
  const subtitle = document.getElementById("dashboard-subtitle");

  // Remove empty state
  dashboard.classList.remove("empty");

  // Reset context for this render
  currentContext.price = null;

  // Create a new section for this response
  const section = document.createElement("div");
  section.className = "dashboard-session";
  section.id = `dashboard-session-${sessionId}`;

  // Session header
  const header = document.createElement("div");
  header.className = "session-divider";
  const label = document.createElement("span");
  label.className = "session-label";
  label.textContent = response.tool ? `${response.tool.replace(/_/g, " ").toUpperCase()}` : "Response";
  header.append(label);
  section.append(header);

  const charts = response.charts || [];
  const widgets = response.widgets || [];

  // Step 1: Find price in snapshot widgets first to set context
  for (const widget of widgets) {
    if (widget.type === "kv") {
      for (const [lbl, value] of widget.rows || []) {
        if (lbl === "Last Price") currentContext.price = parseFloat(value);
      }
    }
  }

  // Render full-width charts first
  for (const chart of charts.filter((item) => item.fullWidth)) {
    section.append(renderChart(chart));
  }

  // Render widgets
  for (const widget of widgets) {
    section.append(renderWidget(widget));
  }

  // Render remaining charts
  for (const chart of charts.filter((item) => !item.fullWidth)) {
    section.append(renderChart(chart));
  }

  dashboard.append(section);
  subtitle.textContent = response.tool ? `Last: ${response.tool}` : "Results";

  // Scroll the new section into view smoothly
  requestAnimationFrame(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  return sessionId;
}

export function highlightDashboardSession(sessionId) {
  // Remove previous highlights
  document.querySelectorAll(".dashboard-session.active").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(`dashboard-session-${sessionId}`);
  if (target) {
    target.classList.add("active");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
