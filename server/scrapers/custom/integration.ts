import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Define the configuration type
interface ScraperConfig {
  scriptPath: string;
  command: string;
  outputFormat: string;
}

// Configuration - adjust these paths based on your actual script locations
const SCRIPT_CONFIG: Record<string, ScraperConfig> = {
  'bet365': {
    scriptPath: './server/scrapers/custom/bet365_scraper.js', // Update this path
    command: 'node', // or 'python', etc. depending on your script
    outputFormat: 'json', // The format your script outputs
  },
  'williamhill': {
    scriptPath: './server/scrapers/custom/williamhill_scraper.js',
    command: 'node',
    outputFormat: 'json',
  },
  'betfair': {
    scriptPath: './server/scrapers/custom/betfair_scraper.js',
    command: 'node',
    outputFormat: 'json',
  },
  'paddypower': {
    scriptPath: './server/scrapers/custom/paddypower_scraper.js',
    command: 'node',
    outputFormat: 'json',
  }
};

/**
 * Generic function to run a custom scraper script for any bookmaker
 * The script should output valid JSON that matches the expected format:
 * [
 *   {
 *     id: 'unique_id',
 *     teams: 'Team A vs Team B',
 *     league: 'League Name',
 *     sport: 'sport_name',
 *     date: 'Date string',
 *     time: 'Time string',
 *     odds: {
 *       home: 1.5,
 *       draw: 3.5,
 *       away: 5.0
 *     }
 *   },
 *   ...
 * ]
 */
export async function runCustomScraper(bookmakerCode: string): Promise<any[]> {
  const config = SCRIPT_CONFIG[bookmakerCode];
  
  if (!config) {
    throw new Error(`No configuration found for bookmaker: ${bookmakerCode}`);
  }
  
  try {
    // Check if the script file exists
    if (!fs.existsSync(config.scriptPath)) {
      console.error(`Script file not found: ${config.scriptPath}`);
      return [];
    }
    
    // Run the script as a separate process
    const { stdout, stderr } = await execPromise(`${config.command} ${config.scriptPath}`);
    
    if (stderr) {
      console.error(`Error running ${bookmakerCode} scraper:`, stderr);
    }
    
    // Parse the output
    if (config.outputFormat === 'json') {
      try {
        const data = JSON.parse(stdout.trim());
        return Array.isArray(data) ? data : [];
      } catch (e) {
        console.error(`Error parsing JSON output from ${bookmakerCode} scraper:`, e);
        console.error('Output was:', stdout.substring(0, 500) + '...');
        return [];
      }
    } else {
      // Handle other output formats if needed
      console.error(`Unsupported output format: ${config.outputFormat}`);
      return [];
    }
  } catch (error) {
    console.error(`Error running custom scraper for ${bookmakerCode}:`, error);
    return [];
  }
}

// Helper functions to run specific bookmaker scrapers
export async function scrapeBet365(): Promise<any[]> {
  return runCustomScraper('bet365');
}

export async function scrapeWilliamHill(): Promise<any[]> {
  return runCustomScraper('williamhill');
}

export async function scrapeBetfair(): Promise<any[]> {
  return runCustomScraper('betfair');
}

export async function scrapePaddyPower(): Promise<any[]> {
  return runCustomScraper('paddypower');
}

// Export a function that checks if a custom scraper exists for a bookmaker
export function hasCustomScraper(bookmakerCode: string): boolean {
  return !!SCRIPT_CONFIG[bookmakerCode] && 
         fs.existsSync(SCRIPT_CONFIG[bookmakerCode].scriptPath);
}