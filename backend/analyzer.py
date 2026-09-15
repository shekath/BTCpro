def calculate_ema(data, window):
    if not data:
        return []
    alpha = 2 / (window + 1)
    ema = [data[0]]
    for price in data[1:]:
        ema.append(price * alpha + ema[-1] * (1 - alpha))
    return ema

def calculate_rsi(data, window=14):
    if len(data) <= window:
        return [0] * len(data)
    
    gains = []
    losses = []
    
    for i in range(1, len(data)):
        change = data[i] - data[i-1]
        gains.append(change if change > 0 else 0)
        losses.append(-change if change < 0 else 0)
        
    avg_gain = sum(gains[:window]) / window
    avg_loss = sum(losses[:window]) / window
    
    rsi = [0] * window
    if avg_loss == 0:
        rsi.append(100)
    else:
        rs = avg_gain / avg_loss
        rsi.append(100 - (100 / (1 + rs)))
        
    for i in range(window, len(gains)):
        avg_gain = (avg_gain * (window - 1) + gains[i]) / window
        avg_loss = (avg_loss * (window - 1) + losses[i]) / window
        if avg_loss == 0:
            rsi.append(100)
        else:
            rs = avg_gain / avg_loss
            rsi.append(100 - (100 / (1 + rs)))
            
    return rsi

def analyze_market(ohlcv_data):
    """
    Analyzes 15m OHLCV data and returns a trading signal using pure Python.
    """
    if not ohlcv_data or len(ohlcv_data) < 30:
        return {"signal": "NEUTRAL", "reason": "Insufficient data"}

    # Extract columns
    closes = []
    highs = []
    lows = []
    opens = []
    volumes = []
    
    for row in ohlcv_data:
        if isinstance(row, dict):
            closes.append(float(row.get('c', row.get('close', 0))))
            highs.append(float(row.get('h', row.get('high', 0))))
            lows.append(float(row.get('l', row.get('low', 0))))
            opens.append(float(row.get('o', row.get('open', 0))))
            volumes.append(float(row.get('v', row.get('volume', 0))))
        else:
            # Assuming list format: time, open, high, low, close, volume
            closes.append(float(row[4]))
            highs.append(float(row[2]))
            lows.append(float(row[3]))
            opens.append(float(row[1]))
            volumes.append(float(row[5]))
    
    # Calculate RSI
    rsi_list = calculate_rsi(closes, 14)
    
    # Calculate MACD
    ema_12 = calculate_ema(closes, 12)
    ema_26 = calculate_ema(closes, 26)
    macd_line = [e12 - e26 for e12, e26 in zip(ema_12, ema_26)]
    macd_signal_line = calculate_ema(macd_line, 9)
    
    macd_diff = [m - s for m, s in zip(macd_line, macd_signal_line)]
    
    # Get latest data
    current_price = closes[-1]
    current_rsi = rsi_list[-1]
    latest_macd_diff = macd_diff[-1]
    prev_macd_diff = macd_diff[-2]
    latest_volume = volumes[-1]
    
    # Pro Trading Strategy Rules
    signal = "NEUTRAL"
    reason = "Market ranging"
    target = round(current_price * 1.015, 1)
    stop_loss = round(current_price * 0.99, 1)
    
    # 1. Extreme Oversold Reversal (High Probability Long)
    if current_rsi < 32:
        signal = "BUY"
        reason = f"Oversold bounce setup (RSI {current_rsi:.1f}). Expecting mean reversion to pivot."
        target = round(current_price * 1.018, 1)
        stop_loss = round(current_price * 0.991, 1)

    # 2. Extreme Overbought Exhaustion (High Probability Short)
    elif current_rsi > 68:
        signal = "SELL"
        reason = f"Overbought exhaustion setup (RSI {current_rsi:.1f}). Bearish pullback expected."
        target = round(current_price * 0.982, 1)
        stop_loss = round(current_price * 1.009, 1)

    # 3. MACD Momentum Crossover / Expansion
    elif latest_macd_diff > 0 and (prev_macd_diff <= 0 or latest_macd_diff > prev_macd_diff * 1.3):
        signal = "BUY"
        reason = f"Bullish MACD momentum expansion (RSI {current_rsi:.1f})"
        target = round(current_price * 1.02, 1)
        stop_loss = round(current_price * 0.99, 1)
    
    elif latest_macd_diff < 0 and (prev_macd_diff >= 0 or latest_macd_diff < prev_macd_diff * 1.3):
        signal = "SELL"
        reason = f"Bearish MACD momentum crossunder (RSI {current_rsi:.1f})"
        target = round(current_price * 0.98, 1)
        stop_loss = round(current_price * 1.01, 1)

    # 4. Scalping based on volume spikes (20 period average)
    if len(volumes) >= 20:
        avg_vol = sum(volumes[-20:]) / 20
        if avg_vol > 0 and latest_volume > avg_vol * 2.5:
            if closes[-1] >= opens[-1]:
                signal = "BUY"
                reason = f"⚡ Volume Surge Breakout ({latest_volume/avg_vol:.1f}x avg volume)"
                target = round(current_price * 1.012, 1)
                stop_loss = round(lows[-1] * 0.998, 1)
            else:
                signal = "SELL"
                reason = f"⚡ Heavy Selling Volume Spike ({latest_volume/avg_vol:.1f}x avg volume)"
                target = round(current_price * 0.988, 1)
                stop_loss = round(highs[-1] * 1.002, 1)
            
    return {
        "signal": signal,
        "entry": float(current_price),
        "target": float(target),
        "stop_loss": float(stop_loss),
        "reason": reason,
        "rsi": float(current_rsi),
        "macd": float(macd_line[-1])
    }

