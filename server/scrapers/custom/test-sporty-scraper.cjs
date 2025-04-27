#!/usr/bin/env node

/**
 * Test script for running and analyzing SportyBet scraper data
 * This helps identify issues with the scraper data format
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the wrapper scraper
const scraperPath = path.join(__dirname, 'sporty_scraper_wrapper.cjs');

// Function to run the scraper and get its output
async function runScraper() {
  return new Promise((resolve, reject) => {
    console.log(`Running scraper at: ${scraperPath}`);
    const scraper = spawn('node', [scraperPath]);
    
    let output = '';
    let errorOutput = '';
    
    scraper.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    scraper.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // Also log errors directly to console
      console.error(data.toString());
    });
    
    scraper.on('error', (error) => {
      console.error('Error running scraper:', error);
      reject(error);
    });
    
    scraper.on('close', (code) => {
      console.log(`Scraper exited with code ${code}`);
      
      if (code !== 0) {
        console.error(`Scraper exited with error code ${code}`);
        console.error('Error output:', errorOutput);
        reject(new Error(`Scraper exited with code ${code}`));
      } else {
        try {
          // Try to parse the output as JSON
          const data = JSON.parse(output);
          resolve(data);
        } catch (error) {
          console.error('Failed to parse scraper output:', error);
          console.error('Raw output:', output);
          reject(error);
        }
      }
    });
  });
}

// Main execution
async function main() {
  try {
    console.log('Running SportyBet scraper test...');
    const events = await runScraper();
    
    if (!Array.isArray(events)) {
      console.error('Scraper did not return a valid array');
      return;
    }
    
    console.log(`Scraper returned ${events.length} events`);
    
    // Log the first few events for analysis
    if (events.length > 0) {
      console.log('First event:', JSON.stringify(events[0], null, 2));
      
      // Check event format
      const firstEvent = events[0];
      console.log('Event format analysis:');
      console.log('- Has id:', !!firstEvent.id);
      console.log('- Has teams:', !!firstEvent.teams);
      console.log('- Has league:', !!firstEvent.league);
      console.log('- Has bookmakerCode:', !!firstEvent.bookmakerCode);
      console.log('- Has odds object:', !!firstEvent.odds);
      
      if (firstEvent.odds) {
        console.log('- Odds format:');
        console.log('  - home:', firstEvent.odds.home);
        console.log('  - draw:', firstEvent.odds.draw);
        console.log('  - away:', firstEvent.odds.away);
      }
      
      // Save data to a file for further analysis
      const outputFile = path.join(__dirname, 'sporty-test-output.json');
      fs.writeFileSync(outputFile, JSON.stringify(events, null, 2));
      console.log(`Saved ${events.length} events to ${outputFile}`);
    }
  } catch (error) {
    console.error('Error in test script:', error);
  }
}

// Start execution
main();