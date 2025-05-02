#!/bin/bash
# This script will test the Python version of the Sportybet scraper

# Function to count events from a JSON file by country
count_events_by_country() {
  local file=$1
  python -c "
import json
import sys

try:
    with open('$file', 'r') as f:
        data = json.load(f)
    
    countries = {}
    epl_count = 0
    
    for event in data:
        country = event.get('country', 'Unknown')
        countries[country] = countries.get(country, 0) + 1
        
        # Count Premier League events
        if country == 'England' and ('Premier League' in event.get('tournament', '') or 'Premier League' in event.get('league', '')):
            epl_count += 1
    
    print(f'Total events: {len(data)}')
    print('Events by country:')
    
    for country, count in sorted(countries.items(), key=lambda x: x[1], reverse=True):
        if count > 10:  # Only show countries with more than 10 events
            print(f'  - {country}: {count} events')
    
    print(f'Premier League events: {epl_count}')
except Exception as e:
    print(f'Error analyzing file: {str(e)}')
    sys.exit(1)
"
}

echo "🔍 Running Python Sportybet scraper test..."
echo "-------------------------------------"

# Backup existing file if it exists
if [ -f "data/sporty.json" ]; then
  cp data/sporty.json data/sporty.json.bak
  echo "📁 Backed up existing sporty.json"
fi

# Run the Python scraper
echo "🚀 Starting Python scraper..."
python ./server/scrapers/custom/sporty_py_scraper.py

# Check if the output file exists
if [ -f "data/sporty_py.json" ]; then
  echo "✅ Python scraper output file created successfully!"
  
  # Count events in the Python scraper output
  PYTHON_COUNT=$(grep -o -i "eventId" data/sporty_py.json | wc -l)
  echo "📊 Python scraper extracted $PYTHON_COUNT events"
  
  echo "-------------------------------------"
  echo "📈 PYTHON SCRAPER ANALYSIS:"
  echo "-------------------------------------"
  count_events_by_country "data/sporty_py.json"
  
  # Check if the standard output file exists (from the Node.js scraper)
  if [ -f "data/sporty.json.bak" ]; then
    echo "-------------------------------------"
    echo "📈 NODE.JS SCRAPER ANALYSIS (from backup):"
    echo "-------------------------------------"
    NODE_COUNT=$(grep -o -i "eventId" data/sporty.json.bak | wc -l)
    echo "📊 Current Node.js scraper has $NODE_COUNT events"
    count_events_by_country "data/sporty.json.bak"
    
    # Calculate percentage of events that match
    if [ $NODE_COUNT -gt 0 ]; then
      PERCENT=$(( PYTHON_COUNT * 100 / NODE_COUNT ))
      echo "-------------------------------------"
      echo "🔄 COMPARISON:"
      echo "Python scraper captured ${PERCENT}% of Node.js scraper events"
      
      if [ $PERCENT -ge 95 ]; then
        echo "✅ EXCELLENT: Python scraper is capturing >= 95% of events"
      elif [ $PERCENT -ge 90 ]; then
        echo "✅ GOOD: Python scraper is capturing >= 90% of events"
      elif [ $PERCENT -ge 80 ]; then
        echo "⚠️ ACCEPTABLE: Python scraper is capturing >= 80% of events"
      else
        echo "❌ POOR: Python scraper is capturing < 80% of events"
      fi
    fi
  else
    echo "⚠️ No Node.js scraper output file found for comparison"
  fi
else
  echo "❌ Error: Python scraper did not create an output file"
  exit 1
fi

# Check if the standard output file exists
if [ -f "data/sporty.json" ]; then
  echo "-------------------------------------"
  echo "✅ Standard output file also created successfully!"
  STANDARD_COUNT=$(grep -o -i "eventId" data/sporty.json | wc -l)
  echo "📊 Standard output file has $STANDARD_COUNT events"
else
  echo "❌ Error: Standard output file was not created"
fi

echo "-------------------------------------"
echo "✅ Test complete. You can examine data/sporty_py.json for details."
echo "To switch to the Python scraper, run: ./switch-scraper.sh python"