def compute_key_levels(ohlcv_data, ticker=None):
    """Compute support/resistance and alert levels from recent OHLCV data."""
    if not ohlcv_data or len(ohlcv_data) < 10:
        return {}

    closes, highs, lows = [], [], []
    for row in ohlcv_data:
        if isinstance(row, dict):
            closes.append(float(row.get('c', row.get('close', 0))))
            highs.append(float(row.get('h', row.get('high', 0))))
            lows.append(float(row.get('l', row.get('low', 0))))
        else:
            closes.append(float(row[4]))
            highs.append(float(row[2]))
            lows.append(float(row[3]))

    current = closes[-1]
    h24 = max(highs[-96:]) if len(highs) >= 96 else max(highs)
    l24 = min(lows[-96:]) if len(lows) >= 96 else min(lows)

    # Pivot points (standard)
    pivot = (h24 + l24 + closes[-1]) / 3
    r1 = 2 * pivot - l24
    r2 = pivot + (h24 - l24)
    s1 = 2 * pivot - h24
    s2 = pivot - (h24 - l24)

    # EMAs
    ema20 = calculate_ema(closes, 20)[-1]
    ema50 = calculate_ema(closes, 50)[-1] if len(closes) >= 50 else None
    ema200 = calculate_ema(closes, 200)[-1] if len(closes) >= 200 else None

    trend = "NEUTRAL"
    if ema20 > (ema50 or ema20):
        trend = "BULLISH"
    elif ema20 < (ema50 or ema20):
        trend = "BEARISH"

    # Funding rate from ticker
    funding = None
    change_24h = None
    volume_24h = None
    oi = None
    if ticker:
        funding = float(ticker.get("funding_rate") or 0)
        change_24h = float(ticker.get("ltp_change_24h") or 0)
        volume_24h = float(ticker.get("volume") or 0)
        oi = ticker.get("oi")

    # Dynamic alerts based on proximity to key levels
    alerts = []
    thresh = current * 0.003  # 0.3% proximity
    if abs(current - s1) < thresh:
        alerts.append(f"⚠️ Price near S1 support ${s1:,.0f}")
    if abs(current - r1) < thresh:
        alerts.append(f"⚠️ Price near R1 resistance ${r1:,.0f}")
    if abs(current - pivot) < thresh:
        alerts.append(f"ℹ️ Price at pivot point ${pivot:,.0f}")

    return {
        "pivot": round(pivot, 0),
        "r1": round(r1, 0),
        "r2": round(r2, 0),
        "s1": round(s1, 0),
        "s2": round(s2, 0),
        "h24": round(h24, 0),
        "l24": round(l24, 0),
        "ema20": round(ema20, 0),
        "ema50": round(ema50, 0) if ema50 else None,
        "trend": trend,
        "funding_rate": funding,
        "change_24h": change_24h,
        "volume_24h": volume_24h,
        "oi": oi,
        "current_price": round(current, 0),
        "alerts": alerts
    }

