#!/usr/bin/env python3
"""
Python implementation of the Sportybet scraper
This scraper is designed to replace the JavaScript version to avoid reference issues
"""

import json
import os
import time
import sys
import re
import requests
from datetime import datetime
import traceback

# Configuration
BASE_URL = "https://www.sportybet.com"
OUTPUT_FILE = "data/sporty_py.json"  # Separate output file for testing
TIMEOUT = 30  # seconds
QUERY = "sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100"
API_ENDPOINTS = [
    "/api/gh/factsCenter/pcUpcomingEvents",  # Ghana
    "/api/ng/factsCenter/pcUpcomingEvents",  # Nigeria
    "/api/ke/factsCenter/pcUpcomingEvents",  # Kenya
    "/api/ug/factsCenter/pcUpcomingEvents",  # Uganda
    "/api/tz/factsCenter/pcUpcomingEvents",  # Tanzania
    "/api/za/factsCenter/pcUpcomingEvents"   # South Africa
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
        # Add timestamp to avoid caching
        timestamp = int(datetime.now().timestamp() * 1000)
        url = f"{BASE_URL}{endpoint}?{QUERY}&pageNum={page}&_t={timestamp}"
        
        log(f"Fetching URL: {url}")
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        
        if response.status_code != 200:
            log(f"Error fetching {url}: Status code {response.status_code}")
            return None
        
        # Check if we got valid JSON
        if not response.text:
            log(f"Error: Empty response from {url}")
            return None
        
        try:
            data = response.json()
            return data
        except Exception as json_error:
            log(f"Error parsing JSON from {url}: {str(json_error)}")
            # Print first 100 characters of response
            log(f"Response starts with: {response.text[:100]}...")
            return None
    except Exception as e:
        log(f"Error fetching {endpoint} page {page}: {str(e)}")
        return None

def process_event(event, endpoint_idx):
    """Process a single event from Sportybet API response"""
    try:
        # Basic validation
        if not event.get('homeTeamName') or not event.get('awayTeamName') or not event.get('eventId'):
            return None
        
        # Extract country and tournament info from the event
        # In pcUpcomingEvents API, we need to extract from a different structure
        country = "Unknown"
        tournament_name = "Unknown Tournament"
        
        # Try to get country and tournament info from the sport data
        if event.get('sport') and event.get('sport', {}).get('category'):
            country = event.get('sport', {}).get('category', {}).get('name', 'Unknown')
        
        # Get tournament name
        if event.get('tournament') and event.get('tournament', {}).get('name'):
            tournament_name = event.get('tournament', {}).get('name', 'Unknown Tournament')
        
        # Extract teams information
        home_team = event.get('homeTeamName', '')
        away_team = event.get('awayTeamName', '')
        team_names = f"{home_team} - {away_team}"  # Notice the dash instead of vs to match Node.js format
        
        # Format the start time
        start_time = None
        if event.get('estimateStartTime'):
            try:
                # In pcUpcomingEvents API, startTime is a timestamp string
                timestamp = int(event.get('estimateStartTime')) / 1000  # Convert to seconds
                date_obj = datetime.fromtimestamp(timestamp)
                start_time = date_obj.strftime('%Y-%m-%d %H:%M')  # Format to "YYYY-MM-DD HH:MM"
            except Exception as e:
                log(f"Error parsing startTime: {str(e)}")
        
        # Find the 1X2 market (home/draw/away)
        home_odds = 0
        draw_odds = 0
        away_odds = 0
        
        # In pcUpcomingEvents, markets is an array
        if event.get('markets') and isinstance(event.get('markets'), list):
            # Find market with id="1" (1X2 market)
            market = next((m for m in event.get('markets', []) if m.get('id') == "1"), None)
            
            if market and market.get('outcomes') and isinstance(market.get('outcomes'), list):
                outcomes = market.get('outcomes', [])
                
                # Extract odds from outcomes
                for outcome in outcomes:
                    desc = outcome.get('desc', '').lower() if outcome.get('desc') else ''
                    
                    if desc == 'home':
                        home_odds = outcome.get('odds', 0)
                    elif desc == 'draw':
                        draw_odds = outcome.get('odds', 0)
                    elif desc == 'away':
                        away_odds = outcome.get('odds', 0)
        
        # Skip events with incomplete odds
        if home_odds == 0 or draw_odds == 0 or away_odds == 0:
            return None
        
        # Normalize the event ID by removing non-numeric characters (removing "sr:match:" prefix)
        # Store both the original ID and the normalized version to help with matching
        original_id = event.get('eventId', '')
        # Use Python regex to remove non-digits
        normalized_id = re.sub(r'\D', '', original_id) if original_id else ''
        
        # Create standardized event object
        processed_event = {
            "eventId": normalized_id,
            "originalEventId": original_id,
            "country": country,
            "tournament": tournament_name,
            "event": team_names,
            "market": "1X2",
            "home_odds": home_odds,
            "draw_odds": draw_odds,
            "away_odds": away_odds,
            "start_time": start_time
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