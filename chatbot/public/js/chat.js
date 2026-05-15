import { render as renderDashboard } from "./dashboard.js";

const history = [];

function appendMessage(role, html, tool) {
  const log = document.getElementById("chat-log");
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (tool) {
    const badge = document.createElement("span");
    badge.className = "tool-badge";
    badge.textContent = tool;
    bubble.append(badge);
  }
  const body = document.createElement("div");
  body.innerHTML = html;
  bubble.append(body);
  article.append(bubble);
  log.append(article);
  requestAnimationFrame(() => {
    log.scrollTop = log.scrollHeight;
    article.scrollIntoView({ block: "end", behavior: "auto" });
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
    for (const model of data.models || []) {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      select.append(option);
    }
    if ((data.models || []).includes("gemma4:e4b")) {
      select.value = "gemma4:e4b";
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    input.value = "";
    appendMessage("user", markdown(message));
    history.push({ role: "user", content: message });
    const typing = appendMessage("assistant", "<p>Working...</p>");

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
      const data = await response.json();
      typing.remove();
      if (!response.ok) {
        appendMessage("assistant", markdown(`**Error:** ${data.error || "Request failed."}`));
        return;
      }
      appendMessage("assistant", markdown(data.message), data.tool);
      history.push({ role: "assistant", content: data.message });
      while (history.length > 20) history.shift();
      renderDashboard(data);
    } catch (error) {
      typing.remove();
      appendMessage("assistant", markdown(`**Error:** ${error.message}`));
    }
  });
}