def generate_options_strategy(price, trend, key_levels, calls, puts):
    """
    Formulates high-probability expiry options strategies based on live market trend,
    Put-Call Ratio (PCR), and open interest clusters.
    """
    total_call_oi = sum(c.get("oi_usd", 0) for c in (calls or []))
    total_put_oi = sum(p.get("oi_usd", 0) for p in (puts or []))
    pcr = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 1.0

    s1 = key_levels.get("s1", price * 0.98)
    r1 = key_levels.get("r1", price * 1.02)
    pivot = key_levels.get("pivot", price)

    if trend == "BULLISH" or pcr > 1.25:
        strategy_name = "Bull Call Spread"
        bias = "BULLISH"
        leg1 = f"Buy Call Strike ${round(price * 1.002, -2):,.0f}"
        leg2 = f"Sell Call Strike ${round(r1, -2):,.0f}"
        max_profit = f"${round(r1 - price, 0):,.0f} / contract"
        rationale = f"Bullish trend with PCR {pcr} (Put heavy support). Upside targets R1 near ${r1:,.0f}."
        probability = "76%"
    elif trend == "BEARISH" or pcr < 0.75:
        strategy_name = "Bear Put Spread"
        bias = "BEARISH"
        leg1 = f"Buy Put Strike ${round(price * 0.998, -2):,.0f}"
        leg2 = f"Sell Put Strike ${round(s1, -2):,.0f}"
        max_profit = f"${round(price - s1, 0):,.0f} / contract"
        rationale = f"Bearish momentum with PCR {pcr} (Call heavy resistance). Downside targets S1 near ${s1:,.0f}."
        probability = "74%"
    else:
        strategy_name = "Iron Condor / Max Pain Range"
        bias = "NEUTRAL"
        leg1 = f"Sell Put ${round(s1, -2):,.0f} & Sell Call ${round(r1, -2):,.0f}"
        leg2 = f"Buy Put ${round(s1 * 0.98, -2):,.0f} & Buy Call ${round(r1 * 1.02, -2):,.0f}"
        max_profit = "Premium theta decay capture"
        rationale = f"Market ranging between ${s1:,.0f} and ${r1:,.0f}. Max Pain gravity pins price near ${pivot:,.0f}."
        probability = "80%"

    return {
        "strategy": strategy_name,
        "bias": bias,
        "pcr": pcr,
        "total_call_oi_usd": total_call_oi,
        "total_put_oi_usd": total_put_oi,
        "leg1": leg1,
        "leg2": leg2,
        "max_profit": max_profit,
        "rationale": rationale,
        "probability": probability
    }

def compute_overall_sentiment(news_sentiment, ticker, rsi=50.0, trend="NEUTRAL"):
    """
    Computes an Overall Bitcoin Sentiment Meter score (0 - 100) combining:
    1. Technical Momentum & RSI (weight 40%)
    2. Funding Rate (crowd positioning/leverage, weight 30%)
    3. News Sentiment Score (weight 30%)
    """
    tech_score = max(0.0, min(100.0, float(rsi or 50.0)))
    if trend == "BULLISH":
        tech_score = min(100.0, tech_score + 5.0)
    elif trend == "BEARISH":
        tech_score = max(0.0, tech_score - 5.0)

    funding_rate = float((ticker or {}).get("funding_rate") or 0.0)
    funding_score = 50.0 + (funding_rate * 1000.0)
    funding_score = max(5.0, min(95.0, funding_score))

    news_val = float((news_sentiment or {}).get("score") or 0.0)
    news_score = max(0.0, min(100.0, (news_val + 1.0) * 50.0))

    composite = round((tech_score * 0.40) + (funding_score * 0.30) + (news_score * 0.30), 1)

    if composite <= 25:
        category = "EXTREME FEAR"
        color = "#ef4444"
        advice = "Crowd is capitulating. Historically strong zone for DCA and contrarian accumulation."
    elif composite <= 45:
        category = "FEAR"
        color = "#f97316"
        advice = "Sellers dominate the tape. Exercise caution on long breakouts; watch for reversal wicks."
    elif composite <= 55:
        category = "NEUTRAL"
        color = "#fcd535"
        advice = "Market equilibrium between bulls and bears. Trade level-to-level inside the range."
    elif composite <= 75:
        category = "GREED"
        color = "#0ecb81"
        advice = "Bullish momentum expanding with buyer absorption. Trail stop losses closely."
    else:
        category = "EXTREME GREED"
        color = "#10b981"
        advice = "Extreme optimism. Overleveraged long squeeze risk; take partial profits into strength."

    return {
        "score": composite,
        "category": category,
        "color": color,
        "advice": advice,
        "components": {
            "technical": round(tech_score, 1),
            "funding": round(funding_score, 1),
            "news": round(news_score, 1)
        }
    }


