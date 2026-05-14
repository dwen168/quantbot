const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const chatRouter = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/chat', chatRouter);

const { Ollama } = require('ollama');
const ollama = new Ollama({ host: 'http://localhost:11434' });

app.get('/api/models', async (req, res) => {
  try {
    const response = await ollama.list();
    res.json(response.models);
  } catch (error) {
    console.error('Fetch Models Error:', error);
    res.status(500).json({ error: 'Failed to fetch models from Ollama' });
  }
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Node.js Server running on http://localhost:${PORT}`);
});
