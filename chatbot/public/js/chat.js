import { render as renderDashboard, highlightDashboardSession, clearDashboard, showSkeletons, clearSkeletons } from "./dashboard.js";

const history = [];
let sessionIdCounter = 0;

// Friendly human-readable labels for MCP tool names
const TOOL_LABELS = {
  get_technical_indicators: "📊 Technical Analysis",
  analyze_stock:            "🔬 Deep Analysis",
  recommend_stock:          "⭐ Trade Recommendation",
  get_macro_regime:         "🌐 Macro Regime",
  get_market_snapshot:      "📰 Market Snapshot",
};

function friendlyTool(tool) {
  return TOOL_LABELS[tool] || tool?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || null;
}

function appendMessage(role, html, tool, sessionId, duration) {
  const log = document.getElementById("chat-log");
  const article = document.createElement("article");
  article.className = `message ${role}`;
  if (sessionId !== undefined) {
    article.dataset.sessionId = sessionId;
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // Meta row for tool chip and duration
  if (role === "assistant" && (tool || duration)) {
    const meta = document.createElement("div");
    meta.className = "message-meta";

    if (tool) {
      const chip = document.createElement("div");
      chip.className = "tool-chip";
      chip.textContent = friendlyTool(tool);
      meta.append(chip);
    }

    if (duration) {
      const timeBadge = document.createElement("div");
      timeBadge.className = "duration-badge";
      timeBadge.textContent = `${duration}s`;
      meta.append(timeBadge);
    }
    bubble.append(meta);
  }

  const body = document.createElement("div");
  body.innerHTML = html;
  bubble.append(body);

  // "View Panel" button if linked to a dashboard session
  if (sessionId !== undefined) {
    const link = document.createElement("button");
    link.className = "dashboard-link-btn";
    link.title = "Jump to dashboard panel";
    link.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> View Panel`;
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      highlightDashboardSession(sessionId);
    });
    bubble.append(link);
  }

  article.append(bubble);
  log.append(article);
  requestAnimationFrame(() => {
    article.scrollIntoView({ block: "end", behavior: "smooth" });
  });
  return article;
}

function markdown(text) {
  return marked.parse(text || "");
}

let providers = {};
let activeProvider = "ollama";
let lastSelectedModels = {};

async function loadModels() {
  const select = document.getElementById("model-select");
  const providerBtns = document.querySelectorAll(".provider-btn");
  
  try {
    const response = await fetch("/api/models");
    const data = await response.json();
    providers = data.providers || {};
    activeProvider = data.defaultProvider || "ollama";
    const defaultModel = data.defaultModel;

    // Initialize last selected models with defaults
    if (data.defaultProvider && data.defaultModel) {
      lastSelectedModels[data.defaultProvider] = data.defaultModel;
    }

    // Set initial active button
    providerBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.provider === activeProvider);
      // Disable Gemini if not configured (no models)
      if (btn.dataset.provider === "gemini" && (!providers.gemini || providers.gemini.length === 0)) {
        btn.style.display = "none";
      }
    });

    updateModelSelect(defaultModel);
  } catch (e) {
    console.error("Failed to load models", e);
    select.title = "Could not load models from server";
  }
}

function updateModelSelect(preferredModel) {
  const select = document.getElementById("model-select");
  const models = providers[activeProvider] || [];
  
  select.innerHTML = "";
  if (models.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No models";
    select.append(option);
    return;
  }

  for (const model of models) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    select.append(option);
  }

  // Restore last selected for this provider, or use preferred, or fallback to first
  const savedModel = lastSelectedModels[activeProvider];
  const target = preferredModel || savedModel;

  if (target && models.includes(target)) {
    select.value = target;
  } else if (models.length > 0) {
    select.value = models[0];
  }
  
  // Update saved state
  lastSelectedModels[activeProvider] = select.value;
}


export function initChat() {
  loadModels();
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const modelSelect = document.getElementById("model-select");
  const providerBtns = document.querySelectorAll(".provider-btn");

  // Keep track of manual model changes
  modelSelect.addEventListener("change", () => {
    lastSelectedModels[activeProvider] = modelSelect.value;
  });

  // Provider switching
  providerBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const provider = btn.dataset.provider;
      if (provider === activeProvider) return;
      
      activeProvider = provider;
      providerBtns.forEach(b => b.classList.toggle("active", b === btn));
      updateModelSelect();
    });
  });

  // Make capability examples clickable
  document.querySelectorAll(".cap-item code").forEach(el => {
    el.style.cursor = "pointer";
    el.title = "Click to try this prompt";
    el.addEventListener("click", () => {
      const prompt = el.textContent.replace(/^"|"$/g, "");
      input.value = prompt;
      form.dispatchEvent(new Event("submit"));
    });
  });

  // Clear dashboard button
  const clearBtn = document.getElementById("clear-dashboard-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearDashboard();
      // Remove all dashboard link buttons from chat
      document.querySelectorAll(".dashboard-link-btn").forEach(el => el.remove());
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    appendMessage("user", markdown(message));
    history.push({ role: "user", content: message });
    
    // Show skeleton loading state in dashboard
    showSkeletons();
    
    const startTime = performance.now();

    // Professional Progress Indicator
    const typingHtml = `
      <div class="progress-container">
        <div class="progress-label">QuantBot is initializing...</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: 5%"></div>
        </div>
      </div>
    `;
    const typing = appendMessage("assistant", typingHtml);
    const progressLabel = typing.querySelector(".progress-label");
    const progressFill  = typing.querySelector(".progress-bar-fill");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(-20),
          model: modelSelect.value || undefined,
          provider: activeProvider
        })
      });

      if (!response.ok) {
        // SSE might not have started yet, handle immediate error
        const data = await response.json().catch(() => ({}));
        typing.remove();
        clearSkeletons();
        appendMessage("assistant", markdown(`**Error:** ${data.error || "Request failed."}`));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === "progress") {
              if (progressLabel) progressLabel.textContent = data.message;
              if (progressFill)  progressFill.style.width = `${data.pct}%`;
            } 
            else if (data.type === "complete") {
              const payload = data.payload;
              typing.remove();
              clearSkeletons();

              const endTime = performance.now();
              const duration = ((endTime - startTime) / 1000).toFixed(1);

              // Only assign a session if there is real dashboard content
              const hasDashboard = (payload.charts?.length > 0) || (payload.widgets?.length > 0);
              const sessionId = hasDashboard ? (++sessionIdCounter) : undefined;

              appendMessage("assistant", markdown(payload.message), payload.tool, sessionId, duration);
              history.push({ role: "assistant", content: payload.message });
              while (history.length > 20) history.shift();

              if (hasDashboard) {
                renderDashboard(payload, sessionId);
              }
            }
            else if (data.type === "error") {
              typing.remove();
              clearSkeletons();
              appendMessage("assistant", markdown(`**Error:** ${data.error || "Request failed."}`));
            }
          } catch (e) {
            console.error("Error parsing SSE chunk", e);
          }
        }
      }
    } catch (error) {
      typing.remove();
      clearSkeletons();
      appendMessage("assistant", markdown(`**Error:** ${error.message}`));
    }
  });
}

