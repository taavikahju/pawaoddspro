/**
 * Script to test all 15-minute bookmaker scrapers
 * This will run each bookmaker scraper directly and report the event counts
 */

// Import Node.js modules
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the scrapers to test
const scrapers = [
  { name: 'BetPawa Ghana', script: 'server/scrapers/custom/betpawa_gh_scraper.cjs' },
  { name: 'BetPawa Kenya', script: 'server/scrapers/custom/betpawa_ke_scraper.cjs' },
  { name: 'SportyBet', script: 'server/scrapers/custom/sporty_axios_scraper.cjs' }
];

// Function to read stored data
function readStoredData(bookmakerCode) {
  try {
    const dataPath = path.join('data', `${bookmakerCode}.json`);
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return {
        lastUpdated: data.updated || 'Unknown',
        eventCount: data.events?.length || 0,
        events: data.events || []
      };
    }
  } catch (error) {
    console.error(`Error reading data for ${bookmakerCode}:`, error.message);
  }
  return { lastUpdated: 'Never', eventCount: 0, events: [] };
}

// Main function
async function testScrapers() {
  console.log('\n===== BOOKMAKER SCRAPER STATUS =====');
  console.log('Date: ' + new Date().toISOString());
  console.log('=====================================\n');

  // Test each scraper
  for (const scraper of scrapers) {
    console.log(`\n----- Testing ${scraper.name} -----`);
    
    // Extract bookmaker code from script name
    const filename = path.basename(scraper.script);
    const bookmakerCode = filename.replace('_scraper.cjs', '').replace('_scraper.js', '');
    
    // Get stored data
    const stored = readStoredData(bookmakerCode);
    console.log(`Last stored data: ${stored.lastUpdated}`);
    console.log(`Stored event count: ${stored.eventCount}`);
    
    if (stored.eventCount > 0) {
      // Count unique countries and tournaments
      const countries = new Set();
      const tournaments = new Set();
      
      stored.events.forEach(event => {
        if (event.country) countries.add(event.country);
        if (event.tournament || event.league) tournaments.add(event.tournament || event.league);
      });
      
      console.log(`Countries: ${countries.size}`);
      console.log(`Tournaments: ${tournaments.size}`);
      
      // Sample some events
      console.log('\nSample events:');
      for (let i = 0; i < Math.min(3, stored.events.length); i++) {
        const event = stored.events[i];
        console.log(`- ${event.teams || event.name}: ${event.time || 'No time'}`);
      }
    }
  }
  
  console.log('\n===== END OF REPORT =====\n');
}

// Run the test
testScrapers().catch(console.error);