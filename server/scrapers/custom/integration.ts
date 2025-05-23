import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

// No time conversion as requested by user
// We keep the original time without modifying it

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
  // Always use Python implementation for Sportybet
  if (bookmakerCode === 'sporty') {
    try {
      console.log('Using Python implementation of Sportybet scraper');
      // Check if Python scraper exists
      const pythonScraperPath = path.join(process.cwd(), 'server', 'scrapers', 'custom', 'sporty_py_scraper.py');
      
      if (!fs.existsSync(pythonScraperPath)) {
        console.error(`Python Sportybet scraper not found at ${pythonScraperPath}`);
        throw new Error('Python Sportybet scraper not found');
      }
      
      // First check if python3 is available, if not try python, and if that's not available, throw error
      let pythonCommand = 'python3';
      try {
        await execPromise('python3 --version');
        console.log('Using python3 command');
      } catch (e) {
        try {
          await execPromise('python --version');
          console.log('Using python command');
          pythonCommand = 'python';
        } catch (e) {
          console.error('Neither python3 nor python is available on this system');
          throw new Error('Python is not available');
        }
      }
      
      // Run the Python scraper directly with python3 for better compatibility
      // Use longer timeout (10 minutes) and larger buffer
      // Get LOG_LEVEL from environment to pass through to Python script
      const logLevel = process.env.LOG_LEVEL || 'info';
      console.log(`Running command: ${pythonCommand} "${pythonScraperPath}" with 10 minute timeout (LOG_LEVEL=${logLevel})`);
      
      try {
        // Set environment variables for the Python process
        const env = {
          ...process.env,
          LOG_LEVEL: logLevel
        };
        
        const { stdout, stderr } = await execPromise(`${pythonCommand} "${pythonScraperPath}"`, {
          timeout: 10 * 60 * 1000, // 10 minutes in milliseconds
          maxBuffer: 20 * 1024 * 1024, // 20MB buffer for large JSON output
          env: env // Pass environment variables including LOG_LEVEL
        });
        
        if (stderr && stderr.trim()) {
          console.error(`Python Sportybet scraper warnings:`, stderr);
          // Still continue with stdout processing even if stderr has content
        }
        
        // Check if we got a valid output
        if (!stdout || !stdout.trim()) {
          console.error('Python Sportybet scraper returned empty output');
          throw new Error('Empty output from Python scraper');
        }
        
        // Parse the output
        try {
          // Ensure we're only parsing the actual JSON output
          // Many issues can happen if logs get mixed in with the JSON
          // First identify the position of the first '[' which should be the start of the JSON array
          const jsonStart = stdout.indexOf('[');
          if (jsonStart === -1) {
            console.error('No JSON array found in Python scraper output');
            throw new Error('Invalid JSON output format');
          }
          
          // Then find the closing ']' from the end (last occurence)
          const jsonEnd = stdout.lastIndexOf(']');
          if (jsonEnd === -1 || jsonEnd <= jsonStart) {
            console.error('No valid JSON array closing found in Python scraper output');
            throw new Error('Invalid JSON output format');
          }
          
          // Extract only the JSON part
          const jsonText = stdout.substring(jsonStart, jsonEnd + 1);
          
          // Parse the JSON
          const rawData = JSON.parse(jsonText);
          const data = Array.isArray(rawData) ? rawData : [];
          console.log(`Python Sportybet scraper returned ${data.length} events`);
          
          if (data.length === 0) {
            console.error('⚠️ Python Sportybet scraper returned 0 events - CRITICAL ERROR');
            throw new Error('No events returned from Python Sportybet scraper');
          }
          
          return data;
        } catch (parseError) {
          console.error(`Error parsing JSON output from Python Sportybet scraper:`, parseError);
          console.error('Output starts with:', stdout.substring(0, 500) + '...');
          throw parseError; // Re-throw to trigger fallback
        }
      } catch (execError) {
        console.error(`Error executing Python Sportybet scraper:`, execError);
        throw execError; // Re-throw to trigger fallback
      }
    } catch (error) {
      console.error(`⚠️ CRITICAL ERROR: Python Sportybet scraper failed:`, error);
      // Don't fallback to Node.js implementation, just report the error and return empty data
      return [];
    }
    // Always return data from Python scraper or empty array if there was an error
    return [];
  }
  
  // Regular code path for all other scrapers (and Sportybet fallback)
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
    // Get LOG_LEVEL from environment to pass through to other scrapers
    const logLevel = process.env.LOG_LEVEL || 'info';
    console.log(`Running command: ${config.command} "${config.scriptPath}" (LOG_LEVEL=${logLevel})`);
    
    // Set environment variables for the scraper process
    const env = {
      ...process.env,
      LOG_LEVEL: logLevel
    };
    
    const { stdout, stderr } = await execPromise(`${config.command} "${config.scriptPath}"`, {
      env: env // Pass environment variables including LOG_LEVEL
    });
    
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
            const date = item.start_time ? item.start_time.split(' ')[0] : '';
            const time = item.start_time ? item.start_time.split(' ')[1] : '';
            
            // No time zone conversion as requested by user
            
            // Map from the user's custom format to our expected format
            return {
              id: item.eventId,
              eventId: item.eventId, // Explicitly add eventId at the top level
              teams: item.event,
              league: item.tournament || '',
              sport: item.sport || 'football', // Default to football if not specified
              country: item.country || '',
              date: date,
              time: time,
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

// Export a function that checks if a custom scraper exists for a bookmaker
export function hasCustomScraper(bookmakerCode: string): boolean {
  return !!SCRIPT_CONFIG[bookmakerCode] && 
         fs.existsSync(SCRIPT_CONFIG[bookmakerCode].scriptPath);
}