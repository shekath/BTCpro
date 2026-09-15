from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime

from delta_api import get_ohlcv, get_btc_ticker, get_btc_options_oi, place_order, get_product_id
from delta_ws import connect_delta_ws
from analyzer import analyze_market, compute_key_levels, generate_options_strategy, compute_overall_sentiment
from sentiment import fetch_crypto_news, analyze_sentiment

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

latest_data = {
    "signal": None,
    "signal_1h": None,
    "sentiment": None,
    "overall_sentiment": None,
    "ticker": None,
    "options": None,
    "options_strategy": None,
    "key_levels": None,
    "alerts": []
}

def _do_sync_analysis():
    ticker = get_btc_ticker()
    ohlcv_15m = get_ohlcv("BTCUSDT", "15m", 100)
    if not ohlcv_15m:
        ohlcv_15m = get_ohlcv("BTCUSD", "15m", 100)
    signal_15m = analyze_market(ohlcv_15m)
    key_levels = compute_key_levels(ohlcv_15m, ticker)
    ohlcv_1h = get_ohlcv("BTCUSDT", "1h", 100)
    if not ohlcv_1h:
        ohlcv_1h = get_ohlcv("BTCUSD", "1h", 100)
    signal_1h = analyze_market(ohlcv_1h)
    calls, puts = get_btc_options_oi()
    news = fetch_crypto_news()
    sentiment = analyze_sentiment(news)
    
    price = float(ticker.get("mark_price", 0)) if ticker else (key_levels.get("current_price", 0) if key_levels else 0)
    opt_strategy = generate_options_strategy(
        price=price,
        trend=(key_levels or {}).get("trend", "NEUTRAL"),
        key_levels=key_levels or {},
        calls=calls,
        puts=puts
    )
    overall_sentiment = compute_overall_sentiment(
        news_sentiment=sentiment,
        ticker=ticker,
        rsi=signal_15m.get("rsi", 50.0),
        trend=(key_levels or {}).get("trend", "NEUTRAL")
    )
    return ticker, signal_15m, key_levels, signal_1h, calls, puts, sentiment, opt_strategy, overall_sentiment

async def fetch_and_analyze():
    global latest_data
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Running 15m+1H Analysis in thread...")
    try:
        ticker, signal_15m, key_levels, signal_1h, calls, puts, sentiment, opt_strategy, overall_sentiment = await asyncio.to_thread(_do_sync_analysis)
        if ticker:
            latest_data["ticker"] = ticker
        latest_data["signal"] = signal_15m
        latest_data["key_levels"] = key_levels
        latest_data["signal_1h"] = signal_1h
        latest_data["options"] = {"calls": calls, "puts": puts}
        latest_data["options_strategy"] = opt_strategy
        latest_data["sentiment"] = sentiment
        latest_data["overall_sentiment"] = overall_sentiment

        alerts = []
        if signal_15m.get("signal") != "NEUTRAL":
            alerts.append({
                "type": signal_15m["signal"],
                "msg": f"🚨 15m {signal_15m['signal']}: {signal_15m['reason']}",
                "time": datetime.now().strftime("%H:%M:%S")
            })
        if signal_1h.get("signal") != "NEUTRAL":
            alerts.append({
                "type": signal_1h["signal"],
                "msg": f"📊 1H {signal_1h['signal']}: {signal_1h['reason']}",
                "time": datetime.now().strftime("%H:%M:%S")
            })
        if signal_15m.get("signal") == signal_1h.get("signal") and signal_15m.get("signal") != "NEUTRAL":
            alerts.insert(0, {
                "type": signal_15m["signal"],
                "msg": f"⚡ HIGH PROBABILITY: 15m + 1H both {signal_15m['signal']} — Strong confluence!",
                "time": datetime.now().strftime("%H:%M:%S")
            })
        for lvl in (key_levels or {}).get("alerts", []):
            alerts.append({"type": "INFO", "msg": lvl, "time": datetime.now().strftime("%H:%M:%S")})

        latest_data["alerts"] = (alerts + latest_data.get("alerts", []))[:20]

        await manager.broadcast({
            "type": "ANALYSIS_UPDATE",
            "data": {
                "signal":            signal_15m,
                "signal_1h":         signal_1h,
                "sentiment":         sentiment,
                "overall_sentiment": overall_sentiment,
                "options":           latest_data["options"],
                "options_strategy":  opt_strategy,
                "key_levels":        key_levels,
                "alerts":            latest_data["alerts"]
            }
        })
    except Exception as e:
        print(f"fetch_and_analyze error: {e}")

async def handle_tick(tick_data):
    if tick_data.get("type") == "v2/ticker" or "mark_price" in tick_data:
        latest_data["ticker"] = tick_data
        await manager.broadcast({"type": "TICKER_UPDATE", "data": tick_data})

async def ticker_fallback_loop():
    """Poll REST API every 3s to guarantee live ticker updates"""
    while True:
        try:
            ticker = await asyncio.to_thread(get_btc_ticker)
            if ticker:
                latest_data["ticker"] = ticker
                await manager.broadcast({"type": "TICKER_UPDATE", "data": ticker})
        except Exception as e:
            print(f"Ticker poll error: {e}")
        await asyncio.sleep(3)

async def fetch_live_ticker():
    # Start REST fallback immediately so ticker is always live
    asyncio.create_task(ticker_fallback_loop())
    try:
        await connect_delta_ws(handle_tick)
    except Exception as e:
        print(f"Delta WS loop exited ({e}), REST fallback active.")

@app.on_event("startup")
async def startup_event():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(fetch_and_analyze, 'interval', minutes=15)
    scheduler.start()
    asyncio.create_task(fetch_and_analyze())
    asyncio.create_task(fetch_live_ticker())

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({"type": "INITIAL_STATE", "data": latest_data})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

@app.get("/api/health")
def health():
    return {"status": "ok", "connections": len(manager.active_connections)}

@app.get("/api/analysis")
def get_analysis():
    return latest_data

@app.get("/api/trigger-analysis")
async def trigger_analysis():
    await fetch_and_analyze()
    return latest_data

class TradeRequest(BaseModel):
    action: str
    size: int

@app.post("/api/execute-trade")
def execute_trade(req: TradeRequest):
    product_id = get_product_id("BTCUSD")
    if not product_id:
        raise HTTPException(status_code=500, detail="Could not get product ID")
    result = place_order(product_id, req.size, req.action)
    if result.get("success"):
        return {"status": "Trade executed successfully", "details": result}
    else:
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to execute trade"))
