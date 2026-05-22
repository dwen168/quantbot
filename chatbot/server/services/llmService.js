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
  const gemini = process.env.GOOGLE_API_KEY ? ["Gemini 2.5 Flash-Lite", "Gemma 4", "DeepSeek-v4-flash"] : ["DeepSeek-v4-flash"];
  return { ollama, gemini };
}

export async function preferredModel(requestedModel, provider = "ollama") {
  const providers = await listModels();
  const models = providers[provider] || [];
  
  if (requestedModel && models.includes(requestedModel)) {
    return requestedModel;
  }
  
  if (provider === "gemini") {
    return requestedModel || process.env.GOOGLE_MODEL || "Gemini 2.5 Flash-Lite";
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

function mapGeminiModel(model) {
  const map = {
    "Gemini 2.5 Flash-Lite": "gemini-2.5-flash-lite",
    "Gemma 4": "gemma-4-31b-it",
    "DeepSeek-v4-flash": "deepseek-v4-flash"
  };
  return map[model] || model || "gemini-2.5-flash-lite";
}

async function generateDeepSeekSummary({ prompt, model, systemInstruction }) {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  const startTime = Date.now();
  const targetModel = model || "deepseek-v4-flash";
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: "system", content: systemInstruction || "Write concise, practical ASX market chatbot responses in markdown." },
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const text = data.choices[0]?.message?.content;
      logLLMPerformance({
        model: targetModel,
        duration: Date.now() - startTime,
        input: prompt,
        source: "chatbot-deepseek"
      });
      return text;
    }
    return null;
  } catch (e) {
    console.error("DeepSeek generation failed:", e);
    return null;
  }
}

async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      // Check for 503 (High Demand) or 429 (Rate Limit)
      const isTransient = e.status === 503 || e.status === 429 || 
                          e.message?.includes("503") || e.message?.includes("429") ||
                          e.message?.includes("high demand");
      if (isTransient) {
        const waitTime = delay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw e;
    }
  }
}

async function generateGeminiSummary({ prompt, model }) {
  const startTime = Date.now();
  const primaryModel = model || process.env.GOOGLE_MODEL || "Gemini 2.5 Flash-Lite";
  const onlineModels = ["Gemini 2.5 Flash-Lite", "Gemma 4", "DeepSeek-v4-flash"];
  const modelsToTry = [primaryModel, ...onlineModels.filter(m => m !== primaryModel)];

  for (const currentModel of modelsToTry) {
    if (currentModel === "DeepSeek-v4-flash") {
      const res = await generateDeepSeekSummary({ prompt, model: "deepseek-v4-flash" });
      if (res) return res;
      continue;
    }

    if (!process.env.GOOGLE_API_KEY) continue;
    
    const targetModelId = mapGeminiModel(currentModel);
    try {
      return await withRetry(async () => {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const genModel = genAI.getGenerativeModel({ 
          model: targetModelId,
          systemInstruction: "Write concise, practical ASX market chatbot responses in markdown."
        });

        const result = await genModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        logLLMPerformance({
          model: targetModelId,
          duration: Date.now() - startTime,
          input: prompt,
          source: "chatbot-gemini"
        });
        
        return text;
      });
    } catch (e) {
      console.error(`Gemini generation failed for ${currentModel}:`, e.message);
      // Continue to next model
    }
  }

  logLLMPerformance({
    model: "ALL_ONLINE_FAILED",
    duration: Date.now() - startTime,
    input: `ERROR: All online models failed | Prompt: ${prompt}`,
    source: "chatbot-gemini"
  });
  return null;
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
  if (provider === "gemini" || (model && model.startsWith("gemini-")) || (model && ["Gemini 2.5 Flash-Lite", "Gemma 4", "DeepSeek-v4-flash"].includes(model))) {
    
    const primaryModel = model || process.env.GOOGLE_MODEL || "Gemini 2.5 Flash-Lite";
    const onlineModels = ["Gemini 2.5 Flash-Lite", "Gemma 4", "DeepSeek-v4-flash"];
    const modelsToTry = [primaryModel, ...onlineModels.filter(m => m !== primaryModel)];

    for (const currentModel of modelsToTry) {
      if (currentModel === "DeepSeek-v4-flash") {
        const res = await generateDeepSeekSummary({ prompt, model: "deepseek-v4-flash", systemInstruction });
        if (res) return res;
        continue;
      }

      if (!process.env.GOOGLE_API_KEY) continue;
      
      const targetModelId = mapGeminiModel(currentModel);
      try {
        return await withRetry(async () => {
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
          const genModel = genAI.getGenerativeModel({ 
            model: targetModelId,
            systemInstruction,
            generationConfig: { responseMimeType: "application/json" }
          });
          const result = await genModel.generateContent(prompt);
          const text = result.response.text();
          
          logLLMPerformance({
            model: targetModelId,
            duration: Date.now() - startTime,
            input: `[JSON] ${prompt}`,
            source: "chatbot-json-gemini"
          });
          
          return text;
        });
      } catch (e) {
        console.error(`Gemini JSON generation failed for ${currentModel}:`, e.message);
        // Continue to next model
      }
    }

    logLLMPerformance({
      model: "ALL_ONLINE_JSON_FAILED",
      duration: Date.now() - startTime,
      input: `[JSON ERROR] All online models failed | Prompt: ${prompt}`,
      source: "chatbot-json-gemini"
    });
    return null;
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
  if (provider === "gemini" || (model && (model.startsWith("gemini-") || ["Gemini 2.5 Flash-Lite", "Gemma 4", "DeepSeek-v4-flash"].includes(model)))) {
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
