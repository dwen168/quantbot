const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://localhost:11434' });

async function chat(messages, model = 'llama3.3') {
  try {
    const response = await ollama.chat({
      model: model,
      messages: messages,
      stream: false,
    });
    return response.message.content;
  } catch (error) {
    console.error('Ollama Chat Error:', error);
    throw error;
  }
}

async function chatStream(messages, model = 'llama3.3') {
  try {
    return await ollama.chat({
      model: model,
      messages: messages,
      stream: true,
    });
  } catch (error) {
    console.error('Ollama Stream Error:', error);
    throw error;
  }
}

module.exports = { chat, chatStream };
