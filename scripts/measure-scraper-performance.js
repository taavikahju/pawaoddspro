/**
 * Script to measure scraper performance
 * This will run each bookmaker scraper directly and report execution times
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
  { name: 'BetPawa Live Scraper', script: 'server/scrapers/custom/betpawa_direct.cjs' },
  { name: 'SportyBet', script: 'server/scrapers/custom/sporty_direct_api.cjs' }
];

// Function to read stored data from data directory
function readStoredData(bookmakerCode) {
  try {
    // Find the newest file matching the pattern in the data directory
    const dataDir = path.join(__dirname, '..', 'data');
    const files = fs.readdirSync(dataDir)
      .filter(file => file.startsWith(bookmakerCode) && file.endsWith('.json'))
      .sort();
      
    if (files.length === 0) {
      return { lastUpdated: 'Never', eventCount: 0, events: [] };
    }
    
    const latestFile = files[files.length - 1];
    const filePath = path.join(dataDir, latestFile);
    const stats = fs.statSync(filePath);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    return {
      lastUpdated: stats.mtime.toLocaleString(),
      eventCount: Array.isArray(data) ? data.length : 0,
      events: Array.isArray(data) ? data : [],
      fileSizeKB: Math.round(stats.size / 1024)
    };
  } catch (error) {
    console.error(`Error reading data for ${bookmakerCode}:`, error.message);
    return { lastUpdated: 'Error', eventCount: 0, events: [] };
  }
}

// Function to extract and process the output for performance metrics
function extractPerformanceMetrics(output) {
  try {
    const events = JSON.parse(output);
    return {
      eventCount: Array.isArray(events) ? events.length : 0,
      events: Array.isArray(events) ? events : []
    };
  } catch (error) {
    console.error('Error parsing scraper output:', error.message);
    return { eventCount: 0, events: [] };
  }
}

// Main function to test scraper performance
async function measureScraperPerformance() {
  console.log('===== SCRAPER PERFORMANCE REPORT =====');
  
  const results = [];
  
  // Test each scraper
  for (const scraper of scrapers) {
    console.log(`\n----- Testing ${scraper.name} -----`);
    
    // Extract bookmaker code from script name
    const filename = path.basename(scraper.script);
    const bookmakerCode = filename.replace('_scraper.cjs', '').replace('_direct.cjs', '').replace('_direct_api.cjs', '');
    
    // Get stored data for comparison
    const stored = readStoredData(bookmakerCode);
    console.log(`Last stored data: ${stored.lastUpdated}`);
    console.log(`Stored event count: ${stored.eventCount}`);
    console.log(`Stored file size: ${stored.fileSizeKB || 'unknown'} KB`);
    
    // Measure performance
    try {
      console.log(`Running ${scraper.script}...`);
      
      // Track start time
      const startTime = new Date();
      
      // Run the scraper and capture output
      const output = execSync(`node ${scraper.script}`, { 
        encoding: 'utf8',
        timeout: 60000 // 60 second timeout
      });
      
      // Track end time
      const endTime = new Date();
      const executionTimeMs = endTime - startTime;
      const executionTimeSec = (executionTimeMs / 1000).toFixed(2);
      
      console.log(`Execution time: ${executionTimeSec} seconds`);
      
      // Extract and process metrics
      const metrics = extractPerformanceMetrics(output);
      console.log(`Events collected: ${metrics.eventCount}`);
      
      // Calculate events per second
      const eventsPerSecond = (metrics.eventCount / (executionTimeMs / 1000)).toFixed(2);
      console.log(`Performance: ${eventsPerSecond} events/second`);
      
      // Store results
      results.push({
        scraper: scraper.name,
        bookmakerCode,
        executionTimeMs,
        executionTimeSec: parseFloat(executionTimeSec),
        eventsCollected: metrics.eventCount,
        eventsPerSecond: parseFloat(eventsPerSecond),
        storedEvents: stored.eventCount,
        fileSizeKB: stored.fileSizeKB || 0
      });
      
      // Sample some events
      if (metrics.eventCount > 0) {
        console.log('\nSample events:');
        for (let i = 0; i < Math.min(3, metrics.events.length); i++) {
          const event = metrics.events[i];
          console.log(`- ${event.event || (event.homeTeam + ' vs ' + event.awayTeam)}: ${event.gameMinute || 'No minute'}`);
        }
      }
    } catch (error) {
      console.error(`Error running scraper:`, error.message);
      results.push({
        scraper: scraper.name,
        bookmakerCode,
        executionTimeMs: 0,
        executionTimeSec: 0,
        eventsCollected: 0,
        eventsPerSecond: 0,
        storedEvents: stored.eventCount,
        fileSizeKB: stored.fileSizeKB || 0,
        error: error.message
      });
    }
  }
  
  // Measure event mapping performance
  console.log('\n----- Testing Event Mapping Performance -----');
  try {
    // First count the number of events to map
    const dataDir = path.join(__dirname, '..', 'data');
    let totalEvents = 0;
    
    for (const scraper of scrapers) {
      const filename = path.basename(scraper.script);
      const bookmakerCode = filename.replace('_scraper.cjs', '').replace('_direct.cjs', '').replace('_direct_api.cjs', '');
      const stored = readStoredData(bookmakerCode);
      totalEvents += stored.eventCount;
    }
    
    console.log(`Total events to map: ${totalEvents}`);
    
    // Now measure mapping time using the dataMapper utility
    // This requires creating a small test file that uses the dataMapper
    const testMapperCode = `
const { mapBookmakerData } = require('../server/utils/dataMapper');
const fs = require('fs');
const path = require('path');

async function testMapping() {
  const dataDir = path.join(__dirname, '..', 'data');
  const bookmakers = [
    'betpawa_gh',
    'betpawa_ke',
    'sporty'
  ];
  
  const bookmakerData = {};
  
  // Load data for each bookmaker
  for (const code of bookmakers) {
    const files = fs.readdirSync(dataDir)
      .filter(file => file.startsWith(code) && file.endsWith('.json'))
      .sort();
      
    if (files.length > 0) {
      const latestFile = files[files.length - 1];
      const filePath = path.join(dataDir, latestFile);
      bookmakerData[code] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      bookmakerData[code] = [];
    }
  }

  // Measure mapping performance
  const startTime = new Date();
  const mappedEvents = await mapBookmakerData(bookmakerData);
  const endTime = new Date();
  
  const executionTimeMs = endTime - startTime;
  
  console.log(JSON.stringify({
    mappedEventCount: mappedEvents.length,
    executionTimeMs: executionTimeMs,
    eventsPerSecond: (mappedEvents.length / (executionTimeMs / 1000)).toFixed(2)
  }));
}

testMapping().catch(console.error);
    `;
    
    // Write the test file
    const testMapperPath = path.join(__dirname, 'temp-mapper-test.js');
    fs.writeFileSync(testMapperPath, testMapperCode);
    
    // Run the test and measure
    console.log('Running event mapping test...');
    const startTime = new Date();
    const mapperOutput = execSync(`node ${testMapperPath}`, { 
      encoding: 'utf8',
      timeout: 60000
    });
    const endTime = new Date();
    
    // Delete the temporary file
    fs.unlinkSync(testMapperPath);
    
    // Process results
    const mapperResults = JSON.parse(mapperOutput);
    console.log(`Mapped events: ${mapperResults.mappedEventCount}`);
    console.log(`Mapping time: ${(mapperResults.executionTimeMs / 1000).toFixed(2)} seconds`);
    console.log(`Mapping performance: ${mapperResults.eventsPerSecond} events/second`);
    
    // Add to results
    results.push({
      scraper: 'Event Mapping',
      executionTimeMs: mapperResults.executionTimeMs,
      executionTimeSec: parseFloat((mapperResults.executionTimeMs / 1000).toFixed(2)),
      eventsCollected: mapperResults.mappedEventCount,
      eventsPerSecond: parseFloat(mapperResults.eventsPerSecond)
    });
  } catch (error) {
    console.error('Error measuring mapping performance:', error.message);
    results.push({
      scraper: 'Event Mapping',
      executionTimeMs: 0,
      executionTimeSec: 0,
      eventsCollected: 0,
      eventsPerSecond: 0,
      error: error.message
    });
  }
  
  // Generate summary
  console.log('\n===== PERFORMANCE SUMMARY =====');
  console.log('Scraper | Time (s) | Events | Events/s');
  console.log('--------|----------|--------|--------');
  
  for (const result of results) {
    console.log(`${result.scraper.padEnd(20)} | ${result.executionTimeSec.toString().padEnd(8)} | ${result.eventsCollected.toString().padEnd(6)} | ${result.eventsPerSecond}`);
  }
  
  console.log('\n===== END OF REPORT =====\n');
  
  // Return results
  return results;
}

// Run the performance measurement
measureScraperPerformance().catch(console.error);