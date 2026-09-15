Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting Pro Bitcoin Trader (Delta Exchange)" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

Write-Host "`n[1/2] Launching Backend on http://localhost:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root\backend`"; .\venv313\Scripts\Activate.ps1; python -m uvicorn main:app --port 8000 --reload"

Start-Sleep -Seconds 2

Write-Host "[2/2] Launching Frontend on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root\frontend`"; npm run dev"

Write-Host "`nAll services launched!" -ForegroundColor Cyan
Write-Host "Dashboard URL: http://localhost:5173" -ForegroundColor Yellow
Start-Process "http://localhost:5173"
