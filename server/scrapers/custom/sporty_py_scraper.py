#!/usr/bin/env python3
"""
Python implementation of the Sportybet scraper
This scraper is designed to replace the JavaScript version to avoid reference issues

To use this scraper, set the environment variable:
USE_PYTHON_SPORTYBET=true
"""
# Set Node.js compatibility mode for Python-Node.js integration
import sys
import json
import os
import time
import re
import requests
from datetime import datetime
import traceback

# Make sure stdout is line buffered for integration with Node.js
# Different Python versions have different ways to handle this
try:
    # Python 3.7+ way
    sys.stdout.reconfigure(line_buffering=True)
except AttributeError:
    # Handle older Python versions that don't have reconfigure
    # Just use flush=True with print statements instead
    pass

# Configuration
BASE_URL = "https://www.sportybet.com/api/gh/factsCenter/pcUpcomingEvents"
OUTPUT_FILE = "data/sporty_py.json"  # Separate output file for testing
TIMEOUT = 15  # Reduce timeout to 15 seconds
QUERY = "sportId=sr%3Asport%3A1&marketId=1%2C18%2C10%2C29%2C11%2C26%2C36%2C14%2C60100&pageSize=100"
MAX_PAGES = 20  # Maximum number of pages to fetch (increased to capture more events)

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json"
}

def log(message, level="info"):
    """Log messages with timestamp
    
    Levels:
    - critical: Always log
    - error: Always log errors
    - warning: Log warnings only when LOG_LEVEL is warning or lower
    - info: Only log when LOG_LEVEL is info or lower
    - debug: Only log when LOG_LEVEL is debug
    """
    # Get log level from environment variable, default to info
    env_log_level = os.environ.get("LOG_LEVEL", "info").lower()
    
    # Define log level priorities (lower number = higher priority)
    log_levels = {
        "critical": 0,
        "error": 1,
        "warning": 2,
        "info": 3,
        "debug": 4
    }
    
    # Default to info if level is not recognized
    current_level_priority = log_levels.get(level.lower(), 3)
    env_level_priority = log_levels.get(env_log_level, 3)
    
    # Only log if the message level is higher priority (lower number) than or equal to the env setting
    if current_level_priority <= env_level_priority:
        timestamp = datetime.now().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
        # Write logs to stderr instead of stdout to keep stdout clean for JSON output
        print(f"[{timestamp}] [{level.upper()}] {message}", file=sys.stderr, flush=True)

def fetch_page(page=1):
    """Fetch a single page from Sportybet API"""
    try:
        # Add timestamp to avoid caching
        timestamp = int(datetime.now().timestamp() * 1000)
        url = f"{BASE_URL}?{QUERY}&pageNum={page}&_t={timestamp}"
        
        log(f"Fetching URL: {url}", "debug")
        response = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        
        if response.status_code != 200:
            log(f"Error fetching {url}: Status code {response.status_code}", "error")
            return None
        
        # Check if we got valid JSON
        if not response.text:
            log(f"Error: Empty response from {url}", "error")
            return None
        
        try:
            data = response.json()
            return data
        except Exception as json_error:
            log(f"Error parsing JSON from {url}: {str(json_error)}", "error")
            # Print first 100 characters of response
            log(f"Response starts with: {response.text[:100]}...", "debug")
            return None
    except Exception as e:
        log(f"Error fetching page {page}: {str(e)}", "error")
        return None

def process_event(event, endpoint_idx=0):
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
                log(f"Error parsing startTime: {str(e)}", "error")
        
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
        log(f"Error processing event: {str(e)}", "error")
        log(traceback.format_exc(), "debug")
        return None

