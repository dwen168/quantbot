import { render as renderDashboard, highlightDashboardSession, clearDashboard } from "./dashboard.js";

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

function appendMessage(role, html, tool, sessionId) {
  const log = document.getElementById("chat-log");
  const article = document.createElement("article");
  article.className = `message ${role}`;
  if (sessionId !== undefined) {
    article.dataset.sessionId = sessionId;
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // Tool chip — shown only for assistant messages with a tool
  if (tool && role === "assistant") {
    const chip = document.createElement("div");
    chip.className = "tool-chip";
    chip.textContent = friendlyTool(tool);
    bubble.append(chip);
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

async function loadModels() {
  const select = document.getElementById("model-select");
  try {
    const response = await fetch("/api/models");
    const data = await response.json();
    const defaultModel = data.defaultModel || "gemma4:e4b";
    
    // Clear existing (except default) if needed, but here we just append
    select.innerHTML = "";
    
    for (const model of data.models || []) {
      const option = document.createElement("option");
      option.value = model;
      const isDefault = model === defaultModel;
      option.textContent = isDefault ? `${model} (Default)` : model;
      select.append(option);
    }
    
    if ((data.models || []).includes(defaultModel)) {
      select.value = defaultModel;
    }
  } catch {
    select.title = "Could not load local Ollama models";
  }
}


export function initChat() {
  loadModels();
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const modelSelect = document.getElementById("model-select");

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
          model: modelSelect.value || undefined
        })
      });

      if (!response.ok) {
        // SSE might not have started yet, handle immediate error
        const data = await response.json().catch(() => ({}));
        typing.remove();
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

              // Only assign a session if there is real dashboard content
              const hasDashboard = (payload.charts?.length > 0) || (payload.widgets?.length > 0);
              const sessionId = hasDashboard ? (++sessionIdCounter) : undefined;

              appendMessage("assistant", markdown(payload.message), payload.tool, sessionId);
              history.push({ role: "assistant", content: payload.message });
              while (history.length > 20) history.shift();

              if (hasDashboard) {
                renderDashboard(payload, sessionId);
              }
            }
            else if (data.type === "error") {
              typing.remove();
              appendMessage("assistant", markdown(`**Error:** ${data.error || "Request failed."}`));
            }
          } catch (e) {
            console.error("Error parsing SSE chunk", e);
          }
        }
      }
    } catch (error) {
      typing.remove();
      appendMessage("assistant", markdown(`**Error:** ${error.message}`));
    }
  });
}

