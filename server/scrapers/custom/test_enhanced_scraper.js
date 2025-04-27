#!/usr/bin/env node

/**
 * Test script for running the enhanced SportyBet scraper directly
 * 
 * This script runs the enhanced SportyBet scraper and checks its output
 * to ensure it's functioning correctly.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRAPER_PATH = path.join(__dirname, 'sporty_scraper_enhanced.cjs');

console.log('Testing Enhanced SportyBet Scraper');
console.log(`Scraper path: ${SCRAPER_PATH}`);

try {
  // Run the scraper and capture the output
  console.log('Running scraper...');
  const output = execSync(`node ${SCRAPER_PATH}`, { 
    timeout: 90000, // 90 second timeout
    maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large output
  }).toString();
  
  // Parse the output as JSON to verify it's valid
  const events = JSON.parse(output);
  
  // Check that we got some events
  if (!Array.isArray(events)) {
    console.error('❌ ERROR: Scraper did not return an array!');
    process.exit(1);
  }
  
  console.log(`✅ Success! Scraper returned ${events.length} events.`);
  
  // Output sample of events
  console.log('\nSample events:');
  const sampleSize = Math.min(5, events.length);
  for (let i = 0; i < sampleSize; i++) {
    const event = events[i];
    console.log(`[${i+1}] ${event.teams} (${event.league}): ${event.home_odds} - ${event.draw_odds} - ${event.away_odds}`);
  }
  
  // Output the breakdown of data by country/tournament
  console.log('\nEvent breakdown by country:');
  const countries = {};
  events.forEach(event => {
    const country = event.country || 'Unknown';
    if (!countries[country]) countries[country] = 0;
    countries[country]++;
  });
  
  Object.entries(countries)
    .sort((a, b) => b[1] - a[1])
    .forEach(([country, count]) => {
      console.log(`- ${country}: ${count} events`);
    });
    
  // Save the output to a file for further analysis
  const outputPath = path.join(__dirname, 'enhanced_sporty_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(events, null, 2));
  console.log(`\nFull results saved to: ${outputPath}`);
  
} catch (error) {
  console.error(`❌ ERROR: Failed to run scraper: ${error.message}`);
  process.exit(1);
}