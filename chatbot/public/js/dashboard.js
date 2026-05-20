import { 
  el, 
  clearCharts, 
  refreshTheme, 
  currentContext, 
  renderKv, 
  renderSignals, 
  renderTable, 
  renderNews, 
  renderMiniCharts, 
  renderFactors, 
  renderBanner, 
  renderText, 
  renderGroup, 
  renderChart 
} from "./dashboard-components.js";

import { 
  getIndicatorExplanation, 
  getIndicatorInterpretation, 
  renderStockHero, 
  renderMaTable, 
  renderCandlestick 
} from "./dashboard-techindicators.js";

import { renderMacroHero } from "./dashboard-macroregime.js";
import { renderScoreHero, renderMetricExplain } from "./dashboard-analyzestock.js";
import { renderHero, renderPricePlan } from "./dashboard-recommmendstock.js";

// Re-export for app.js
export { refreshTheme };

function renderWidget(widget) {
  if (widget.type === "group") return renderGroup(widget, renderWidget);
  if (widget.type === "score-hero") return renderScoreHero(widget);
  if (widget.type === "stock-hero") return renderStockHero(widget);
  if (widget.type === "macro-hero") return renderMacroHero(widget);
  if (widget.type === "ma-table") return renderMaTable(widget);
  if (widget.type === "metric-explain") return renderMetricExplain(widget);
  if (widget.type === "price-plan") return renderPricePlan(widget);
  if (widget.type === "kv") return renderKv(widget, getIndicatorExplanation, getIndicatorInterpretation);
  if (widget.type === "signals") return renderSignals(widget);
  if (widget.type === "factors") return renderFactors(widget);
  if (widget.type === "table") return renderTable(widget);
  if (widget.type === "news") return renderNews(widget);
  if (widget.type === "mini-charts") return renderMiniCharts(widget, getIndicatorExplanation);
  if (widget.type === "banner") return renderBanner(widget);
  if (widget.type === "hero") return renderHero(widget);
  if (widget.type === "text") return renderText(widget);
  
  if (widget.isChart) {
    if (widget.type === "candlestick") {
      const panel = el("section", `chart-panel ${widget.fullWidth ? "full-width" : ""}`);
      panel.append(el("h3", null, widget.title));
      renderCandlestick(panel, widget);
      return panel;
    }
    return renderChart(widget);
  }
  return el("section", "widget", widget.title || widget.id);
}

export function clearDashboard() {
  const dashboard = document.getElementById("dashboard");
  clearCharts();
  dashboard.innerHTML = "";
  dashboard.classList.add("empty");
  dashboard.classList.remove("loading");
}

export function showSkeletons() {
  const dashboard = document.getElementById("dashboard");
  dashboard.classList.remove("empty");
  dashboard.classList.add("loading");
  
  const container = el("div", "dashboard-session skeleton-session");
  const hero = el("div", "skeleton-widget skeleton-hero");
  hero.innerHTML = `
    <div class="skeleton-row" style="justify-content: space-between">
      <div class="skeleton skeleton-title" style="width: 30%"></div>
      <div class="skeleton skeleton-title" style="width: 20%"></div>
    </div>
    <div class="skeleton skeleton-text" style="height: 60px; margin-top: 20px"></div>
    <div class="skeleton-row" style="margin-top: 20px">
      <div class="skeleton skeleton-circle"></div>
      <div class="skeleton skeleton-text-short"></div>
    </div>
  `;
  container.append(hero);

  const chart = el("div", "skeleton-widget full-width");
  chart.innerHTML = `
    <div class="skeleton skeleton-title"></div>
    <div class="skeleton skeleton-chart"></div>
  `;
  container.append(chart);

  const kv = el("div", "skeleton-widget");
  kv.innerHTML = `
    <div class="skeleton skeleton-title" style="margin-bottom: 20px"></div>
    <div class="skeleton-row"><div class="skeleton skeleton-text"></div></div>
    <div class="skeleton-row"><div class="skeleton skeleton-text"></div></div>
    <div class="skeleton-row"><div class="skeleton skeleton-text-short"></div></div>
    <div class="skeleton-row"><div class="skeleton skeleton-text"></div></div>
  `;
  container.append(kv);

  dashboard.append(container);
  requestAnimationFrame(() => {
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function clearSkeletons() {
  const dashboard = document.getElementById("dashboard");
  dashboard.classList.remove("loading");
  document.querySelectorAll(".skeleton-session").forEach(el => el.remove());
}

export function render(response, sessionId) {
  const dashboard = document.getElementById("dashboard");
  const subtitle = document.getElementById("dashboard-subtitle");
  dashboard.classList.remove("empty");
  currentContext.price = null;

  const section = document.createElement("div");
  section.className = "dashboard-session";
  section.id = `dashboard-session-${sessionId}`;

  const header = document.createElement("div");
  header.className = "session-divider";
  const label = document.createElement("span");
  label.className = "session-label";
  label.textContent = response.tool ? `${response.tool.replace(/_/g, " ").toUpperCase()}` : "Response";
  header.append(label);

  if (response.isMock) {
    const mockBadge = document.createElement("span");
    mockBadge.className = "mock-badge";
    mockBadge.textContent = "Mock Data";
    mockBadge.title = "This data is simulated for demonstration purposes.";
    header.append(mockBadge);
  }

  section.append(header);

  const charts = response.charts || [];
  const widgets = response.widgets || [];

  for (const widget of widgets) {
    if (widget.type === "kv") {
      for (const [lbl, value] of widget.rows || []) {
        if (lbl === "Last Price") currentContext.price = parseFloat(value);
      }
    }
  }

  for (const widget of widgets.filter(w => w.fullWidth)) {
    section.append(renderWidget(widget));
  }
  for (const chart of charts.filter((item) => item.fullWidth)) {
    const chartEl = chart.type === "candlestick" ? (function(){
       const panel = el("section", `chart-panel full-width`);
       panel.append(el("h3", null, chart.title));
       renderCandlestick(panel, chart);
       return panel;
    })() : renderChart(chart);
    section.append(chartEl);
  }
  for (const widget of widgets.filter(w => !w.fullWidth)) {
    section.append(renderWidget(widget));
  }
  for (const chart of charts.filter((item) => !item.fullWidth)) {
    section.append(renderChart(chart));
  }

  dashboard.append(section);
  subtitle.textContent = response.tool ? `Last: ${response.tool}` : "Results";
  requestAnimationFrame(() => {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return sessionId;
}

export function highlightDashboardSession(sessionId) {
  document.querySelectorAll(".dashboard-session.active").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`dashboard-session-${sessionId}`);
  if (target) {
    target.classList.add("active");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
