#!/usr/bin/env node

/**
 * Simple Report Generator
 * 
 * This script creates a simple direct SQL query to get event counts by bookmaker
 */

const { exec } = require('child_process');

// Query to count events by source
const query = `
  SELECT source, COUNT(*) as count 
  FROM events 
  GROUP BY source 
  ORDER BY count DESC;
`;

// Query to count sporty events by country
const sportyQuery = `
  SELECT country, COUNT(*) as count 
  FROM events 
  WHERE source = 'sporty' 
  GROUP BY country 
  ORDER BY count DESC;
`;

// Execute the query using psql
exec(`psql "$DATABASE_URL" -c "${query}"`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Stderr: ${stderr}`);
    return;
  }
  
  console.log('======================================');
  console.log('   Bookmaker Events Report   ');
  console.log('======================================\n');
  console.log(stdout);
  
  // Run the second query for SportyBet country breakdown
  exec(`psql "$DATABASE_URL" -c "${sportyQuery}"`, (error2, stdout2, stderr2) => {
    if (error2 || stderr2) {
      console.error(`Error with SportyBet query: ${error2?.message || stderr2}`);
      return;
    }
    
    console.log('======================================');
    console.log('   SportyBet Events by Country   ');
    console.log('======================================\n');
    console.log(stdout2);
  });
});