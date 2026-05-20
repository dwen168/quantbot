import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.resolve(__dirname, '../../../quantbot.log');

export function logLLMPerformance({ model, duration, input, source = 'chatbot' }) {
  const timestamp = new Date().toISOString();
  const fullInput = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
  const logEntry = `[${timestamp}] [${source}] Model: ${model} | Duration: ${duration}ms\nInput: ${fullInput}\n${'-'.repeat(40)}\n`;
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    console.error('Failed to write to quantbot.log:', err);
  }
}
