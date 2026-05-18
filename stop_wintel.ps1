# Quantbot Stop Script for Windows (PowerShell)
Set-Location $PSScriptRoot

if (Test-Path "quantbot.pid") {
    $pidFromFile = Get-Content "quantbot.pid"
    Write-Host "Stopping main Quantbot service (PID: $pidFromFile)..." -ForegroundColor Yellow
    
    # Try to stop the process and its children
    $process = Get-Process -Id $pidFromFile -ErrorAction SilentlyContinue
    if ($process) {
        # Find children
        Get-CimInstance Win32_Process -Filter "ParentProcessId = $pidFromFile" | ForEach-Object {
            Write-Host "Stopping child process: $($_.ProcessId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Stop-Process -Id $pidFromFile -Force -ErrorAction SilentlyContinue
    }
    Remove-Item "quantbot.pid"
} else {
    Write-Host "quantbot.pid not found. Searching for running instances..." -ForegroundColor Gray
}

Write-Host "Cleaning up lingering processes..." -ForegroundColor Yellow
# Find and stop processes that match our services
# This targets common command line patterns for this app
$lingering = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%chatbot/server/index.js%' OR CommandLine LIKE '%mcp_server.server%'"
if ($lingering) {
    $lingering | ForEach-Object {
        Write-Host "Stopping lingering process: $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Quantbot stopped successfully. 🛑" -ForegroundColor Green
