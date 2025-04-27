/**
 * Script to analyze BetPawa output files
 * This will help us understand why the events aren't showing up in the database
 */

import fs from 'fs';
import path from 'path';

// File paths
const GHANA_OUTPUT = 'server/scrapers/custom/betpawa_gh_output.json';
const KENYA_OUTPUT = 'server/scrapers/custom/betpawa_ke_output.json';

// Helper function to analyze output file
function analyzeFile(filePath, label) {
  console.log(`\n===== Analyzing ${label} =====`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`Error: File ${filePath} does not exist`);
      return;
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`Last modified: ${stats.mtime}`);
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        console.log(`Data is an array with ${data.length} items`);
        
        if (data.length > 0) {
          // Analyze events structure
          console.log('\nFirst event sample:');
          console.log(JSON.stringify(data[0], null, 2));
          
          // Check if events have proper IDs
          const hasIds = data.every(event => event.id);
          console.log(`\nAll events have IDs: ${hasIds}`);
          
          // Count unique leagues/tournaments
          const tournamentsSet = new Set();
          data.forEach(event => {
            if (event.tournament) tournamentsSet.add(event.tournament);
            if (event.league) tournamentsSet.add(event.league);
          });
          console.log(`Unique tournaments: ${tournamentsSet.size}`);
          
          // Count events with odds
          const eventsWithOdds = data.filter(event => 
            event.odds && (event.odds.home || event.odds[1])
          ).length;
          console.log(`Events with odds: ${eventsWithOdds} out of ${data.length}`);
        }
      } else {
        console.log('Data is not an array');
        console.log('Data structure type:', typeof data);
        console.log('Data keys:', Object.keys(data));
        
        // If it's an object, check if it has an events array
        if (data.events && Array.isArray(data.events)) {
          console.log(`Object contains events array with ${data.events.length} items`);
          
          if (data.events.length > 0) {
            console.log('\nFirst event sample:');
            console.log(JSON.stringify(data.events[0], null, 2));
          }
        }
      }
    } catch (error) {
      console.log('Error parsing JSON:', error.message);
      
      // If not valid JSON, check the first part of the content
      console.log('\nFile content preview:');
      console.log(content.substring(0, 300) + '...');
    }
  } catch (error) {
    console.log(`Error analyzing file: ${error.message}`);
  }
}

// Main function
function main() {
  console.log('BetPawa Output File Analysis');
  console.log('============================');
  
  analyzeFile(GHANA_OUTPUT, 'BetPawa Ghana');
  analyzeFile(KENYA_OUTPUT, 'BetPawa Kenya');
}

// Run the analysis
main();