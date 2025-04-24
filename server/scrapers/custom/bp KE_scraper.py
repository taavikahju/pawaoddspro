import requests
import json
import urllib.parse
import time
import sys

# Use stderr for debug messages
def debug_print(message):
    print(message, file=sys.stderr)

all_events = []
take = 20
skip = 0

# Limit to just one page for testing
max_pages = 1 
page = 0

while page < max_pages:
    encoded_q = "%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22UPCOMING%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3ASKIP_PLACEHOLDER%2C%22take%22%3A20%7D%5D%7D"
    encoded_query = encoded_q.replace("SKIP_PLACEHOLDER", str(skip))
    url = f"https://www.betpawa.co.ke/api/sportsbook/v2/events/lists/by-queries?q={encoded_query}"

    debug_print(f"Fetching page with skip={skip}...")
    headers = {
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,la;q=0.7",
        "devicetype": "web",
        "priority": "u=1, i",
        "referer": "https://www.betpawa.co.ke/events?marketId=1X2&categoryId=2",
        "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "vuejs": "true",
        "x-pawa-brand": "betpawa-kenya",
        "x-pawa-language": "en"
    }
    
    response = requests.get(url, headers=headers)

    if response.status_code != 200:
        debug_print(f"Request failed with status {response.status_code}")
        break

    result = response.json()
    events = result.get("responses", [])[0].get("responses", [])

    if not events:
        debug_print("No more events found. Stopping.")
        break

    from datetime import datetime

    for event in events:
        try:
            widget = next(w for w in event.get("widgets", []) if w.get("type") == "SPORTRADAR")
            market = next((m for m in event.get("markets", []) if m["marketType"]["id"] == "3743"), None)
            prices = {p["name"]: p["price"] for p in market.get("prices", [])}

            all_events.append({
                "eventId": widget["id"],
                "country": event["region"]["name"],
                "tournament": event["competition"]["name"],
                "event": event["name"],
                "market": market["marketType"]["name"],
                "home_odds": str(prices.get("1", "")),
                "draw_odds": str(prices.get("X", "")),
                "away_odds": str(prices.get("2", "")),
                "start_time": datetime.fromisoformat(event["startTime"].replace("Z", "")).strftime("%Y-%m-%d %H:%M")
            })
        except Exception as e:
            debug_print(f"Skipping event due to error: {e}")
    skip += take
    page += 1
    time.sleep(0.3)  # To avoid hitting rate limits

# Output as JSON to stdout for the integration
print(json.dumps(all_events))