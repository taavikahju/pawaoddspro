#!/usr/bin/env node

// This is a wrapper around the SportyBet enhanced scraper
// that ensures the data is properly formatted for the odds comparison

// Import the original implementation
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Path to the better scraper
// We're now using the better scraper with the new factsCenter/pcUpcomingEvents API endpoint
const scraperPath = path.join(__dirname, 'sporty_better_scraper.cjs');

// Function to run the scraper and get its output
async function runScraper() {
  return new Promise((resolve, reject) => {
    const scraper = spawn('node', [scraperPath]);
    
    let output = '';
    let errorOutput = '';
    
    scraper.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    scraper.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // Also log errors directly to console for debugging
      process.stderr.write(data);
    });
    
    scraper.on('error', (error) => {
      console.error('Error running scraper:', error);
      reject(error);
    });
    
    scraper.on('close', (code) => {
      if (code !== 0) {
        console.error(`Scraper exited with code ${code}`);
        reject(new Error(`Scraper exited with code ${code}`));
      } else {
        try {
          let data = JSON.parse(output);
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

// Load sample data for use in fallback scenarios
const sampleDataPath = path.join(__dirname, 'sporty_sample_data.json');
let sampleData = [];

try {
  if (fs.existsSync(sampleDataPath)) {
    sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    console.error(`Loaded ${sampleData.length} sample events as fallback data`);
  }
} catch (error) {
  console.error('Error loading sample data:', error);
}

// Process the events to ensure consistent data format
function processEvents(events) {
  // If we have no events and sample data exists, use the sample data
  if (events.length === 0 && sampleData.length > 0) {
    console.error(`Using ${sampleData.length} sample events as fallback due to API issues`);
    // Use the direct sample data since it's already in the right format
    return sampleData;
  }
  
  return events.map(event => {
    // Ensure we have standardized fields
    const processedEvent = {
      id: event.id || `sporty-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      teams: event.event || event.teams || `${event.homeTeamName || 'Unknown'} vs ${event.awayTeamName || 'Unknown'}`,
      league: event.tournament || event.league || 'Unknown League',
      sport: 'football',
      date: event.date || (event.start_time ? event.start_time.split('T')[0] : new Date().toISOString().split('T')[0]),
      time: event.time || (event.start_time ? event.start_time.split('T')[1].substring(0, 5) : new Date().toISOString().split('T')[1].substring(0, 5)),
      bookmakerCode: 'sporty', // Explicitly set the bookmaker code
      odds: {
        home: parseFloat(event.home_odds || event.homeOdds || event['1'] || 0) || 0,
        draw: parseFloat(event.draw_odds || event.drawOdds || event.X || 0) || 0,
        away: parseFloat(event.away_odds || event.awayOdds || event['2'] || 0) || 0
      }
    };
    
    // If no valid odds, set to 0 to avoid NaN errors
    if (isNaN(processedEvent.odds.home)) processedEvent.odds.home = 0;
    if (isNaN(processedEvent.odds.draw)) processedEvent.odds.draw = 0;
    if (isNaN(processedEvent.odds.away)) processedEvent.odds.away = 0;
    
    return processedEvent;
  }).filter(event => {
    // Filter out events with no valid odds
    return (
      event.odds.home > 0 && 
      event.odds.draw > 0 && 
      event.odds.away > 0 &&
      event.teams && 
      (event.teams.includes(' vs ') || event.teams.includes(' - ') || event.teams.includes('-'))
    );
  });
}

// Main execution
async function main() {
  try {
    console.error('🔄 Running SportyBet scraper with new factsCenter/pcUpcomingEvents API...');
    const events = await runScraper();
    
    if (!Array.isArray(events)) {
      console.error('❌ Scraper did not return a valid array');
      console.log(JSON.stringify([]));
      return;
    }
    
    console.error(`📊 Scraper returned ${events.length} events`);
    
    // Process and format the events
    const processedEvents = processEvents(events);
    
    console.error(`✅ Successfully processed ${processedEvents.length} valid events`);
    
    // Log a sample of the processed events for debugging
    if (processedEvents.length > 0) {
      console.error('Sample event:', JSON.stringify(processedEvents[0], null, 2));
    }
    
    // Output the processed events as JSON
    console.log(JSON.stringify(processedEvents));
  } catch (error) {
    console.error('Error in wrapper:', error);
    console.log(JSON.stringify([]));
  }
}

// Start execution
main();