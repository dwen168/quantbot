import { spawn } from "node:child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logLLMPerformance } from "../utils/llmTrace.js";

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

let cachedOllamaModels = null;
let lastFetchTime = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

export async function listOllamaModels() {
  if (cachedOllamaModels && (Date.now() - lastFetchTime < CACHE_TTL)) {
    return cachedOllamaModels;
  }
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  try {
    const data = await fetchJson(`${baseUrl}/api/tags`, { timeout: 2500 });
    cachedOllamaModels = (data.models || []).map((model) => model.name).sort();
    lastFetchTime = Date.now();
    return cachedOllamaModels;
  } catch {
    return cachedOllamaModels || [];
  }
}

export async function listModels() {
  const ollama = await listOllamaModels();
  const gemini = process.env.GOOGLE_API_KEY ? ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.1-pro"] : [];
  return { ollama, gemini };
}

export async function preferredModel(requestedModel, provider = "ollama") {
  const providers = await listModels();
  const models = providers[provider] || [];
  
  if (requestedModel && models.includes(requestedModel)) {
    return requestedModel;
  }
  
  if (provider === "gemini") {
    return requestedModel || process.env.GOOGLE_MODEL || "gemini-3.1-flash-lite";
  }
  
  // Consistency: First priority should be the OLLAMA_MODEL from .env
  const envModel = process.env.OLLAMA_MODEL;
  if (envModel && models.includes(envModel)) {
    return envModel;
  }
  
  if (models.includes("gemma4:e4b")) {
    return "gemma4:e4b";
  }
  return models[0] || "gemma4:e4b";
}

async function generateGeminiSummary({ prompt, model }) {
  if (!process.env.GOOGLE_API_KEY) return null;
  
  const startTime = Date.now();
  const targetModel = model || process.env.GOOGLE_MODEL || "gemini-3.1-flash-lite";
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const genModel = genAI.getGenerativeModel({ 
      model: targetModel,
      systemInstruction: "Write concise, practical ASX market chatbot responses in markdown."
    });

    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    logLLMPerformance({
      model: targetModel,
      duration: Date.now() - startTime,
      input: prompt,
      source: "chatbot-gemini"
    });
    
    return text;
  } catch (e) {
    console.error("Gemini generation failed:", e);
    logLLMPerformance({
      model: targetModel,
      duration: Date.now() - startTime,
      input: `ERROR: ${e.message} | Prompt: ${prompt}`,
      source: "chatbot-gemini"
    });
    return null;
  }
}

async function generateOllamaSummary({ prompt, model }) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  const targetModel = await preferredModel(model, "ollama");
  const models = await listOllamaModels();

  // Put target model first, then the rest
  const modelsToTry = [targetModel, ...models.filter(m => m !== targetModel)];

  for (const currentModel of modelsToTry) {
    if (!currentModel) continue;
    const startTime = Date.now();
    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: currentModel,
          stream: false,
          messages: [
            { role: "system", content: "Write concise, practical ASX market chatbot responses in markdown." },
            { role: "user", content: prompt }
          ]
        })
      });
      
      const duration = Date.now() - startTime;
      if (response.ok) {
        const data = await response.json();
        if (data.message?.content) {
          logLLMPerformance({
            model: currentModel,
            duration,
            input: prompt,
            source: "chatbot-ollama"
          });
          return data.message.content;
        }
      }
      
      logLLMPerformance({
        model: currentModel,
        duration,
        input: `FAILED (HTTP ${response.status}) | Prompt: ${prompt}`,
        source: "chatbot-ollama"
      });
    } catch (e) {
      logLLMPerformance({
        model: currentModel,
        duration: Date.now() - startTime,
        input: `ERROR: ${e.message} | Prompt: ${prompt}`,
        source: "chatbot-ollama"
      });
      continue;
    }
  }
  return null;
}

export async function generateJsonCompletion({ prompt, systemInstruction, provider = "ollama", model }) {
  const startTime = Date.now();
  if (provider === "gemini" || (model && model.startsWith("gemini-"))) {
    if (!process.env.GOOGLE_API_KEY) return null;
    const targetModel = model || process.env.GOOGLE_MODEL || "gemini-3.1-flash-lite";
    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const genModel = genAI.getGenerativeModel({ 
        model: targetModel,
        systemInstruction,
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = await genModel.generateContent(prompt);
      const text = result.response.text();
      
      logLLMPerformance({
        model: targetModel,
        duration: Date.now() - startTime,
        input: `[JSON] ${prompt}`,
        source: "chatbot-json-gemini"
      });
      
      return text;
    } catch (e) {
      console.error("Gemini JSON generation failed:", e);
      logLLMPerformance({
        model: targetModel,
        duration: Date.now() - startTime,
        input: `[JSON ERROR] ${e.message} | Prompt: ${prompt}`,
        source: "chatbot-json-gemini"
      });
      return null;
    }
  }

  // Ollama JSON mode
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
  const targetModel = await preferredModel(model, "ollama");
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: targetModel,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ]
      })
    });
    
    const duration = Date.now() - startTime;
    if (response.ok) {
      const data = await response.json();
      logLLMPerformance({
        model: targetModel,
        duration,
        input: `[JSON] ${prompt}`,
        source: "chatbot-json-ollama"
      });
      return data.message?.content;
    }
    
    logLLMPerformance({
      model: targetModel,
      duration,
      input: `[JSON FAILED] HTTP ${response.status} | Prompt: ${prompt}`,
      source: "chatbot-json-ollama"
    });
  } catch (e) {
    console.error("Ollama JSON generation failed:", e);
    logLLMPerformance({
      model: targetModel,
      duration: Date.now() - startTime,
      input: `[JSON ERROR] ${e.message} | Prompt: ${prompt}`,
      source: "chatbot-json-ollama"
    });
  }
  return null;
}

export async function generateChatSummary({ prompt, model, provider = "ollama" }) {
  if (provider === "gemini" || (model && model.startsWith("gemini-"))) {
    return await generateGeminiSummary({ prompt, model });
  }
  return await generateOllamaSummary({ prompt, model });
}

export function hasOllamaCli() {
  return new Promise((resolve) => {
    const child = spawn("ollama", ["list"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}
