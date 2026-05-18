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

let cachedModels = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function listModels() {
  if (cachedModels && (Date.now() - lastFetchTime < CACHE_TTL)) {
    return cachedModels;
  }
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  try {
    const data = await fetchJson(`${baseUrl}/api/tags`, { timeout: 2500 });
    cachedModels = (data.models || []).map((model) => model.name).sort();
    lastFetchTime = Date.now();
    return cachedModels;
  } catch {
    return cachedModels || [];
  }
}

export async function preferredModel(requestedModel) {
  const models = await listModels();
  if (requestedModel && models.includes(requestedModel)) {
    return requestedModel;
  }
  if (models.includes("gemma4:e4b")) {
    return "gemma4:e4b";
  }
  return models[0] || process.env.OLLAMA_MODEL || "gemma4:e4b";
}

export async function generateChatSummary({ prompt, model }) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  const targetModel = await preferredModel(model);
  const models = await listModels();

  // Put target model first, then the rest
  const modelsToTry = [targetModel, ...models.filter(m => m !== targetModel)];

  for (const currentModel of modelsToTry) {
    if (!currentModel) continue;
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeout: 9000,
        body: JSON.stringify({
          model: currentModel,
          stream: false,
          messages: [
            { role: "system", content: "Write concise, practical ASX market chatbot responses in markdown." },
            { role: "user", content: prompt }
          ]
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.message?.content) {
          return data.message.content;
        }
      }
    } catch (e) {
      // Continue to next model on network errors or timeouts
      continue;
    }
  }
  return null;
}

export function hasOllamaCli() {
  return new Promise((resolve) => {
    const child = spawn("ollama", ["list"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}
