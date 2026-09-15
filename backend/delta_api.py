import requests
import json
import os
import time
import hmac
import hashlib
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.delta.exchange/v2"
API_KEY = os.getenv("DELTA_API_KEY")
API_SECRET = os.getenv("DELTA_API_SECRET")

def get_auth_headers(method, endpoint, payload=""):
    if not API_KEY or not API_SECRET:
        return {}
    timestamp = str(int(time.time()))
    signature_data = method + timestamp + endpoint + payload
    signature = hmac.new(
        API_SECRET.encode("utf-8"),
        signature_data.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return {
        "api-key": API_KEY,
        "signature": signature,
        "timestamp": timestamp,
        "Content-Type": "application/json"
    }

def get_product_id(symbol="BTCUSD"):
    try:
        r = requests.get(f"{BASE_URL}/products", timeout=8)
        data = r.json()
        if data.get("success"):
            for p in data["result"]:
                if p["symbol"] == symbol:
                    return p["id"]
    except Exception as e:
        print(f"Error fetching product id: {e}")
    return None

def get_btc_ticker():
    """Fetch live BTCUSDT perpetual ticker with full data"""
    try:
        r = requests.get(f"{BASE_URL}/tickers", timeout=8)
        data = r.json()
        if data.get("success"):
            for t in data["result"]:
                if t.get("symbol") == "BTCUSDT":
                    return t
    except Exception as e:
        print(f"Ticker error: {e}")
    return None

def get_ticker(symbol="BTCUSD"):
    return get_btc_ticker()

def get_btc_options_oi():
    """Fetch BTC options open interest grouped by strike"""
    calls, puts = [], []
    try:
        r = requests.get(f"{BASE_URL}/tickers", timeout=10)
        data = r.json()
        if data.get("success"):
            for t in data["result"]:
                if t.get("underlying_asset_symbol") != "BTC":
                    continue
                ct = t.get("contract_type", "")
                strike = t.get("strike_price")
                oi_usd = float(t.get("oi_value_usd") or 0)
                if not strike or oi_usd == 0:
                    continue
                item = {
                    "strike": float(strike),
                    "oi_usd": oi_usd,
                    "oi": float(t.get("oi") or 0),
                    "symbol": t["symbol"],
                    "mark_price": float(t.get("mark_price") or 0),
                }
                if ct == "call_options":
                    calls.append(item)
                elif ct == "put_options":
                    puts.append(item)
    except Exception as e:
        print(f"Options OI error: {e}")

    calls.sort(key=lambda x: x["oi_usd"], reverse=True)
    puts.sort(key=lambda x: x["oi_usd"], reverse=True)
    return calls[:8], puts[:8]

def get_ohlcv(symbol="BTCUSDT", resolution="15m", limit=100):
    try:
        now = int(time.time())
        res_seconds = 900 if resolution == "15m" else 3600 if resolution == "1h" else 86400 if resolution == "1d" else 900
        start = now - (limit * res_seconds)
        r = requests.get(f"{BASE_URL}/history/candles",
                         params={"symbol": symbol, "resolution": resolution, "start": start, "end": now},
                         timeout=8)
        data = r.json()
        if data.get("success") and data.get("result"):
            candles = data["result"]
            candles.reverse()
            return candles
    except Exception as e:
        print(f"OHLCV error: {e}")
    return []

def place_order(product_id, size, side, order_type="market", stop_price=None, target_price=None):
    """Place an authenticated order on Delta Exchange."""
    endpoint = "/orders"
    url = f"{BASE_URL}{endpoint}"
    payload_dict = {
        "product_id": product_id,
        "size": size,
        "side": side.lower(),
        "order_type": order_type
    }
    payload_str = json.dumps(payload_dict)
    headers = get_auth_headers("POST", endpoint, payload_str)
    try:
        response = requests.post(url, headers=headers, data=payload_str)
        return response.json()
    except Exception as e:
        print(f"Error placing order: {e}")
        return {"success": False, "error": str(e)}
