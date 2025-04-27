import json
import re

# Read the file
with open('attached_assets/Pasted--bizCode-10000-message-0-0-data-id-sr-tourname-1745781407808.txt', 'r') as f:
    data = f.read()

# Find all unique event IDs
events = re.findall(r'"eventId": "sr:match:([0-9]+)"', data)
unique_events = set(events)

# Find events with suspended markets
events_with_suspended = set()
for event_id in unique_events:
    # Look for suspended markets in this event
    pattern = r'"eventId": "sr:match:' + event_id + r'".*?("suspendedReason":)'
    if re.search(pattern, data, re.DOTALL):
        events_with_suspended.add(event_id)

# Print results
print(f"Total distinct events: {len(unique_events)}")
print(f"Events with at least one suspended market: {len(events_with_suspended)}")
print(f"Events with no suspended markets: {len(unique_events) - len(events_with_suspended)}")
