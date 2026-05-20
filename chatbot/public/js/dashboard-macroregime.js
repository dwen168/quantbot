import { el } from "./dashboard-components.js";

export function renderMacroHero(widget) {
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
    return "bearish";
  };

  const geoHtml = widget.geopolitics ? `
    <div class="macro-hero-geopolitics">
      <span class="geo-label">🌍 Geopolitical Assessment</span>
      <p class="geo-text">${widget.geopolitics}</p>
    </div>
  ` : "";

  card.innerHTML = `
    <div class="macro-hero-header">
      <h3 class="macro-hero-title">Macro Anchors Snapshot</h3>
      <p class="macro-hero-summary">${widget.summary || ""}</p>
      ${geoHtml}
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
