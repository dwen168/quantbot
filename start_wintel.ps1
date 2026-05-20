# Quantbot Startup Script for Windows (PowerShell)
Set-Location $PSScriptRoot

Write-Host "Starting Quantbot services..." -ForegroundColor Cyan

# Ensure virtual environment exists
if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    if (Get-Command "python" -ErrorAction SilentlyContinue) {
        python -m venv .venv
    } elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
        py -m venv .venv
    } else {
        Write-Error "Python not found. Please install Python and add it to your PATH."
        exit 1
    }
}

# Ensure Node.js/npm exists
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js (npm) not found. Please install Node.js and add it to your PATH."
    exit 1
}

# Activate venv and install python dependencies
Write-Host "Installing/Updating Python dependencies..." -ForegroundColor Yellow
& ".\.venv\Scripts\python.exe" -m pip install -e ".[dev]" | Out-Null

# Install Node dependencies and start chatbot
Write-Host "Installing/Updating Node dependencies..." -ForegroundColor Yellow
Push-Location chatbot
npm install | Out-Null

Write-Host "Starting Chatbot (which automatically starts the MCP server)..." -ForegroundColor Yellow
# Start npm start in the background, redirecting output to log
$process = Start-Process -FilePath "npm.cmd" -ArgumentList "start" -RedirectStandardOutput "..\quantbot.log" -RedirectStandardError "..\quantbot.log" -NoNewWindow -PassThru
$process.Id | Out-File -FilePath "..\quantbot.pid" -Encoding ASCII

Pop-Location

Write-Host "=========================================" -ForegroundColor Green
Write-Host "Quantbot started successfully! 🚀" -ForegroundColor Green
Write-Host "Chatbot UI: http://localhost:3000"
Write-Host "Logs: Get-Content -Wait quantbot.log"
Write-Host "To stop the service, run: .\stop_wintel.ps1"
Write-Host "=========================================" -ForegroundColor Green
