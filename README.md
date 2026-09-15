# ⚡ Pro Bitcoin Trader (Delta Exchange)

An autonomous, real-time Bitcoin trading dashboard and technical analysis terminal integrated with **Delta Exchange**. Features live market tick streaming, automated multi-timeframe futures signals (15m & 1H), live options chain open interest analysis, expiry option strategy recommendations, a composite Bitcoin Sentiment Meter, real-time interactive P&L tracking, and human-in-the-loop trade execution.

![Dashboard Preview](https://img.shields.io/badge/Status-Live%20Operational-brightgreen?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.13+-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-teal?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-18.2+-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-5.0+-purple?style=for-the-badge&logo=vite)

---

## 🌟 Key Features

### 1. 🧠 Multi-Timeframe High-Probability Futures Signals
- **15-Minute & 1-Hour Confluence Engine**: Continuously evaluates intraday and macro trend candles to flag high-probability entries.
- **Pure-Python Indicator Suite**: Custom native mathematical implementations of **RSI(14)**, **EMA(20/50/200)**, and **MACD(12,26,9)** with zero crashing C-extension dependencies.
- **Actionable Execution Levels**: Every generated trade recommendation includes **Action (BUY/SELL)**, **Entry Zone**, **Profit Target**, and **Stop-Loss**.

### 2. 💡 Expiry Options Strategy Recommendation
- **Put-Call Ratio (PCR)**: Live calculation comparing total active Put Open Interest vs. Call Open Interest across all active Delta Exchange option strikes.
- **Algorithmic Expiry Strategies**: Formulates optimal options strategies:
  - 🟢 **Bull Call Spread**: Recommended when market is bullish/oversold with high PCR support.
  - 🔴 **Bear Put Spread**: Recommended when downward momentum accelerates.
  - 🟡 **Iron Condor / Max Pain Range**: Recommends range credit spreads to harvest theta decay when price consolidates near Max Pain.
- **Max Pain Anchor**: Dynamically calculates and displays the Max Pain strike on the top bar and Key S/R table.

### 3. 🧭 Overall Bitcoin Sentiment Meter
- **Radial Speedometer Dial**: Visual needle mapping market mood from 0 (Extreme Fear) to 100 (Extreme Greed).
- **Composite Sentiment Formula**:
  - **Technical Momentum (40%)**: Live RSI(14) + EMA trend structure.
  - **Crowd Funding Rate (30%)**: Open Interest long/short leverage pressure.
  - **News Sentiment Score (30%)**: Real-time RSS crypto news headline sentiment parser.
- **Actionable Pro Commentary**: Provides tailored trading advice based on prevailing market regimes.

### 4. 💰 Live Interactive P&L Tracker
- **Tick-by-Tick Floating P&L**: Recalculates unrealized dollar profit and percentage gain/loss in real-time as live mark price ticks arrive.
- **Paper Trade Simulator**: One-click **+ Long** and **+ Short** buttons allow testing and watching live P&L without risking real capital.
- **Individual Position Management**: Close positions individually with instant session feedback.

### 5. 🔊 Real-Time Volume Spike & Audio Alerts
- **Volume Surge Monitor**: Triggers alerts when trading volume spikes > 2.5x above the 20-period moving average.
- **Web Audio API Alerts**: High/low pitch sound beeps cue the trader on bullish/bearish breakouts.

### 6. 📱 100% Fully Responsive Design
- Scales smoothly from wide multi-monitor trading terminals to tablets and mobile phones.
- Mobile navigation bar with quick view switches: `📈 Chart | ⚡ Signals & P&L | 🧭 Sentiment & Options`.

---

## 🏗️ Architecture

```
   ┌────────────────────────────────────────────────────────┐
   │                Delta Exchange Markets                  │
   │      - Live Tickers (BTCUSDT / BTCUSD Perpetual)       │
   │      - Historical 15m & 1H Candlesticks                │
   │      - Real-Time Options Chain (Calls / Puts OI)       │
   └─────────────────────────┬──────────────────────────────┘
                             │
                             ▼
   ┌────────────────────────────────────────────────────────┐
   │              FastAPI Backend (:8000)                   │
   │  - delta_api.py  : REST client & HMAC-SHA256 orders    │
   │  - delta_ws.py   : WebSocket live tick subscriber      │
   │  - analyzer.py   : Pure Python RSI, MACD, S/R, Pivots  │
   │  - sentiment.py  : Crypto RSS news sentiment parser    │
   │  - main.py       : Background schedulers & WS server   │
   └─────────────────────────┬──────────────────────────────┘
                             │ (WebSocket: ws://localhost:8000/ws)
                             ▼
   ┌────────────────────────────────────────────────────────┐
   │               React + Vite Frontend (:5173)            │
   │  - App.jsx       : Dark glassmorphic responsive UI     │
   │  - TradingView   : Embedded interactive charting       │
   │  - Audio Alerts  : Web Audio API sound alerts          │
   │  - Controls      : Human-in-the-loop Approve & Execute │
   └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (Local Setup)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/BTC_proTrader.git
cd BTC_proTrader
```

### 2. Configure Backend Credentials
Create a `.env` file in the `backend/` directory based on `.env.example`:
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` with your Delta Exchange API credentials:
```env
DELTA_API_KEY=your_delta_api_key_here
DELTA_API_SECRET=your_delta_api_secret_here
```

### 3. Launch with One Click (Windows)
Double-click **`run_app.bat`** or run in PowerShell:
```powershell
.\run_app.ps1
```

---

## 🛠️ Manual Installation & Startup

### Backend Setup (Python 3.10+)
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

### Frontend Setup (Node.js 18+)
```bash
cd frontend
npm install
npm run dev
```

Dashboard will be live at: **`http://localhost:5173`**

---

## 🌐 Production Deployment Guide

### Option A: Frontend on Vercel / Netlify / GitHub Pages
1. Build the production bundle:
   ```bash
   cd frontend
   npm run build
   ```
2. Deploy the generated `frontend/dist` directory to Vercel, Netlify, or GitHub Pages.
3. Configure `VITE_BACKEND_URL` to point to your live backend endpoint.

### Option B: Backend on Railway / Render / VPS
1. Deploy the `backend/` folder to any Python host (e.g. Railway, Render, Fly.io, or VPS).
2. Set environment variables in your hosting dashboard:
   - `DELTA_API_KEY`
   - `DELTA_API_SECRET`
3. Start command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

---

## 🛡️ Security & Disclaimer
- **API Security**: Orders require human-in-the-loop confirmation before dispatch. Keep your `DELTA_API_SECRET` confidential; never commit your `.env` file.
- **Financial Disclaimer**: This application is built for research, educational, and algorithmic analysis purposes. Cryptocurrency trading carries substantial risk. Always manage risk responsibly.

---

## 📄 License
MIT License. Free for personal and open-source use.
