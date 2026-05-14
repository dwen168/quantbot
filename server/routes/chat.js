const express = require('express');
const router = express.Router();
const { chatStream } = require('../ollamaClient');
const mcpTools = require('../mcpClient');

router.post('/', async (req, res) => {
  const { messages, model } = req.body;
  
  console.log(`Received chat request for model: ${model}`);
  
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // 1. Context Enrichment (Simple Heuristic for Tickers)
    // We check for common ASX ticker patterns (3-4 uppercase letters)
    // Or if the user explicitly says something like "cba share price"
    const lastMessage = messages[messages.length - 1].content;
    let ticker = null;
    
    const uppercaseMatch = lastMessage.match(/\b[A-Z]{3,4}\b/);
    const explicitMatch = lastMessage.match(/\b([a-zA-Z]{3,4})\b\s+(share|stock|price|fundamentals)/i);
    
    if (uppercaseMatch) {
        ticker = uppercaseMatch[0].toUpperCase();
    } else if (explicitMatch) {
        ticker = explicitMatch[1].toUpperCase();
    }
    
    let enrichedContext = "";
    if (ticker) {
      try {
        console.log(`Enriching context for ticker: ${ticker}`);
        
        // Fetch data independently so if one fails, others succeed
        const [fundamentalsRes, analysisRes, newsRes, recRes, macroCtxRes, macroAnchRes] = await Promise.allSettled([
          mcpTools.getFundamentals(ticker),
          mcpTools.getAnalysis(ticker),
          mcpTools.getNews(ticker, model),
          mcpTools.getRecommendation(ticker, model),
          mcpTools.getMacroContext(),
          mcpTools.getMacroAnchors()
        ]);
        
        const fundamentals = fundamentalsRes.status === 'fulfilled' ? fundamentalsRes.value : { error: 'Failed to fetch fundamentals' };
        const analysis = analysisRes.status === 'fulfilled' ? analysisRes.value : { error: 'Failed to fetch analysis' };
        const news = newsRes.status === 'fulfilled' ? newsRes.value : [];
        const recommendation = recRes.status === 'fulfilled' ? recRes.value : {};
        const macroContext = macroCtxRes.status === 'fulfilled' ? macroCtxRes.value : {};
        const macroAnchors = macroAnchRes.status === 'fulfilled' ? macroAnchRes.value : [];
        
        // --- NEW: Stream the structured data to the frontend for visualization ---
        res.write(`data: ${JSON.stringify({ 
            type: 'mcp_data', 
            payload: { ticker, fundamentals, analysis, news, recommendation, macroContext, macroAnchors } 
        })}\n\n`);
        // -------------------------------------------------------------------------

        enrichedContext = `
[SYSTEM DATA FOR ${ticker}.AX]
LIVE CURRENT PRICE: $${analysis.current_price || 'N/A'} AUD
Fundamentals JSON: ${JSON.stringify(fundamentals)}
Analysis JSON: ${JSON.stringify(analysis)}
Analyst Recommendation: ${JSON.stringify(recommendation)}
Recent News Sentiment: ${JSON.stringify(news)}
Macro Context: ${JSON.stringify(macroContext)}
Macro Anchors: ${JSON.stringify(macroAnchors)}
`;
      } catch (err) {
        console.error("Context enrichment failed:", err.message);
      }
    }
    
    // Fallback if no ticker but macro asked
    if (!ticker && (lastMessage.toLowerCase().includes("macro") || lastMessage.toLowerCase().includes("economy"))) {
       const macro = await mcpTools.getMacroContext();
       enrichedContext += `\n[MACRO DATA]\n${JSON.stringify(macro)}`;
    }

    const currentDate = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney' });
    
    const systemMessage = {
      role: 'system',
      content: `You are an ASX Quantitative Research Assistant. 
Today's date and time is: ${currentDate} (AEST/AEDT).

CRITICAL INSTRUCTIONS:
1. You MUST use the LIVE SYSTEM DATA provided below to answer the user's question.
2. NEVER guess, estimate, or use your training data for current stock prices. The live data below is the absolute truth.
3. Be concise, professional, and data-driven.

${enrichedContext}`
    };

    console.log(`Calling Ollama chatStream with model: ${model || 'llama3.3'}`);
    const stream = await chatStream([systemMessage, ...messages], model || 'llama3.3');

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Chat Route Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
