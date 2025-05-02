#!/bin/bash
# This script will test the Python version of the Sportybet scraper

echo "Running Python Sportybet scraper test..."
python ./server/scrapers/custom/sporty_py_scraper.py

# Check if the output file exists
if [ -f "data/sporty_py.json" ]; then
  echo "Python scraper output file created successfully!"
  
  # Count events in the Python scraper output
  PYTHON_COUNT=$(grep -o -i "id" data/sporty_py.json | wc -l)
  echo "Python scraper extracted $PYTHON_COUNT events"
  
  # Check if the standard output file exists (from the Node.js scraper)
  if [ -f "data/sporty.json" ]; then
    NODE_COUNT=$(grep -o -i "id" data/sporty.json | wc -l)
    echo "Current Node.js scraper has $NODE_COUNT events"
    
    # Calculate percentage of events that match
    if [ $NODE_COUNT -gt 0 ]; then
      PERCENT=$(( PYTHON_COUNT * 100 / NODE_COUNT ))
      echo "Python scraper captured ${PERCENT}% of Node.js scraper events"
    fi
  else
    echo "No Node.js scraper output file found for comparison"
  fi
else
  echo "Error: Python scraper did not create an output file"
  exit 1
fi

echo "Test complete. You can now examine data/sporty_py.json for details."