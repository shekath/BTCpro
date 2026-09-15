import asyncio
import json
import websockets
import os
import time
import hmac
import hashlib
from dotenv import load_dotenv

load_dotenv()

DELTA_WS_URL = "wss://socket.delta.exchange"
API_KEY = os.getenv("DELTA_API_KEY")
API_SECRET = os.getenv("DELTA_API_SECRET")

def get_auth_signature(method, endpoint, payload=""):
    timestamp = str(int(time.time()))
    signature_data = method + timestamp + endpoint + payload
    signature = hmac.new(
        API_SECRET.encode("utf-8"),
        signature_data.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return timestamp, signature

async def connect_delta_ws(callback):
    while True:
        try:
            async with websockets.connect(DELTA_WS_URL, open_timeout=5, ping_interval=20, ping_timeout=10) as websocket:
                # If authenticated
                if API_KEY and API_SECRET:
                    try:
                        timestamp, signature = get_auth_signature("GET", "/live")
                        auth_payload = {
                            "type": "auth",
                            "payload": {
                                "api-key": API_KEY,
                                "signature": signature,
                                "timestamp": timestamp
                            }
                        }
                        await websocket.send(json.dumps(auth_payload))
                    except Exception as auth_err:
                        print(f"Delta WS auth error: {auth_err}")
                
                # Subscribe to L2 orderbook or ticker
                subscribe_payload = {
                    "type": "subscribe",
                    "payload": {
                        "channels": [
                            {
                                "name": "v2/ticker",
                                "symbols": ["BTCUSDT", "BTCUSD"]
                            }
                        ]
                    }
                }
                await websocket.send(json.dumps(subscribe_payload))
                
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        await callback(data)
                    except Exception as parse_err:
                        pass
        except Exception as e:
            print(f"Delta WS disconnected/failed ({e}), retrying in 5s...")
            await asyncio.sleep(5)
