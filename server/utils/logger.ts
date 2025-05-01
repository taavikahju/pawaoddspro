/**
 * Logger utility to control console output across the application
 * This helps to standardize logging format and enable filtering
 */

// Default verbosity level (0-3)
// 0 = errors only
// 1 = errors + critical info
// 2 = errors + critical info + general info
// 3 = all logs (including verbose debugging)
let verbosityLevel = 1;

export function setVerbosityLevel(level: number) {
  verbosityLevel = Math.max(0, Math.min(3, level));
}

export function getVerbosityLevel(): number {
  return verbosityLevel;
}

export const logger = {
  // Always shown - errors
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ERROR: ${message}`, ...args);
  },
  
  // Critical information - always shown unless errors only
  critical: (message: string, ...args: any[]) => {
    if (verbosityLevel >= 1) {
      console.log(`${message}`, ...args);
    }
  },
  
  // Information - shown at normal verbosity
  info: (message: string, ...args: any[]) => {
    if (verbosityLevel >= 2) {
      console.log(`${message}`, ...args);
    }
  },
  
  // Debug - only shown at high verbosity
  debug: (message: string, ...args: any[]) => {
    if (verbosityLevel >= 3) {
      console.log(`${message}`, ...args);
    }
  },
  
  // Special methods for our specific use case
  
  // Scraper lifecycle events
  scraperStart: (time: string) => {
    if (verbosityLevel >= 1) {
      console.log(`SCRAPER START [${time}]`);
    }
  },
  
  scraperEnd: (time: string, eventCount: number) => {
    if (verbosityLevel >= 1) {
      console.log(`SCRAPER COMPLETE [${time}] - ${eventCount} events`);
    }
  },
  
  // Bookmaker scraper events
  bookmakerStart: (name: string) => {
    if (verbosityLevel >= 1) {
      console.log(`SCRAPER RUNNING: ${name}`);
    }
  },
  
  bookmakerComplete: (name: string, eventCount: number) => {
    if (verbosityLevel >= 1) {
      console.log(`SCRAPER COMPLETE: ${name} - ${eventCount} events`);
    }
  },
  
  // Mapping events
  mappingStart: () => {
    if (verbosityLevel >= 1) {
      console.log(`MAPPING START`);
    }
  },
  
  mappingComplete: (eventCount: number, bookmakerEventCounts: Record<string, number>) => {
    if (verbosityLevel >= 1) {
      console.log(`MAPPING COMPLETE - ${eventCount} events mapped`);
      
      // Output per-bookmaker mapped event counts
      if (verbosityLevel >= 2) {
        Object.entries(bookmakerEventCounts).forEach(([code, count]) => {
          console.log(`  - ${code}: ${count} events`);
        });
      }
    }
  },
  
  // Final stats
  finalStats: (totalEvents: number, bookmakerCounts: Record<string, number>) => {
    if (verbosityLevel >= 1) {
      console.log(`UPDATE COMPLETE - ${totalEvents} total events`);
      
      if (verbosityLevel >= 2) {
        console.log(`Event distribution by bookmaker count:`);
        Object.entries(bookmakerCounts).forEach(([count, num]) => {
          console.log(`  - Events with ${count} bookmaker${count === '1' ? '' : 's'}: ${num}`);
        });
      }
    }
  }
};