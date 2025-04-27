import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// Skip timezone conversion to avoid the CPU overhead
// We'll simply use the times as provided by the source
function convertEstonianToUTC(dateStr: string, timeStr: string): { date: string, time: string } {
  // Just return the original values without conversion
  return { date: dateStr, time: timeStr };
}

// Define the configuration type
interface ScraperConfig {
  scriptPath: string;
  command: string;
  outputFormat: string;
}

// This will be a dynamic configuration that gets populated with custom scrapers
const SCRIPT_CONFIG: Record<string, ScraperConfig> = {};

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
    
    // Run the script as a separate process - quote the path to handle spaces
    console.log(`Running command: ${config.command} "${config.scriptPath}"`);
    const { stdout, stderr } = await execPromise(`${config.command} "${config.scriptPath}"`);
    
    if (stderr) {
      console.error(`Error running ${bookmakerCode} scraper:`, stderr);
    }
    
    // Parse the output
    if (config.outputFormat === 'json') {
      try {
        const rawData = JSON.parse(stdout.trim());
        const data = Array.isArray(rawData) ? rawData : [];
        
        // Map the data to the expected format
        return data.map(item => {
          // Check if this is the user's custom format
          if (item.eventId && item.event && item.home_odds && item.draw_odds && item.away_odds) {
            // Extract date and time from start_time
            const originalDate = item.start_time ? item.start_time.split(' ')[0] : '';
            const originalTime = item.start_time ? item.start_time.split(' ')[1] : '';
            
            // Use original time values without conversion to reduce CPU overhead
            const { date: utcDate, time: utcTime } = convertEstonianToUTC(originalDate, originalTime);
            
            // Using informational log only during debugging
            if (process.env.DEBUG === 'true') {
              console.log(`Using original time for ${item.event}: ${originalDate} ${originalTime}`);
            }
            
            // Map from the user's custom format to our expected format
            return {
              id: item.eventId,
              eventId: item.eventId, // Explicitly add eventId at the top level
              teams: item.event,
              league: item.tournament || '',
              sport: item.sport || 'football', // Default to football if not specified
              country: item.country || '',
              date: utcDate,
              time: utcTime,
              odds: {
                home: parseFloat(item.home_odds),
                draw: parseFloat(item.draw_odds),
                away: parseFloat(item.away_odds)
              },
              // Keep the original data for reference
              raw: { ...item }
            };
          }
          
          // If it's already in our expected format but missing eventId, add it
          if (item.raw && item.raw.eventId && !item.eventId) {
            return {
              ...item,
              eventId: item.raw.eventId
            };
          }
          
          // If it's already in our expected format, return it as is
          return item;
        });
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

// Function to register a custom scraper
export function registerCustomScraper(bookmakerCode: string, filePath: string): void {
  // Determine the file extension to choose the right command
  const ext = path.extname(filePath).toLowerCase();
  let command = 'node'; // Default to node
  
  if (ext === '.py') {
    command = 'python';
  } else if (ext === '.sh') {
    command = 'sh';
  } else if (ext === '.ts') {
    command = 'npx tsx';
  }
  
  // Register the scraper configuration
  SCRIPT_CONFIG[bookmakerCode] = {
    scriptPath: filePath,
    command: command,
    outputFormat: 'json'
  };
  
  console.log(`Registered custom scraper for bookmaker: ${bookmakerCode}`);
  console.log(`Script path: ${filePath}`);
  console.log(`Command: ${command}`);
}

// Load all existing custom scrapers
export function loadAllCustomScrapers(): void {
  // Path to custom scrapers directory
  const customScraperDir = path.join(process.cwd(), 'server', 'scrapers', 'custom');
  
  // Ensure directory exists
  if (!fs.existsSync(customScraperDir)) {
    console.log(`Creating custom scrapers directory: ${customScraperDir}`);
    fs.mkdirSync(customScraperDir, { recursive: true });
    return;
  }
  
  try {
    // Read all files in the directory
    const files = fs.readdirSync(customScraperDir);
    
    // Filter for scraper files and register them
    files.forEach(file => {
      // Skip this integration file
      if (file === 'integration.ts' || file === 'integration.js') return;
      
      // Expected format: bookmakercode_scraper.ext (allowing spaces)
      const match = file.match(/^(.+)_scraper\.(js|py|sh|ts|cjs)$/);
      if (match) {
        const bookmakerCode = match[1];
        const filePath = path.join(customScraperDir, file);
        
        console.log(`Detected scraper file ${file} for bookmaker code: ${bookmakerCode}`);
        
        // Register this scraper
        registerCustomScraper(bookmakerCode, filePath);
      }
    });
    
    console.log(`Loaded ${Object.keys(SCRIPT_CONFIG).length} custom scrapers`);
  } catch (error) {
    console.error('Error loading custom scrapers:', error);
  }
}

// Immediately load all custom scrapers when this module is imported
loadAllCustomScrapers();

// Use our new SportyBet wrapper instead of the direct enhanced scraper
const sportyWrapperPath = path.join(process.cwd(), 'server', 'scrapers', 'custom', 'sporty_scraper_wrapper.js');
if (fs.existsSync(sportyWrapperPath)) {
  console.log('🌟 Registering SportyBet scraper wrapper with guaranteed data format');
  SCRIPT_CONFIG['sporty'] = {
    scriptPath: sportyWrapperPath,
    command: 'node',
    outputFormat: 'json'
  };
  
  // Log when the scraper is running
  const originalRunCustomScraper = runCustomScraper;
  // @ts-ignore - we're monkey patching this function to add additional logging
  runCustomScraper = async function(bookmakerCode: string): Promise<any[]> {
    if (bookmakerCode === 'sporty') {
      console.log('🔄 Running SportyBet scraper wrapper...');
      
      // Run the original function to get the data - now using our wrapper
      const events = await originalRunCustomScraper(bookmakerCode);
      
      // Log detailed information about what we got
      console.log(`📊 SportyBet scraper wrapper returned ${events.length} events`);
      if (events.length > 0) {
        console.log(`📊 First event sample from SportyBet: ${JSON.stringify(events[0])}`);
      }
      
      return events;
    }
    return originalRunCustomScraper(bookmakerCode);
  };
}

// Export a function that checks if a custom scraper exists for a bookmaker
export function hasCustomScraper(bookmakerCode: string): boolean {
  return !!SCRIPT_CONFIG[bookmakerCode] && 
         fs.existsSync(SCRIPT_CONFIG[bookmakerCode].scriptPath);
}