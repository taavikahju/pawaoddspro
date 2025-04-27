/**
 * Simplified script to measure scraper performance
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance data
const performanceData = [];

// Measure a single scraper's performance
function measureScraper(name, scriptPath) {
  console.log(`\nMeasuring performance for ${name}...`);
  
  try {
    // Warm up the system
    execSync(`node ${scriptPath} > /dev/null`, { timeout: 3000 });
    
    // Run the actual measurement
    const start = Date.now();
    const output = execSync(`node ${scriptPath}`, { 
      encoding: 'utf8',
      timeout: 10000
    });
    const end = Date.now();
    
    const executionTime = (end - start) / 1000;
    
    // Get the event count
    let eventCount = 0;
    try {
      const data = JSON.parse(output);
      eventCount = Array.isArray(data) ? data.length : 0;
      
      // Log some sample events if available
      if (eventCount > 0 && Array.isArray(data)) {
        console.log(`Sample event 1: ${data[0].event || data[0].homeTeam + ' vs ' + data[0].awayTeam}`);
      }
    } catch (err) {
      console.error('Error parsing output:', err.message);
    }
    
    const eventsPerSecond = eventCount / executionTime;
    
    console.log(`Execution time: ${executionTime.toFixed(2)} seconds`);
    console.log(`Event count: ${eventCount}`);
    console.log(`Performance: ${eventsPerSecond.toFixed(2)} events/second`);
    
    // Store the data
    performanceData.push({
      name,
      executionTime: executionTime.toFixed(2),
      eventCount,
      eventsPerSecond: eventsPerSecond.toFixed(2)
    });
    
    return { success: true };
  } catch (error) {
    console.error(`Error measuring ${name}:`, error.message);
    
    performanceData.push({
      name,
      executionTime: 'Failed',
      eventCount: 0,
      eventsPerSecond: 0,
      error: error.message
    });
    
    return { success: false, error };
  }
}

// Main function
async function main() {
  console.log('===== QUICK PERFORMANCE REPORT =====');
  
  // Test BetPawa Direct (Live scraper)
  measureScraper('BetPawa Live', 'server/scrapers/custom/betpawa_direct.cjs');
  
  // Test SportyBet
  measureScraper('SportyBet', 'server/scrapers/custom/sporty_direct_api.cjs');
  
  // Output summary
  console.log('\n===== PERFORMANCE SUMMARY =====');
  console.log('Scraper           | Time (s) | Events | Events/s');
  console.log('------------------|----------|--------|--------');
  
  performanceData.forEach(data => {
    const name = data.name.padEnd(17);
    const time = String(data.executionTime).padEnd(8);
    const events = String(data.eventCount).padEnd(6);
    const rate = data.eventsPerSecond;
    
    console.log(`${name} | ${time} | ${events} | ${rate}`);
  });
  
  console.log('\nNote: These times include initialization overhead and data processing time.');
}

main().catch(console.error);