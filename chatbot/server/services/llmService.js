import { spawn } from "node:child_process";

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 5000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function listModels() {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  try {
    const data = await fetchJson(`${baseUrl}/api/tags`, { timeout: 2500 });
    return (data.models || []).map((model) => model.name).sort();
  } catch {
    return [];
  }
}

export async function preferredModel(requestedModel) {
  if (requestedModel) {
    return requestedModel;
  }
  const models = await listModels();
  if (models.includes("gemma4:e4b")) {
    return "gemma4:e4b";
  }
  return models[0] || process.env.OLLAMA_MODEL || "gemma4:e4b";
}

export async function generateChatSummary({ prompt, model }) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  try {
    const data = await fetchJson(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      timeout: 9000,
      body: JSON.stringify({
        model: await preferredModel(model),
        stream: false,
        messages: [
          { role: "system", content: "Write concise, practical ASX market chatbot responses in markdown." },
          { role: "user", content: prompt }
        ]
      })
    });
    return data.message?.content || null;
  } catch {
    return null;
  }
}

export function hasOllamaCli() {
  return new Promise((resolve) => {
    const child = spawn("ollama", ["list"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}
