import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../");
const chatbotDir = path.resolve(__dirname, "../");

// Load from project root first, then allow local overrides
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config({ path: path.join(chatbotDir, ".env") });

import express from "express";
import chatRouter from "./routes/chat.js";
import { listModels } from "./services/llmService.js";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../public")));
app.use("/api/chat", chatRouter);

app.get("/api/models", async (_req, res) => {
  const providers = await listModels();
  res.json({ 
    providers, 
    defaultProvider: "ollama",
    defaultModel: process.env.OLLAMA_MODEL || "gemma4:e4b" 
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "quantbot-chatbot" });
});

app.listen(port, () => {
  console.log(`QuantBot chatbot listening on http://localhost:${port}`);
});
