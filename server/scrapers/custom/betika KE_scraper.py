import requests
import json
import time
import sys
from datetime import datetime

# Use stderr for debug messages
def debug_print(message):
    print(message, file=sys.stderr)

all_events = []

# We'll fetch one page for now for testing purposes
try:
    debug_print("Fetching Betika Kenya football events...")
    
    url = "https://api.betika.com/v1/uo/matches?tab=upcoming&sub_type_id=1&sport_id=14&category_id=407&market=1"
    
    headers = {
        "accept": "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        "content-type": "application/json",
        "sec-ch-ua": "\"Google Chrome\";v=\"135\", \"Not-A.Brand\";v=\"8\", \"Chromium\";v=\"135\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
    }
    
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        debug_print(f"Request failed with status {response.status_code}")
    else:
        data = response.json()
        matches = data.get("data", {}).get("matches", [])
        
        for match in matches:
            try:
                # Extract the required information
                home_team = match.get("home", {}).get("name", "")
                away_team = match.get("away", {}).get("name", "")
                tournament = match.get("competition", {}).get("name", "")
                country = match.get("competition", {}).get("category", {}).get("name", "")
                start_time = match.get("time", 0)
                
                # Convert timestamp to datetime
                start_time_str = datetime.fromtimestamp(start_time).strftime("%Y-%m-%d %H:%M")
                
                # Get odds
                odds = match.get("markets", [])[0] if match.get("markets") and len(match.get("markets", [])) > 0 else {}
                if odds:
                    home_odds = next((o.get("odd") for o in odds.get("selections", []) if o.get("name") == "1"), "")
                    draw_odds = next((o.get("odd") for o in odds.get("selections", []) if o.get("name") == "X"), "")
                    away_odds = next((o.get("odd") for o in odds.get("selections", []) if o.get("name") == "2"), "")
                    
                    all_events.append({
                        "eventId": str(match.get("id", "")),
                        "country": country,
                        "tournament": tournament,
                        "event": f"{home_team} vs {away_team}",
                        "market": "1X2",
                        "home_odds": str(home_odds),
                        "draw_odds": str(draw_odds),
                        "away_odds": str(away_odds),
                        "start_time": start_time_str
                    })
            except Exception as e:
                debug_print(f"Error processing match: {e}")
except Exception as e:
    debug_print(f"Fatal error: {e}")

# Output as JSON to stdout for the integration
print(json.dumps(all_events))