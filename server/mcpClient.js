const axios = require('axios');

const MCP_BASE_URL = 'http://localhost:8000';

const mcpTools = {
  getFundamentals: async (ticker) => {
    const response = await axios.get(`${MCP_BASE_URL}/fundamentals/${ticker}`);
    return response.data;
  },
  getMacroContext: async () => {
    const response = await axios.get(`${MCP_BASE_URL}/macro/context`);
    return response.data;
  },
  getMacroAnchors: async () => {
    const response = await axios.get(`${MCP_BASE_URL}/macro/anchors`);
    return response.data;
  },
  getNews: async (ticker, model) => {
    const response = await axios.get(`${MCP_BASE_URL}/news/${ticker}`, { params: { model } });
    return response.data;
  },
  getAnalysis: async (ticker) => {
    const response = await axios.get(`${MCP_BASE_URL}/analysis/${ticker}`);
    return response.data;
  },
  getRecommendation: async (ticker, model) => {
    const response = await axios.get(`${MCP_BASE_URL}/recommendation/${ticker}`, { params: { model } });
    return response.data;
  }
};

module.exports = mcpTools;
