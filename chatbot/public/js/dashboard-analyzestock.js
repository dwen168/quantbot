import { el } from "./dashboard-components.js";

export function renderScoreHero(widget) {
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

  const stockHeaderHtml = widget.symbol ? `
    <div class="sh-stock-header">
      <div class="sh-stock-identity">
        <span class="sh-stock-symbol">${widget.symbol}</span>
        <span class="sh-stock-name">${widget.companyName || ""}</span>
      </div>
      <div class="sh-stock-price">
        <span class="sh-price-val">${widget.price != null ? '$' + widget.price : ""}</span>
        <span class="sh-price-label">Last Quote</span>
      </div>
    </div>
  ` : "";

  card.innerHTML = `
    ${stockHeaderHtml}
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

export function renderMetricExplain(widget) {
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
