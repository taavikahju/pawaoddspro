#!/usr/bin/env python3
"""
Python implementation of the Sportybet scraper
This scraper is designed to replace the JavaScript version to avoid reference issues
"""

import json
import os
import time
import sys
import requests
from datetime import datetime
import traceback

# Configuration
BASE_URL = "https://www.sportybet.com"
OUTPUT_FILE = "data/sporty_py.json"  # Separate output file for testing
TIMEOUT = 30  # seconds
API_ENDPOINTS = [
    "/api/ng/factsCenter/markets?market=1&tournamentId=",
    "/api/ke/factsCenter/markets?market=1&tournamentId=",
    "/api/ug/factsCenter/markets?market=1&tournamentId=",
    "/api/gh/factsCenter/markets?market=1&tournamentId=",
    "/api/tz/factsCenter/markets?market=1&tournamentId=",
    "/api/za/factsCenter/markets?market=1&tournamentId="
]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.sportybet.com/",
    "Origin": "https://www.sportybet.com",
    "Connection": "keep-alive"
}

def log(message):
    """Log messages with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
    print(f"[{timestamp}] {message}")

def fetch_page(endpoint, page=1):
    """Fetch a single page from Sportybet API"""
    try:
        url = f"{BASE_URL}{endpoint}&page={page}"
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        
        if response.status_code != 200:
            log(f"Error fetching {url}: Status code {response.status_code}")
            return None
            
        return response.json()
    except Exception as e:
        log(f"Error fetching {endpoint} page {page}: {str(e)}")
        return None

def process_event(event, endpoint_idx):
    """Process a single event from Sportybet API response"""
    try:
        # Extract country and tournament info from the event
        tournament = event.get('tournament', {})
        tournament_name = tournament.get('name', '')
        category = tournament.get('category', {})
        country_name = category.get('name', '')
        
        # Extract teams/opponents information
        opponents = event.get('opponents', [])
        home_team = opponents[0].get('name', '') if len(opponents) > 0 else ''
        away_team = opponents[1].get('name', '') if len(opponents) > 1 else ''
        team_names = f"{home_team} vs {away_team}"
        
        # Get event date and time
        start_time = event.get('startTime', 0) / 1000  # Convert from milliseconds
        date_obj = datetime.fromtimestamp(start_time)
        event_date = date_obj.strftime('%Y-%m-%d')
        event_time = date_obj.strftime('%H:%M')
        
        # Extract odds information
        markets = event.get('markets', [])
        home_odds = 0
        draw_odds = 0
        away_odds = 0
        
        for market in markets:
            if market.get('type') == 1:  # 1X2 market
                outcomes = market.get('outcomes', [])
                for outcome in outcomes:
                    outcome_type = outcome.get('type')
                    if outcome_type == 1:  # Home win
                        home_odds = outcome.get('odds', 0)
                    elif outcome_type == 2:  # Draw
                        draw_odds = outcome.get('odds', 0)
                    elif outcome_type == 3:  # Away win
                        away_odds = outcome.get('odds', 0)
        
        # Skip events with incomplete odds
        if home_odds == 0 or draw_odds == 0 or away_odds == 0:
            return None
            
        # Create standardized event object
        processed_event = {
            "id": str(event.get('id', '')),
            "eventId": str(event.get('id', '')),  # Use same ID for consistency
            "originalId": str(event.get('id', '')),
            "teams": team_names,
            "country": country_name,
            "tournament": tournament_name,
            "league": f"{country_name} {tournament_name}",
            "date": event_date,
            "time": event_time,
            "home_odds": str(home_odds),
            "draw_odds": str(draw_odds),
            "away_odds": str(away_odds),
            "odds": {
                "home": float(home_odds),
                "draw": float(draw_odds),
                "away": float(away_odds)
            },
            "source_index": endpoint_idx,
            "source": "sporty"
        }
        
        # Explicitly create a deep copy through serialization/deserialization
        return json.loads(json.dumps(processed_event))
    except Exception as e:
        log(f"Error processing event: {str(e)}")
        log(traceback.format_exc())
        return None

def main():
    all_events = []
    event_ids = set()  # To track duplicates
    
    log("Starting Sportybet data collection from 6 endpoints (Python scraper)")
    
    # Process each endpoint
    for idx, endpoint in enumerate(API_ENDPOINTS):
        log(f"Processing endpoint {idx+1}/6: {endpoint}")
        total_pages = 0
        events_from_endpoint = 0
        
        # Fetch first page to get total pages
        page_data = fetch_page(endpoint)
        if page_data and 'data' in page_data:
            total_pages = page_data.get('data', {}).get('totalPages', 0)
            log(f"Found {total_pages} pages to process for endpoint {idx+1}")
            
            # Process all pages
            for page in range(1, total_pages + 1):
                log(f"Fetching page {page}/{total_pages}")
                if page > 1:  # We already have page 1
                    page_data = fetch_page(endpoint, page)
                
                if page_data and 'data' in page_data:
                    events = page_data.get('data', {}).get('events', [])
                    
                    for event in events:
                        processed_event = process_event(event, idx)
                        if processed_event:
                            event_id = str(event.get('id', ''))
                            if event_id and event_id not in event_ids:
                                event_ids.add(event_id)
                                all_events.append(processed_event)
                                events_from_endpoint += 1
                
                # Be nice to the server
                if page < total_pages:
                    time.sleep(0.5)
        
        log(f"Collected {events_from_endpoint} events from endpoint {idx+1}")
    
    # Save all events to file
    if all_events:
        # Ensure data directory exists
        os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
        
        # First, save to our test file
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(all_events, f, indent=2)
        
        log(f"Saved {len(all_events)} events to test file {OUTPUT_FILE}")
        
        # Then save to the standard output file for the integration
        # This ensures we're compatible with the existing system
        standard_output = "data/sporty.json"
        with open(standard_output, 'w') as f:
            json.dump(all_events, f, indent=2)
        
        # Print to stdout for the integration system to capture
        print(json.dumps(all_events))
        
        log(f"Sportybet scraper (Python) completed with {len(all_events)} total events")
    else:
        log("No events collected, file not saved")
        print("[]")  # Empty array for the integration system

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"Critical error in main process: {str(e)}")
        log(traceback.format_exc())
        # Print empty array for integration system in case of failure
        print("[]")
        sys.exit(1)