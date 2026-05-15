import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let client = null;
let transport = null;
let connecting = null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function projectRoot() {
  return process.env.MCP_SERVER_PATH || path.resolve(__dirname, "../../..");
}

function pythonBin() {
  return process.env.PYTHON_BIN || path.join(projectRoot(), ".venv/bin/python");
}

async function connect() {
  if (client) {
    return client;
  }
  if (connecting) {
    return connecting;
  }
  connecting = (async () => {
    const nextClient = new Client({ name: "quantbot-chatbot", version: "0.1.0" });
    const nextTransport = new StdioClientTransport({
      command: pythonBin(),
      args: ["-m", "mcp_server.server"],
      cwd: projectRoot(),
      stderr: "pipe"
    });
    nextTransport.onerror = () => {
      client = null;
      transport = null;
    };
    nextTransport.onclose = () => {
      client = null;
      transport = null;
    };
    await nextClient.connect(nextTransport);
    client = nextClient;
    transport = nextTransport;
    connecting = null;
    return client;
  })();
  return connecting;
}

function parseToolResult(result) {
  if (result.structuredContent) {
    return result.structuredContent;
  }
  const text = result.content?.find((part) => part.type === "text")?.text;
  if (!text) {
    return result;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

export async function callTool(name, params = {}) {
  const activeClient = await connect();
  try {
    const result = await activeClient.callTool({ name, arguments: params });
    return parseToolResult(result);
  } catch (error) {
    client = null;
    transport = null;
    const retryClient = await connect();
    const result = await retryClient.callTool({ name, arguments: params });
    return parseToolResult(result);
  }
}
