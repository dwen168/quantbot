import { el } from "./dashboard-components.js";

export function renderHero(widget) {
  const sentiment = widget.action === "BUY" ? "bullish" : widget.action === "SELL" ? "bearish" : "neutral";
  const card = el("section", `widget hero ${sentiment}`);
  card.innerHTML = `
    <div class="hero-top">
      <div class="hero-identity">
        <span class="hero-symbol">${widget.symbol || ""}</span>
        <h2 class="hero-name">${widget.companyName || "Recommendation Report"}</h2>
      </div>
      <div class="hero-price-block">
        <span class="hero-price">${widget.price != null ? '$' + widget.price : "n/a"}</span>
        <span class="hero-price-label">Current Quote</span>
      </div>
    </div>
    <div class="hero-verdict-row">
      <div class="hero-action-badge ${sentiment}">${widget.action || "HOLD"}</div>
      <div class="hero-conviction-block">
        <div class="hero-stat">
          <span class="hero-stat-label">Conviction</span>
          <span class="hero-stat-value">${widget.conviction ?? "n/a"}%</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Risk Profile</span>
          <span class="hero-stat-value ${widget.riskLevel === 'HIGH' ? 'bearish' : widget.riskLevel === 'LOW' ? 'bullish' : 'neutral'}">${widget.riskLevel || "n/a"}</span>
        </div>
        <div class="hero-stat">
          <span class="hero-stat-label">Horizon</span>
          <span class="hero-stat-value">${widget.horizon || "n/a"}</span>
        </div>
      </div>
    </div>
  `;
  return card;
}

export function renderPricePlan(widget) {
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
