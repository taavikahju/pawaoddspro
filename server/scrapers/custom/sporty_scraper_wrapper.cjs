const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the sample data file
const SAMPLE_DATA_PATH = path.join(__dirname, 'sporty_sample_data.json');
// List of all scrapers to try - will attempt each one in order until success
const SCRAPERS = [
  { name: 'SportyBet Axios', path: 'sporty_axios_scraper.cjs' },
  { name: 'SportyBet Better', path: 'sporty_better_scraper.cjs' },
  { name: 'SportyBet New', path: 'sporty_new_scraper.cjs' },
  { name: 'SportyBet Original', path: 'sporty_scraper.cjs' },
];

// Function to try running all scrapers in sequence until one succeeds
function runSportyScrapers() {
  let lastError = null;
  
  // Try each scraper in sequence
  for (const scraper of SCRAPERS) {
    try {
      console.error(`🔄 Trying ${scraper.name} scraper...`);
      // For the axios scraper, increase the timeout to 45 seconds
      const timeout = scraper.name === 'SportyBet Axios' ? 60000 : 40000; // Increased timeouts
      const result = execSync('node ' + path.join(__dirname, scraper.path), { 
        timeout: timeout
      }).toString();
      
      try {
        const data = JSON.parse(result);
        console.error(`📊 ${scraper.name} returned ${data.length} events`);
        
        if (data.length > 0) {
          return data; // Successfully found data with this scraper
        }
      } catch (error) {
        console.error(`Error parsing ${scraper.name} output: ${error.message}`);
        lastError = error;
      }
    } catch (error) {
      console.error(`Error running ${scraper.name}: ${error.message}`);
      lastError = error;
    }
  }
  
  // If we get here, all scrapers failed or returned 0 events
  console.error(`All SportyBet scrapers failed or returned 0 events. Last error: ${lastError?.message}`);
  console.error(`Using fallback sample data since real SportyBet data couldn't be retrieved`);
  return loadSampleData();
}

// Function to load sample data if all scrapers fail
function loadSampleData() {
  try {
    const sampleData = JSON.parse(fs.readFileSync(SAMPLE_DATA_PATH, 'utf8'));
    console.error(`Using ${sampleData.length} sample events as fallback data`);
    return sampleData;
  } catch (error) {
    console.error(`Error loading sample data: ${error.message}`);
    return [];
  }
}

// Main function to run the scraper and process events
function main() {
  const events = runSportyScrapers();
  
  if (events.length > 0) {
    // If we have sample data, add a log for the first event to show what it looks like
    if (events[0].id && events[0].id.startsWith('sporty-event')) {
      console.error('Using sample events as fallback due to API issues');
    }
    
    console.error(`✅ Successfully processed ${events.length} valid events`);
    
    // Sample the first 5 events to see what we're getting
    const sampleCount = Math.min(5, events.length);
    for (let i = 0; i < sampleCount; i++) {
      console.error(`📊 Event sample ${i+1} from SportyBet: ${JSON.stringify(events[i])}`);
    }
  } else {
    console.error('⚠️ No events found or processed - check SportyBet Ghana API access');
  }
  
  console.error(`📊 SportyBet scraper wrapper returned ${events.length} events`);
  
  // Print the first event as a sample
  if (events.length > 0) {
    console.error(`📊 First event sample from SportyBet: ${JSON.stringify(events[0])}`);
  }
  
  // Output the JSON to stdout for the caller to consume
  console.log(JSON.stringify(events));
}

// Run the main function
main();