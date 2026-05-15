import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";

import chatRouter from "./routes/chat.js";
import { listModels } from "./services/llmService.js";

dotenv.config({ path: path.resolve(process.cwd(), "chatbot/.env") });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../public")));
app.use("/api/chat", chatRouter);

app.get("/api/models", async (_req, res) => {
  const models = await listModels();
  res.json({ models, defaultModel: process.env.OLLAMA_MODEL || "gemma4:e4b" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "quantbot-chatbot" });
});

app.listen(port, () => {
  console.log(`QuantBot chatbot listening on http://localhost:${port}`);
});