def process_tournaments(tournaments):
    """Process the raw tournament data into our standardized format"""
    processed_events = []
    event_count = 0
    skipped_count = 0
    
    # Special event IDs to track (for Premier League)
    SPECIAL_EVENT_IDS = ['50850679', '50850810', '50850826', '50850822']
    special_events_found = {}
    
    # Track progress
    log(f"Processing {len(tournaments)} tournaments...")
    
    # Track England Premier League events specifically
    epl_events = {
        'found': 0,
        'with_odds': 0,
        'dates': set(),
        'teams': []
    }
    
    for tournament in tournaments:
        try:
            # Extract country and tournament name
            country = "Unknown"
            tournament_name = tournament.get('name', 'Unknown Tournament')
            
            # Check if this is EPL
            if 'events' in tournament and len(tournament['events']) > 0:
                first_event = tournament['events'][0]
                if 'sport' in first_event and 'category' in first_event['sport']:
                    country = first_event['sport']['category'].get('name', 'Unknown')
            
            is_epl = (country == 'England' and 
                     (tournament_name.find('Premier League') >= 0 or 
                      tournament_name.find('Premier league') >= 0))
            
            if is_epl:
                log(f"🏴󠁧󠁢󠁥󠁮󠁧󠁿 Found England Premier League tournament: {tournament_name}")
            
            if 'events' not in tournament or not isinstance(tournament['events'], list):
                continue
                
            # Process each event in the tournament
            for event in tournament['events']:
                try:
                    # Basic validation
                    if not event.get('homeTeamName') or not event.get('awayTeamName') or not event.get('eventId'):
                        skipped_count += 1
                        continue
                        
                    # Find the 1X2 market (home/draw/away)
                    market = next((m for m in event.get('markets', []) if m.get('id') == "1"), None)
                    if not market or not market.get('outcomes') or not isinstance(market.get('outcomes'), list):
                        skipped_count += 1
                        
                        # Track EPL events without odds
                        if is_epl:
                            log(f"❌ EPL event without markets: {event.get('homeTeamName')} vs {event.get('awayTeamName')} (ID: {event.get('eventId')})")
                        continue
                    
                    # Extract odds from the outcomes
                    outcomes = [{'desc': o.get('desc', '').lower(), 'odds': o.get('odds', 0)} for o in market.get('outcomes', [])]
                    
                    # Find the specific odds we need
                    home_odds = next((o['odds'] for o in outcomes if o['desc'] == 'home'), 0)
                    draw_odds = next((o['odds'] for o in outcomes if o['desc'] == 'draw'), 0)
                    away_odds = next((o['odds'] for o in outcomes if o['desc'] == 'away'), 0)
                    
                    # Skip events with missing odds
                    if home_odds == 0 and draw_odds == 0 and away_odds == 0:
                        skipped_count += 1
                        
                        # Track EPL events without odds
                        if is_epl:
                            log(f"❌ EPL event with zero odds: {event.get('homeTeamName')} vs {event.get('awayTeamName')} (ID: {event.get('eventId')})")
                        continue
                    
                    # Format the start time
                    start_time = None
                    if event.get('estimateStartTime'):
                        try:
                            date_obj = datetime.fromtimestamp(int(event.get('estimateStartTime')) / 1000)
                            start_time = date_obj.strftime('%Y-%m-%d %H:%M')
                        except:
                            pass
                    
                    # Normalize the event ID by removing non-numeric characters
                    original_id = event.get('eventId', '')
                    normalized_id = re.sub(r'\D', '', original_id) if original_id else ''
                    
                    # Check if this is one of our special tracked events
                    if any(normalized_id == id or original_id.find(id) >= 0 for id in SPECIAL_EVENT_IDS):
                        matched_id = next((id for id in SPECIAL_EVENT_IDS if normalized_id == id or original_id.find(id) >= 0), None)
                        if matched_id:
                            special_events_found[matched_id] = True
                            log(f"\n🔍 FOUND SPECIAL EVENT ID {matched_id}:")
                            log(f"- Teams: {event.get('homeTeamName')} vs {event.get('awayTeamName')}")
                            log(f"- Original ID: {original_id}")
                            log(f"- Normalized ID: {normalized_id}")
                            log(f"- Country: {country}")
                            log(f"- Tournament: {tournament_name}")
                            log(f"- Odds: Home={home_odds}, Draw={draw_odds}, Away={away_odds}")
                            log(f"- Start Time: {start_time}")
                            log(f"- Is EPL: {is_epl}")
                            log("")
                    
                    # Track EPL events
                    if is_epl:
                        epl_events['found'] += 1
                        epl_events['with_odds'] += 1
                        if start_time:
                            epl_events['dates'].add(start_time.split(' ')[0])  # Just the date part
                        epl_events['teams'].append({
                            'teams': f"{event.get('homeTeamName')} - {event.get('awayTeamName')}",
                            'date': start_time,
                            'eventId': original_id,
                            'normalizedId': normalized_id,
                            'odds': {'home': home_odds, 'draw': draw_odds, 'away': away_odds}
                        })
                    
                    # Add the processed event to our collection
                    processed_events.append({
                        'eventId': normalized_id,
                        'originalEventId': original_id,
                        'country': country,
                        'tournament': tournament_name,
                        'event': f"{event.get('homeTeamName')} - {event.get('awayTeamName')}",
                        'market': "1X2",
                        'home_odds': home_odds,
                        'draw_odds': draw_odds,
                        'away_odds': away_odds,
                        'start_time': start_time
                    })
                    
                    event_count += 1
                except Exception as e:
                    log(f"Error processing event: {str(e)}", "error")
                    skipped_count += 1
                    continue
        except Exception as e:
            log(f"Error processing tournament: {str(e)}", "error")
            continue
    
    # Log EPL specific stats
    if epl_events['found'] > 0:
        log("\n🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLAND PREMIER LEAGUE SUMMARY:")
        log(f"- Found {epl_events['found']} total EPL events")
        log(f"- {epl_events['with_odds']} events have valid odds")
        log(f"- Dates covered: {', '.join(sorted(epl_events['dates']))}")
        
        # Sort by date for easier inspection
        epl_events['teams'].sort(key=lambda t: t['date'] if t['date'] else '')
        
        # Print team information grouped by date
        current_date = ''
        for team in epl_events['teams']:
            date = team['date'].split(' ')[0] if team['date'] else 'Unknown date'
            if date != current_date:
                log(f"\n  {date}:")
                current_date = date
            log(f"  - {team['teams']} (ID: {team['normalizedId']}) Odds: {team['odds']['home']}/{team['odds']['draw']}/{team['odds']['away']}")
    
    # Report on our special event tracking
    for special_id in SPECIAL_EVENT_IDS:
        if special_id not in special_events_found:
            log(f"\n⚠️ SPECIAL EVENT ID {special_id} WAS NOT FOUND in any tournament!")
    
    log(f"✅ Successfully processed {event_count} events (skipped {skipped_count})")
    return processed_events

