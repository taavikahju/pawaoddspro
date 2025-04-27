import json
import re

# Read the file
with open('attached_assets/Pasted--bizCode-10000-message-0-0-data-id-sr-tourname-1745781407808.txt', 'r') as f:
    data = f.read()

# Extract distinct events
events = re.findall(r'"eventId": "sr:match:([0-9]+)"', data)
unique_events = set(events)

# Count suspended markets per event
suspended_markets_count = {}
for event_id in unique_events:
    # Extract the section for this event
    event_pattern = r'"eventId": "sr:match:' + event_id + r'".*?(?="eventId": "sr:match:|$)'
    event_data = re.search(event_pattern, data, re.DOTALL)
    if event_data:
        # Count suspendedReason in this event
        suspended_count = event_data.group(0).count('"suspendedReason"')
        suspended_markets_count[event_id] = suspended_count

# Get statistics
total_events = len(unique_events)
events_with_suspended = sum(1 for count in suspended_markets_count.values() if count > 0)
total_suspended_markets = sum(suspended_markets_count.values())

# Get distribution of suspended markets
distribution = {}
for event_id, count in suspended_markets_count.items():
    if count not in distribution:
        distribution[count] = 0
    distribution[count] += 1

# Sort distribution by count
sorted_distribution = sorted(distribution.items())

# Print results
print(f"Total distinct events: {total_events}")
print(f"Events with at least one suspended market: {events_with_suspended}")
print(f"Events with no suspended markets: {total_events - events_with_suspended}")
print(f"Total suspended markets across all events: {total_suspended_markets}")
print(f"Average suspended markets per event: {total_suspended_markets / total_events:.2f}")
print("\nDistribution of suspended markets per event:")
for count, num_events in sorted_distribution:
    print(f"  {count} suspended markets: {num_events} events")

# Print the top 5 events with most suspended markets
print("\nTop 5 events with most suspended markets:")
top_events = sorted(suspended_markets_count.items(), key=lambda x: x[1], reverse=True)[:5]
for event_id, count in top_events:
    print(f"  Event sr:match:{event_id}: {count} suspended markets")
