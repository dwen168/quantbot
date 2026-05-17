#!/bin/bash

# Navigate to the Quantbot root directory
cd "$(dirname "$0")"

if [ -f "quantbot.pid" ]; then
    PID=$(cat quantbot.pid)
    echo "Stopping main Quantbot service (PID: $PID)..."
    
    # Kill the parent npm/node process
    pkill -P $PID 2>/dev/null || kill $PID 2>/dev/null
    rm quantbot.pid
else
    echo "quantbot.pid not found. Searching for running instances..."
fi

echo "Cleaning up lingering processes..."
pkill -f "chatbot/server/index.js" 2>/dev/null
pkill -f "mcp_server.server" 2>/dev/null

echo "Quantbot stopped successfully. 🛑"