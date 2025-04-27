import json
import re

# Read the file
with open('attached_assets/Pasted--bizCode-10000-message-0-0-data-id-sr-tourname-1745781407808.txt', 'r') as f:
    data = f.read()

# Get the top 3 events with most suspended markets
events_with_data = {}
for event_id in ['51273471', '58787777', '50955899']:
    event_pattern = r'"eventId": "sr:match:' + event_id + r'".*?(?="eventId": "sr:match:|$)'
    event_data = re.search(event_pattern, data, re.DOTALL)
    if event_data:
        full_text = event_data.group(0)
        
        # Extract team names and status
        teams_match = re.search(r'"homeTeamName": "([^"]+)".*?"awayTeamName": "([^"]+)"', full_text, re.DOTALL)
        status_match = re.search(r'"status": (\d+)', full_text)
        minute_match = re.search(r'"playedSeconds": "([^"]+)"', full_text)
        period_match = re.search(r'"period": "([^"]+)"', full_text)
        
        if teams_match and status_match:
            home_team = teams_match.group(1)
            away_team = teams_match.group(2)
            status = status_match.group(1)
            minute = minute_match.group(1) if minute_match else "N/A"
            period = period_match.group(1) if period_match else "N/A"
            
            suspended_reasons = re.findall(r'"suspendedReason": "([^"]+)"', full_text)
            reason_counts = {}
            for reason in suspended_reasons:
                reason_counts[reason] = reason_counts.get(reason, 0) + 1
            
            events_with_data[event_id] = {
                'match': f"{home_team} vs {away_team}",
                'status': status,
                'period': period,
                'minute': minute,
                'total_suspended': len(suspended_reasons),
                'reason_counts': reason_counts
            }

# Print detailed information
print("Details of top events with most suspended markets:\n")
for event_id, info in events_with_data.items():
    print(f"Event sr:match:{event_id} - {info['match']}")
    print(f"  Status: {info['status']}, Period: {info['period']}, Minute: {info['minute']}")
    print(f"  Total suspended markets: {info['total_suspended']}")
    print("  Suspension reasons:")
    for reason, count in info['reason_counts'].items():
        print(f"    {reason}: {count} markets")
    print()