def main():
    """Main entry point for the scraper"""
    try:
        # Global runtime limit to avoid hanging
        start_time = time.time()
        max_runtime = 120  # seconds
        
        # Log the startup
        log("Starting Sportybet data collection (Python scraper)")
        
        all_tournaments = []
        total_events = 0
        
        # Get total pages to process
        page = 1
        more_pages = True
        log(f"📚 Will attempt to fetch up to {MAX_PAGES} pages of data")
        
        while more_pages and page <= MAX_PAGES:
            if time.time() - start_time > max_runtime:
                log(f"⚠️ Reached maximum runtime limit of {max_runtime} seconds, stopping after {page-1} pages.")
                break
            
            try:
                # Get data for this page
                page_data = fetch_page(page)
                
                if not page_data or 'data' not in page_data or 'tournaments' not in page_data['data']:
                    log(f"❌ Invalid data format from page {page} - no tournaments found")
                    # Try one more page before giving up
                    if page > 1:
                        more_pages = False
                    page += 1
                    continue
                
                # Process the tournaments
                tournaments = page_data['data'].get('tournaments', [])
                log(f"📊 Found {len(tournaments)} tournaments on page {page}")
                
                # Check if we have events on this page
                page_events = sum(len(t.get('events', [])) for t in tournaments)
                total_events += page_events
                log(f"📊 Found {page_events} events on page {page} (total: {total_events})")
                
                # If page has no events or tournaments, we've likely reached the end
                if page_events == 0 or len(tournaments) == 0:
                    log(f"📊 No more events found after page {page}, stopping pagination")
                    more_pages = False
                else:
                    # Store tournaments for processing
                    all_tournaments.extend(tournaments)
                
                # Short pause between requests to be polite to the server
                time.sleep(0.5)
                
                # Move to next page
                page += 1
            except Exception as e:
                log(f"❌ Error processing page {page}: {str(e)}", "error")
                log(traceback.format_exc(), "debug")
                # Try to continue with next page
                page += 1
        
        # Process all tournaments with time monitoring
        elapsed_seconds = (time.time() - start_time)
        log(f"Processing tournaments after {elapsed_seconds:.1f}s/{max_runtime}s...")
        
        # Check if we have enough time left for processing
        if elapsed_seconds > max_runtime * 0.7:  # If we've used 70% of our time already
            log(f"⚠️ Limited time remaining, processing only a subset of collected tournaments")
            # Take only a subset if we have too many to process
            if len(all_tournaments) > 20:
                log(f"Limiting from {len(all_tournaments)} to 20 tournaments for faster processing")
                # Prioritize England tournaments first to ensure Premier League events
                england_tournaments = [t for t in all_tournaments if 'events' in t and len(t['events']) > 0 
                                      and 'sport' in t['events'][0] and 'category' in t['events'][0]['sport'] 
                                      and t['events'][0]['sport']['category'].get('name', '') == 'England']
                other_tournaments = [t for t in all_tournaments if t not in england_tournaments]
                all_tournaments = england_tournaments + other_tournaments[:max(0, 20 - len(england_tournaments))]
        
        all_events = process_tournaments(all_tournaments)
        log(f"Total: collected {len(all_events)} events")
        
        # Save all events to file
        if all_events:
            # 1. Ensure data directory exists for both files
            os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
            os.makedirs("data", exist_ok=True)  # Ensure data dir exists for standard output
            
            # Count by country for reporting
            country_counts = {}
            premier_league_count = 0
            
            for event in all_events:
                country = event.get('country', 'Unknown')
                country_counts[country] = country_counts.get(country, 0) + 1
                
                # Count Premier League events
                if country == 'England' and event.get('tournament', '').find('Premier League') >= 0:
                    premier_league_count += 1
            
            # 2. Save to our test file - clear and detailed output for diagnostics
            with open(OUTPUT_FILE, 'w') as f:
                json.dump(all_events, f, indent=2)
            
            log(f"Saved {len(all_events)} events to test file {OUTPUT_FILE}")
            
            # 3. Write a diagnostic summary
            log("\n=============== EVENT SUMMARY ===============")
            log(f"Total events: {len(all_events)}")
            log(f"Events by country:")
            
            for country, count in sorted(country_counts.items(), key=lambda x: x[1], reverse=True):
                log(f"  - {country}: {count} events")
            
            log(f"Premier League events: {premier_league_count}")
            
            # 4. Save to the standard output file for integration
            standard_output = "data/sporty.json"
            with open(standard_output, 'w') as f:
                json.dump(all_events, f, indent=2)
            
            log(f"Saved {len(all_events)} events to standard file {standard_output}")
            
            # 5. Print to stdout for the integration system to capture
            # Important: We route all log messages to stderr
            # This allows us to output clean JSON to stdout without any interleaved log messages
            
            # Prepare the JSON output in memory first to catch any serialization errors
            try:
                output_json = json.dumps(all_events)
                
                # Important: Print ONLY the JSON output to stdout for the Node.js integration to capture
                # All logs should be written to stderr, keeping stdout clean for JSON output
                print(output_json)  # This goes to stdout
                sys.stdout.flush()  # Force flush to ensure Node.js receives the data
            except Exception as e:
                log(f"Error serializing to stdout: {str(e)}", "error")
                # Return empty JSON array to stdout on error
                print("[]")  # This goes to stdout
                sys.stdout.flush()
                
            # Only log after we've printed the JSON
            log(f"✅ Sportybet scraper (Python) completed with {len(all_events)} total events")
        else:
            log("⚠️ No events collected, file not saved")
            # Return empty array to stdout
            print("[]")  # This goes to stdout
            sys.stdout.flush()  # Force flush
        
        return 0
    except Exception as e:
        log(f"❌ Error in main function: {str(e)}", "critical")
        log(traceback.format_exc(), "error")
        # Return empty array to stdout on error
        print("[]")  # This goes to stdout
        sys.stdout.flush()  # Force flush
        
        return 1

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"Critical error in main process: {str(e)}", "critical")
        log(traceback.format_exc(), "error")
        # Return empty array to stdout on error
        print("[]")  # This goes to stdout
        sys.stdout.flush()  # Force flush
        sys.exit(1)