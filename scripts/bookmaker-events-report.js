#!/usr/bin/env node

/**
 * Bookmaker Events Report Generator
 * 
 * This script connects to the database and generates a report showing
 * how many events are currently mapped for each bookmaker.
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

// Create our own db connection for this script
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Configure neon to use ws for WebSocket
import { neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = ws;

// Create pool and db connection
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

async function generateBookmakerReport() {
  console.log(`${colors.bright}${colors.cyan}======================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   Bookmaker Events Report   ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}======================================${colors.reset}\n`);
  
  try {
    // First, check which tables exist
    console.log(`${colors.yellow}Checking database schema...${colors.reset}`);
    
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    const tables = await db.execute(tableCheckQuery);
    console.log(`Found ${tables.length} tables in the database`);
    
    const tableNames = tables.map(row => row.table_name);
    console.log(`Tables: ${tableNames.join(', ')}`);
    
    // Check for events table
    if (!tableNames.includes('events')) {
      console.log(`${colors.red}Events table not found in database.${colors.reset}`);
      return;
    }
    
    // Get event count by source
    const eventCountQuery = `
      SELECT source, COUNT(*) as count 
      FROM events 
      GROUP BY source 
      ORDER BY count DESC
    `;
    
    console.log(`\n${colors.green}Fetching event counts by bookmaker...${colors.reset}`);
    const eventCounts = await db.execute(eventCountQuery);
    
    if (eventCounts.length === 0) {
      console.log(`${colors.yellow}No events found in the database.${colors.reset}`);
      return;
    }
    
    // Calculate total events
    const totalEvents = eventCounts.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    // Display report
    console.log(`\n${colors.bright}${colors.white}Event Count by Bookmaker:${colors.reset}`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);
    console.log(`${colors.bright}${colors.white}Bookmaker${' '.repeat(15)}Count${' '.repeat(8)}%${colors.reset}`);
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);
    
    eventCounts.forEach(row => {
      const source = row.source || 'Unknown';
      const count = parseInt(row.count);
      const percentage = ((count / totalEvents) * 100).toFixed(1);
      
      const sourceDisplay = source.padEnd(23);
      const countDisplay = count.toString().padEnd(10);
      
      console.log(`${sourceDisplay}${countDisplay}${percentage}%`);
    });
    
    console.log(`${colors.cyan}----------------------------------------${colors.reset}`);
    console.log(`${colors.bright}${colors.white}Total:${' '.repeat(18)}${totalEvents}${' '.repeat(8)}100%${colors.reset}`);
    console.log();
    
    // Get recent events for each source
    console.log(`\n${colors.green}Fetching recent events by bookmaker...${colors.reset}`);
    
    const sources = eventCounts.map(row => row.source);
    
    for (const source of sources) {
      const recentEventsQuery = `
        SELECT id, teams, league, date, time 
        FROM events 
        WHERE source = $1 
        ORDER BY id DESC 
        LIMIT 3
      `;
      
      const recentEvents = await db.execute(recentEventsQuery, [source]);
      
      if (recentEvents.length > 0) {
        console.log(`\n${colors.bright}${colors.white}Recent Events from ${source}:${colors.reset}`);
        recentEvents.forEach(event => {
          console.log(`- ${event.teams} (${event.league}) on ${event.date} at ${event.time}`);
        });
      }
    }
    
    // Enhanced SportyBet Analysis
    console.log(`\n${colors.bright}${colors.cyan}======================================${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}   Enhanced SportyBet Analysis   ${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}======================================${colors.reset}\n`);
    
    // Check for events with sporty source
    const sportyEventsQuery = `
      SELECT COUNT(*) as count 
      FROM events 
      WHERE source = 'sporty'
    `;
    
    const sportyResult = await db.execute(sportyEventsQuery);
    const sportyCount = parseInt(sportyResult[0]?.count || '0');
    
    console.log(`Total SportyBet events: ${sportyCount}`);
    
    if (sportyCount > 0) {
      // Get country breakdown for SportyBet events
      const countryBreakdownQuery = `
        SELECT country, COUNT(*) as count 
        FROM events 
        WHERE source = 'sporty' 
        GROUP BY country 
        ORDER BY count DESC
      `;
      
      const countryBreakdown = await db.execute(countryBreakdownQuery);
      
      if (countryBreakdown.length > 0) {
        console.log(`\n${colors.bright}${colors.white}SportyBet Events by Country:${colors.reset}`);
        console.log(`${colors.cyan}----------------------------------------${colors.reset}`);
        
        countryBreakdown.forEach(row => {
          const country = row.country || 'Unknown';
          const count = parseInt(row.count);
          const percentage = ((count / sportyCount) * 100).toFixed(1);
          
          console.log(`${country.padEnd(25)}${count.toString().padEnd(8)}${percentage}%`);
        });
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error generating report:${colors.reset}`, error);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the report
generateBookmakerReport();