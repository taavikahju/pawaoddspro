import requests
import json
import urllib.parse
import time

all_events = []
take = 20
skip = 0

while True:
    encoded_q = "%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22UPCOMING%22%2C%22categories%22%3A%5B2%5D%2C%22zones%22%3A%7B%7D%2C%22hasOdds%22%3Atrue%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3ASKIP_PLACEHOLDER%2C%22take%22%3A20%7D%5D%7D"
    encoded_query = encoded_q.replace("SKIP_PLACEHOLDER", str(skip))
    url = f"https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?q={encoded_query}"

    print(f"Fetching page with skip={skip}...")
    headers = {
        "accept": "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8,la;q=0.7",
        "baggage": "sentry-environment=production,sentry-release=1.203.58,sentry-public_key=f051fd6f1fdd4877afd406a80df0ddb8,sentry-trace_id=69dc4eced394402e8b4842078bf03b47,sentry-sample_rate=0.1,sentry-transaction=Upcoming,sentry-sampled=false",
        "devicetype": "web",
        "if-modified-since": "Tue, 22 Apr 2025 16:29:07 GMT",
        "priority": "u=1, i",
        "referer": "https://www.betpawa.com.gh/events?marketId=1X2&categoryId=2",
        "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sentry-trace": "69dc4eced394402e8b4842078bf03b47-982bacd1c87283b4-0",
        "traceid": "1ecc4dce-f388-46a2-8275-0acddeffcf4d",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "vuejs": "true",
        "x-pawa-brand": "betpawa-ghana",
        "x-pawa-language": "en"
    }
    cookies = {
        "_ga": "GA1.1.459857438.1713161475",
        "_ga_608WPEPCC3": "GS1.1.1731480684.7.0.1731480684.0.0.0",
        "aff_cookie": "F60",
        "_gcl_au": "1.1.1725251410.1738666716",
        "PHPSESSID": "b0694dabe05179bc223abcdf8f7bf83e",
        "tracingId": "0f5927de-e30d-4228-b29c-c92210017a62",
        "x-pawa-token": "b4c6eda2ae319f4b-8a3075ba3c9d9984",
        "cf_clearance": "DjcwCGXGFkKOCvAa7tthq5gHd2OnDjc9YCNhMNiDvtA-1745326277-1.2.1.1-4gXeQQAJCLcc73SQfF5WbdmY2stVELoIXQ4tNlEqXQ0YXVQexCJyNKBDdmSZPCEsPbDSCyZ9Dq44i6QG9pmnHaPl6oqYLOYRPyyGksyRWjy7XVmbseQZR1hRppEkLe.7dz9mbrh9M4.i4Yacl75TmAvcpO_gneOw9053uogjahyJiTXWfAjtuWaM1MHey5z8kKPCRJV.yHO84079d6Bjxjg0e8H7rZQYzBqV2uVOC6hc5gMFcXLn3r9VJtyQlXT1i2ZEGgk2etljGYq28fPXWB7ACaZDUxpSH9ufodLbNbWF0uXfJbB_uCLTkyh3e05.eW2AZ61JkrDY5JUO1Z9bLUJg29DoAi0rVMAu.XHUX_c",
        "__cf_bm": "GWFTquZa.ZseXCY1d0MojQJ5ioXLrt9Kzpw9Ys1VK.Y-1745339708-1.0.1.1-fuzWFb1qmUZL9JpleqcSQbFzUdv16bOpJFyE.zXq45luhtH40Q.Ow4FzDOJpSrLDa4Zw9eBJKYmqAh.mYKYnlwRSmU9CFdGAY5YOHJdUqAg",
        "_ga_81NDDTKQDC": "GS1.1.1745339340.454.1.1745340303.60.0.0"
    }
    response = requests.get(url, headers=headers, cookies=cookies)

    if response.status_code != 200:
        print(f"Request failed with status {response.status_code}")
        break

    result = response.json()
    events = result.get("responses", [])[0].get("responses", [])

    if not events:
        print("No more events found. Stopping.")
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
            print(f"Skipping event due to error: {e}")
    skip += take
    time.sleep(0.3)  # To avoid hitting rate limits

# Save to file
with open("Cleaned_betPawa_Data.json", "w") as f:
    json.dump(all_events, f, indent=2)
