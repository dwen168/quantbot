#!/bin/bash

# Navigate to the Quantbot root directory
cd "$(dirname "$0")"

echo "Starting Quantbot services..."

# Ensure virtual environment exists
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate venv and install python dependencies
echo "Installing/Updating Python dependencies..."
source .venv/bin/activate
pip install -e ".[dev]" > /dev/null 2>&1

# Install Node dependencies and start chatbot
echo "Installing/Updating Node dependencies..."
cd chatbot
npm install > /dev/null 2>&1

echo "Starting Chatbot (which automatically starts the MCP server)..."
nohup npm start > ../quantbot.log 2>&1 &
PID=$!
echo $PID > ../quantbot.pid

echo "========================================="
echo "Quantbot started successfully! 🚀"
echo "Chatbot UI: http://localhost:3000"
echo "Logs: tail -f quantbot.log"
echo "To stop the service, run: ./stop.sh"
echo "========================================="