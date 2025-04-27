import json
import re

# Read the file
with open('attached_assets/Pasted--bizCode-10000-message-0-0-data-id-sr-tourname-1745781407808.txt', 'r') as f:
    data = f.read()

# Extract distinct events
events = re.findall(r'"eventId": "sr:match:([0-9]+)"', data)
unique_events = set(events)

# Count events with suspended 1X2 markets
events_with_suspended_1x2 = set()

for event_id in unique_events:
    # Extract the section for this event
    event_pattern = r'"eventId": "sr:match:' + event_id + r'".*?(?="eventId": "sr:match:|$)'
    event_data = re.search(event_pattern, data, re.DOTALL)
    
    if event_data:
        event_content = event_data.group(0)
        
        # Look for 1X2 market with suspension
        pattern = r'"name": "1X2".*?"suspendedReason"'
        if re.search(pattern, event_content, re.DOTALL):
            # Extract team names
            teams_match = re.search(r'"homeTeamName": "([^"]+)".*?"awayTeamName": "([^"]+)"', event_content, re.DOTALL)
            if teams_match:
                home_team = teams_match.group(1)
                away_team = teams_match.group(2)
                events_with_suspended_1x2.add((event_id, f"{home_team} vs {away_team}"))
                
                # Find the specific suspension reason for this 1X2 market
                market_pattern = r'"name": "1X2".*?"suspendedReason": "([^"]+)"'
                reason_match = re.search(market_pattern, event_content, re.DOTALL)
                if reason_match:
                    reason = reason_match.group(1)
                    # Add the reason to the tuple
                    events_with_suspended_1x2.remove((event_id, f"{home_team} vs {away_team}"))
                    events_with_suspended_1x2.add((event_id, f"{home_team} vs {away_team}", reason))

# Print results
print(f"Total events with suspended 1X2 markets: {len(events_with_suspended_1x2)}")
print("\nEvents with suspended 1X2 markets:")
for event_info in sorted(events_with_suspended_1x2):
    if len(event_info) == 3:
        event_id, match, reason = event_info
        print(f"  Event sr:match:{event_id} - {match} (Reason: {reason})")
    else:
        event_id, match = event_info
        print(f"  Event sr:match:{event_id} - {match}")

# Count how many of each suspension reason
if any(len(event_info) == 3 for event_info in events_with_suspended_1x2):
    print("\nSuspension reasons for 1X2 markets:")
    reason_counts = {}
    for event_info in events_with_suspended_1x2:
        if len(event_info) == 3:
            reason = event_info[2]
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
    
    for reason, count in sorted(reason_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {reason}: {count} events")
