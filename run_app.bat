@echo off
echo ===================================================
echo   Starting Pro Bitcoin Trader (Delta Exchange)
echo ===================================================

echo [1/2] Starting Python FastAPI Backend on port 8000...
start "BTC Pro Trader Backend" cmd /k "cd backend && .\venv313\Scripts\activate && python -m uvicorn main:app --port 8000 --reload"

echo [2/2] Starting React Vite Frontend on port 5173...
start "BTC Pro Trader Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application launched!
echo Open your browser at: http://localhost:5173
echo.
pause
