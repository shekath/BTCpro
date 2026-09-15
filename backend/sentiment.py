import requests
import xml.etree.ElementTree as ET

def fetch_crypto_news():
    url = "https://cointelegraph.com/rss"
    news_items = []
    try:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if response.status_code == 200:
            root = ET.fromstring(response.content)
            for item in root.findall('./channel/item')[:5]:
                title = item.find('title').text
                pubDate = item.find('pubDate').text
                news_items.append({
                    "title": title,
                    "published": pubDate
                })
    except Exception as e:
        print(f"Error fetching news: {e}")
        
    return news_items

def analyze_sentiment(news_items):
    """
    Very basic keyword-based sentiment analysis for crypto news.
    Returns a score between -1.0 (very bearish) and 1.0 (very bullish).
    """
    bullish_keywords = ['surge', 'jump', 'bull', 'high', 'gain', 'adoption', 'upgrade', 'launch', 'positive', 'breakout']
    bearish_keywords = ['drop', 'fall', 'bear', 'low', 'loss', 'hack', 'scam', 'regulation', 'ban', 'crash', 'down']
    
    score = 0
    analyzed_news = []
    
    for item in news_items:
        title = item['title'].lower()
        item_score = 0
        
        for word in bullish_keywords:
            if word in title:
                item_score += 0.2
                
        for word in bearish_keywords:
            if word in title:
                item_score -= 0.2
                
        # cap score
        item_score = max(min(item_score, 1.0), -1.0)
        score += item_score
        
        item['sentiment'] = "BULLISH" if item_score > 0 else "BEARISH" if item_score < 0 else "NEUTRAL"
        analyzed_news.append(item)
        
    avg_score = score / len(news_items) if len(news_items) > 0 else 0
    overall = "NEUTRAL"
    if avg_score > 0.1: overall = "BULLISH"
    if avg_score < -0.1: overall = "BEARISH"
    
    return {
        "score": float(avg_score),
        "overall": overall,
        "news": analyzed_news
    }

if __name__ == "__main__":
    news = fetch_crypto_news()
    sentiment = analyze_sentiment(news)
    print(sentiment)
