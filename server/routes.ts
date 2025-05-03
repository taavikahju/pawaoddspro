import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { setupScrapers, runAllScrapers, scraperEvents, SCRAPER_EVENTS } from "./scrapers/scheduler";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as customScrapers from "./scrapers/custom/integration";
import { WebSocketServer, WebSocket } from 'ws';
import { processAndMapEvents } from "./utils/dataMapper";
import { setupAuth } from "./auth";
import { isAuthenticated, isAdmin } from "./middleware/auth";
import { simpleAdminAuth } from "./middleware/simpleAdminAuth";
import session from "express-session";
import { db } from './db';
import { sql } from 'drizzle-orm';
import { logger } from './utils/logger';

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Site-wide access protection removed per user request
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });
  
  // Broadcast to all clients
  function broadcast(data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Set up scraper event listeners
  scraperEvents.on(SCRAPER_EVENTS.SCRAPER_STARTED, (bookmaker) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.SCRAPER_STARTED,
      data: { bookmaker }
    });
    
    broadcast({
      type: 'notification',
      data: {
        message: `Started scraping ${bookmaker.name}`,
        status: 'info'
      }
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.SCRAPER_COMPLETED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.SCRAPER_COMPLETED,
      data
    });
    
    broadcast({
      type: 'notification',
      data: {
        message: `Completed scraping ${data.bookmaker.name} (${data.eventCount} events)`,
        status: 'success'
      }
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.SCRAPER_FAILED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.SCRAPER_FAILED,
      data
    });
    
    broadcast({
      type: 'notification',
      data: {
        message: `Failed scraping ${data.bookmaker.name}: ${data.error}`,
        status: 'error'
      }
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.ALL_SCRAPERS_COMPLETED, () => {
    broadcast({
      type: 'notification',
      data: {
        message: 'All scrapers completed successfully',
        status: 'success'
      }
    });
  });
  
  // New event listener for when all processing (scraping + mapping) is complete
  // This is when we broadcast events to the frontend with full statistics
  scraperEvents.on(SCRAPER_EVENTS.ALL_PROCESSING_COMPLETED, (data) => {
    logger.info('Broadcasting complete data update to all connected clients');
    
    // Broadcast a notification about the update
    broadcast({
      type: 'notification',
      data: {
        message: 'Data update complete with all bookmakers',
        status: 'success'
      }
    });
    
    // Broadcast the statistics
    broadcast({
      type: 'updateStats',
      data: data.stats
    });
    
    // Broadcast scrape completed message to signal data is ready for consumption
    broadcast({
      type: 'scrapeCompleted',
      timestamp: new Date().toISOString(),
      message: 'All scraping and data processing complete'
    });
  });

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    logger.info('New WebSocket client connected');
    
    // Send initial data
    storage.getStats().then(stats => {
      ws.send(JSON.stringify({
        type: 'stats',
        data: stats
      }));
    }).catch(error => {
      logger.error(`Error sending initial stats: ${error}`);
    });
    
    storage.getScraperStatuses().then(scraperStatuses => {
      ws.send(JSON.stringify({
        type: 'scraperStatuses',
        data: scraperStatuses
      }));
    }).catch(error => {
      logger.error(`Error sending initial scraper statuses: ${error}`);
    });
    
    // Send initial events data - filtered to only include events with 3+ bookmakers
    storage.getEvents().then(events => {
      // Apply the same filter as the API endpoint
      const filteredEvents = events.filter(event => {
        if (!event.oddsData) return false;
        const bookmakerCount = Object.keys(event.oddsData).length;
        return bookmakerCount >= 3; // Consistent with API endpoint (min 3 bookmakers)
      });
      
      logger.debug(`WebSocket: Filtered ${events.length} events down to ${filteredEvents.length} with at least 3 bookmakers`);
      
      ws.send(JSON.stringify({
        type: 'events',
        data: filteredEvents
      }));
    }).catch(error => {
      logger.error(`Error sending initial events: ${error}`);
    });
    
    // Handle messages from client
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle client requests
        if (data.type === 'getEvents') {
          const events = await storage.getEvents();
          
          // Apply the same filter for consistency
          const filteredEvents = events.filter(event => {
            if (!event.oddsData) return false;
            const bookmakerCount = Object.keys(event.oddsData).length;
            return bookmakerCount >= 3; // Consistent with API endpoint (min 3 bookmakers)
          });

          // Track counts for different bookmaker counts for WebSocket too
          const eventsByBookmakerCount = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4+': 0
          };

          // Count events by bookmaker count for WebSocket
          events.forEach(event => {
            if (!event.oddsData) return;
            const count = Object.keys(event.oddsData).length;
            
            if (count === 1) eventsByBookmakerCount['1']++;
            else if (count === 2) eventsByBookmakerCount['2']++;
            else if (count === 3) eventsByBookmakerCount['3']++;
            else if (count >= 4) eventsByBookmakerCount['4+']++;
          });

          // Log bookmaker count distribution for WebSocket
          logger.debug(`WebSocket Events distribution:`);
          logger.debug(`  - Events with 1 bookmaker: ${eventsByBookmakerCount['1']}`);
          logger.debug(`  - Events with 2 bookmakers: ${eventsByBookmakerCount['2']}`);
          logger.debug(`  - Events with 3 bookmakers: ${eventsByBookmakerCount['3']}`);
          logger.debug(`  - Events with 4+ bookmakers: ${eventsByBookmakerCount['4+']}`);
          
          logger.debug(`WebSocket getEvents: Filtered ${events.length} events down to ${filteredEvents.length} with at least 3 bookmakers`);
          
          ws.send(JSON.stringify({
            type: 'events',
            data: filteredEvents
          }));
        }
        
        if (data.type === 'runScrapers') {
          // Trigger scraper run
          runAllScrapers(storage).then(() => {
            // After scrapers run, broadcast updated stats
            storage.getStats().then(stats => {
              broadcast({
                type: 'stats',
                data: stats
              });
            });
            
            storage.getScraperStatuses().then(scraperStatuses => {
              broadcast({
                type: 'scraperStatuses',
                data: scraperStatuses
              });
            });
            
            storage.getEvents().then(rawEvents => {
              // Deep copy the events data to prevent modification by reference
              const events = JSON.parse(JSON.stringify(rawEvents));
              broadcast({
                type: 'events',
                data: events
              });
            });
          });
          
          // Immediately respond that scraper was triggered
          ws.send(JSON.stringify({
            type: 'notification',
            data: {
              message: 'Scrapers triggered',
              status: 'info'
            }
          }));
        }
      } catch (error) {
        logger.error(`Error handling WebSocket message: ${error}`);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  });

  // Setup multer for file uploads
  const customScraperDir = path.join(process.cwd(), 'server', 'scrapers', 'custom');
  
  // Ensure the custom scraper directory exists
  if (!fs.existsSync(customScraperDir)) {
    fs.mkdirSync(customScraperDir, { recursive: true });
  }
  
  // Configure storage for uploaded files
  const storage_config = multer.diskStorage({
    destination: function(req, file, cb) {
      cb(null, customScraperDir);
    },
    filename: function(req, file, cb) {
      // Use bookmaker code as part of the filename
      const bookmakerCode = req.body.bookmaker || req.query.bookmaker;
      
      logger.debug('Filename generator received bookmaker code:', bookmakerCode);
      logger.debug(`Request body: ${JSON.stringify(req.body)}`);
      logger.debug(`Request query: ${JSON.stringify(req.query)}`);
      logger.debug(`Headers: ${JSON.stringify(req.headers)}`);
      
      // Try to get bookmaker code from custom header if not in body
      const headerBookmakerCode = req.headers['x-bookmaker-code'];
      const finalBookmakerCode = bookmakerCode || 
        (typeof headerBookmakerCode === 'string' ? headerBookmakerCode : '');
      
      if (!finalBookmakerCode) {
        logger.error('No bookmaker code found in request');
        return cb(new Error('No bookmaker code provided'), '');
      }
      
      // Determine file extension
      let ext = path.extname(file.originalname);
      if (!ext) {
        // Default to .js if no extension
        ext = '.js';
      }
      
      const filename = `${finalBookmakerCode}_scraper${ext}`;
      logger.debug(`Generated filename: ${filename}`);
      
      cb(null, filename);
    }
  });
  
  // Initialize multer upload
  const upload = multer({ 
    storage: storage_config,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function(req, file, cb) {
      logger.debug(`Upload request received with body: ${JSON.stringify(req.body)}`);
      
      // Accept only JavaScript, Python, and shell script files
      const allowedExts = ['.js', '.py', '.sh', '.ts'];
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (allowedExts.includes(ext)) {
        // Accept the file
        cb(null, true);
      } else {
        // Reject the file but don't throw an error (set false)
        const error = new Error('Invalid file type. Only .js, .py, .sh, and .ts files are allowed.');
        error.name = 'UNSUPPORTED_FILE_TYPE';
        req.fileValidationError = error.message;
        cb(null, false);
      }
    }
  });

  // API route to manually trigger tournament margin calculation
  app.post('/api/admin/calculate-margins', simpleAdminAuth, async (req, res) => {
    try {
      logger.critical('Manually triggering tournament margin calculation...');
      
      // Clear existing margins
      await db.execute(sql`DELETE FROM tournament_margins`);
      logger.critical('Cleared existing tournament margins');
      
      // Calculate and store new tournament margins
      const { calculateAndStoreTournamentMargins } = await import('./utils/tournamentMargins');
      await calculateAndStoreTournamentMargins(storage);
      logger.critical('Tournament margins calculated and stored successfully');
      
      return res.json({ success: true, message: 'Tournament margins calculated successfully' });
    } catch (error) {
      logger.error(`Error calculating tournament margins: ${error}`);
      return res.status(500).json({ success: false, message: 'Error calculating tournament margins' });
    }
  });
  
  // Initialize and setup scrapers
  setupScrapers(storage);
  
  // Set up event listeners for scraper events
  // Scraper events
  scraperEvents.on(SCRAPER_EVENTS.STARTED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.STARTED,
      data
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.COMPLETED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.COMPLETED,
      data
    });
    
    // Also broadcast updated stats and events
    storage.getStats().then(stats => {
      broadcast({
        type: 'stats',
        data: stats
      });
    });
    
    storage.getScraperStatuses().then(scraperStatuses => {
      broadcast({
        type: 'scraperStatuses',
        data: scraperStatuses
      });
    });
    
    storage.getEvents().then(rawEvents => {
      // CRITICAL: Create a deep copy before any manipulation to prevent mutations
      // This will completely isolate the data from potential reference mutations
      const events = JSON.parse(JSON.stringify(rawEvents));
      
      // Apply filters:
      // 1. Require 3+ bookmakers
      // 2. Exclude "Simulated Reality League" events
      // 3. Exclude events with "Unknown" as team name
      const filteredEvents = events.filter(event => {
        if (!event.oddsData) return false;
        
        // Filter out Simulated Reality League
        if (event.tournament && 
            typeof event.tournament === 'string' && 
            event.tournament.includes('Simulated Reality League')) {
          return false;
        }
        
        // Filter out events with "Unknown" as team name
        if (event.teams === "Unknown") {
          return false;
        }
        
        const bookmakerCount = Object.keys(event.oddsData).length;
        return bookmakerCount >= 3; // Consistent with API endpoint (min 3 bookmakers)
      });
      
      // Sort events to prioritize ones with Sportybet odds
      filteredEvents.sort((a, b) => {
        const aHasSportybet = a.oddsData && typeof a.oddsData === 'object' && 'sporty' in a.oddsData;
        const bHasSportybet = b.oddsData && typeof b.oddsData === 'object' && 'sporty' in b.oddsData;
        
        if (aHasSportybet && !bHasSportybet) return -1; // Prioritize events with Sportybet odds
        if (!aHasSportybet && bHasSportybet) return 1;
        return 0;
      });
      
      // Track counts for broadcast events
      const eventsByBookmakerCount = {
        '1': 0,
        '2': 0,
        '3': 0,
        '4+': 0
      };
      
      let sportybetCount = 0;

      // Count events by bookmaker count for broadcast
      events.forEach(event => {
        if (!event.oddsData) return;
        const count = Object.keys(event.oddsData).length;
        
        // Count Sportybet events specifically
        if (event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData) {
          sportybetCount++;
        }
        
        if (count === 1) eventsByBookmakerCount['1']++;
        else if (count === 2) eventsByBookmakerCount['2']++;
        else if (count === 3) eventsByBookmakerCount['3']++;
        else if (count >= 4) eventsByBookmakerCount['4+']++;
      });

      // Simplified broadcast message with additional Sportybet count
      const timestamp = new Date().toISOString();
      logger.critical(`[${timestamp}] Broadcast: ${filteredEvents.length} events ready for broadcast (includes ${sportybetCount} with Sportybet odds)`);
      
      // Create another deep copy of the filtered data before sending
      const safeCopy = JSON.parse(JSON.stringify(filteredEvents));
      
      broadcast({
        type: 'events',
        data: safeCopy
      });
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.FAILED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.FAILED,
      data
    });
    
    // Also send notification
    broadcast({
      type: 'notification',
      data: {
        message: `Scraper failed: ${data.error}`,
        status: 'error'
      }
    });
  });
  
  // Bookmaker events
  scraperEvents.on(SCRAPER_EVENTS.BOOKMAKER_STARTED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.BOOKMAKER_STARTED,
      data
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.BOOKMAKER_COMPLETED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.BOOKMAKER_COMPLETED,
      data
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.BOOKMAKER_FAILED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.BOOKMAKER_FAILED,
      data
    });
  });
  
  // Processing events
  scraperEvents.on(SCRAPER_EVENTS.PROCESSING_STARTED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.PROCESSING_STARTED,
      data
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.PROCESSING_COMPLETED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.PROCESSING_COMPLETED,
      data
    });
  });
  
  scraperEvents.on(SCRAPER_EVENTS.PROCESSING_FAILED, (data) => {
    broadcast({
      type: 'scraperEvent',
      event: SCRAPER_EVENTS.PROCESSING_FAILED,
      data
    });
  });

  // API Routes
  app.get('/api/bookmakers', async (req, res) => {
    try {
      const bookmakers = await storage.getBookmakers();
      res.json(bookmakers);
    } catch (error) {
      console.error('Error fetching bookmakers:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/sports', async (req, res) => {
    try {
      const sports = await storage.getSports();
      res.json(sports);
    } catch (error) {
      console.error('Error fetching sports:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/events', async (req, res) => {
    try {
      const sportIdParam = req.query.sportId as string | undefined;
      const minBookmakers = req.query.minBookmakers ? parseInt(req.query.minBookmakers as string, 10) : 3; // Updated to require 3+ bookmakers by default
      let rawEvents;

      if (sportIdParam) {
        const sportId = parseInt(sportIdParam, 10);
        if (isNaN(sportId)) {
          return res.status(400).json({ message: 'Invalid sport ID' });
        }
        rawEvents = await storage.getEventsBySportId(sportId);
      } else {
        rawEvents = await storage.getEvents();
      }
      
      // CRITICAL: Create a deep copy of all events to prevent reference modifications
      // This is essential to fix the disappearing events issue
      const events = JSON.parse(JSON.stringify(rawEvents));

      // ENHANCED APPROACH: Directly load Sportybet events from raw data
      // Get Sportybet data directly from file
      let allSportyEvents = [];
      try {
        const rawSportyData = await storage.getBookmakerData('sporty', true);
        // Only log as debug since this is verbose
        const sportyCount = Array.isArray(rawSportyData) ? rawSportyData.length : 0;
        
        if (Array.isArray(rawSportyData)) {
          // Filter out Simulated Reality League events from raw data
          allSportyEvents = rawSportyData.filter(event => {
            const tournament = event.tournament || '';
            return !tournament.includes('Simulated Reality League');
          });
        }
      } catch (e) {
        logger.critical(`Error checking raw Sportybet data: ${e}`);
      }
      
      // Add debugging info for Sportybet data in database
      const sportyEvents = events.filter(event => 
        event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
      );

      // Get all events that meet the minimum bookmaker requirement
      const eventsWithMinBookmakers = events.filter(event => {
        if (!event.oddsData) return false;
        
        const bookmakerCount = Object.keys(event.oddsData).length;
        return bookmakerCount >= minBookmakers;
      });
      
      // Get all events with Sportybet odds that ALSO meet the minimum bookmaker requirement
      const eventsWithSporty = events.filter(event => 
        event.oddsData && 
        typeof event.oddsData === 'object' && 
        'sporty' in event.oddsData &&
        Object.keys(event.oddsData).length >= minBookmakers
      );
      
      // Start with Sportybet events that meet the minimum bookmaker requirement
      const filteredEvents = [...eventsWithSporty];
      
      // Add events from eventsWithMinBookmakers that aren't already in filteredEvents
      const existingIds = new Set(filteredEvents.map(event => event.id));
      
      for (const event of eventsWithMinBookmakers) {
        if (!existingIds.has(event.id)) {
          filteredEvents.push(event);
          existingIds.add(event.id);
        }
      }
      
      // DIRECT INSERTION: If we detect even a small drop in Sportybet events, create events directly
      // This ensures we maintain maximum event coverage by immediately injecting any missing events
      if (allSportyEvents.length > 0 && eventsWithSporty.length < allSportyEvents.length * 0.99) {
        // Don't log this on every API call to reduce noise
        // We only need to log this when direct events are created
        const directEventCount = allSportyEvents.length - eventsWithSporty.length;
        
        // Function to normalize eventId format - extracts numeric part from "sr:match:12345" format
        const normalizeEventId = (eventId: string): string => {
          // If it's in sr:match:12345 format, extract just the numeric part
          if (typeof eventId === 'string' && eventId.includes('sr:match:')) {
            return eventId.replace(/\D/g, '');
          }
          return eventId;
        };
        
        // Track both original and normalized event IDs
        const existingEventIdMap = new Map();
        eventsWithSporty.forEach(event => {
          const eventId = event.eventId || '';
          if (eventId) {
            // Add the original event ID
            existingEventIdMap.set(eventId, true);
            
            // Also add the normalized version
            const normalizedId = normalizeEventId(eventId);
            existingEventIdMap.set(normalizedId, true);
            
            // If we have an externalId, add that too
            if (event.externalId && event.externalId !== eventId) {
              existingEventIdMap.set(event.externalId, true);
              existingEventIdMap.set(normalizeEventId(event.externalId), true);
            }
          }
        });
        
        // Create direct events for any Sportybet events not already in filtered list
        const directEvents = [];
        
        for (const event of allSportyEvents) {
          // Skip if already included
          const eventId = event.eventId || event.id || '';
          const originalId = event.originalEventId || '';
          
          // Check if this event is already in our map (by any of its possible IDs)
          if (!eventId || 
              existingEventIdMap.has(eventId) || 
              (originalId && existingEventIdMap.has(originalId)) ||
              existingEventIdMap.has(normalizeEventId(eventId)) ||
              (originalId && existingEventIdMap.has(normalizeEventId(originalId)))
          ) continue;
          
          // Create basic event structure
          const teams = event.teams || event.event || '';
          if (!teams || teams === "Unknown") continue;
          
          // Get odds data
          let odds = null;
          if (event.odds) {
            odds = event.odds;
          } else if (event.home_odds && event.draw_odds && event.away_odds) {
            odds = {
              home: parseFloat(event.home_odds),
              draw: parseFloat(event.draw_odds),
              away: parseFloat(event.away_odds)
            };
          } else if (event.raw && event.raw.home_odds && event.raw.draw_odds && event.raw.away_odds) {
            odds = {
              home: parseFloat(event.raw.home_odds),
              draw: parseFloat(event.raw.draw_odds),
              away: parseFloat(event.raw.away_odds)
            };
          }
          
          if (!odds) continue;
          
          // Skip Simulated Reality League events
          const tournamentName = event.tournament || event.raw?.tournament || '';
          if (tournamentName.includes('Simulated Reality League')) {
            continue;
          }
          
          // We won't create direct events with only Sportybet data anymore
          // as they would have only one bookmaker and wouldn't meet our 3+ bookmaker requirement
          // However, we'll keep the structure in place for potential future use with multiple bookmakers
          
          // Skip this event - it only has Sportybet odds (1 bookmaker)
          continue;
          
          if (directEvents.length <= 5) {
            logger.info(`Created direct event: ${teams} (${eventId})`);
          }
        }
        
        // Add direct events to filtered events
        if (directEvents.length > 0) {
          // Only log this during scraper runs, not on every API call
          // This is controlled by the referer header
          const referer = req.headers.referer || '';
          if (referer.includes('scraper') || referer.includes('admin')) {
            logger.critical(`Created ${directEvents.length} direct Sportybet events`);
          }
          filteredEvents.push(...directEvents);
        }
      }
      
      // Check after filtering for Sportybet events but don't log it to reduce noise
      const filteredSportyEvents = filteredEvents.filter(event => 
        event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
      );
      
      res.json(filteredEvents);
    } catch (error) {
      logger.error(`Error fetching events: ${error}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }

      const event = await storage.getEvent(id);
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      res.json(event);
    } catch (error) {
      logger.error(`Error fetching event: ${error}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get odds history for a specific event
  app.get('/api/events/:eventId/history', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { bookmaker } = req.query;
      
      // Import the utility functions
      const { getOddsHistory } = await import('./utils/oddsHistory');
      
      // Get the history
      const history = await getOddsHistory(eventId);
      
      // Filter by bookmaker if specified
      let filteredHistory = history;
      if (bookmaker) {
        filteredHistory = history.filter(h => h.bookmakerCode === bookmaker);
      }
      
      // Sort by timestamp descending (newest first)
      filteredHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(filteredHistory);
    } catch (error) {
      logger.error(`Error fetching odds history: ${error}`);
      res.status(500).json({ error: 'Failed to fetch odds history' });
    }
  });
  
  // Get margin history for a specific event
  app.get('/api/events/margins/:eventId', async (req, res) => {
    try {
      const { eventId } = req.params;
      
      // Import the utility functions
      const { getOddsHistory } = await import('./utils/oddsHistory');
      
      // Get the odds history
      const history = await getOddsHistory(eventId);
      
      // Calculate margins for each odds history entry
      const marginHistory = history.map(entry => {
        if (!entry.homeOdds || !entry.drawOdds || !entry.awayOdds) {
          return null; // Skip entries with missing odds
        }
        
        // Calculate margin using the formula (1/home) + (1/draw) + (1/away) - 1
        // This matches the OddsTable calculation
        const margin = (1 / entry.homeOdds) + (1 / entry.drawOdds) + (1 / entry.awayOdds) - 1;
        
        return {
          eventId: entry.eventId,
          bookmakerCode: entry.bookmakerCode,
          margin: margin,
          timestamp: entry.timestamp
        };
      }).filter(entry => entry !== null);
      
      // Sort by timestamp descending (newest first)
      marginHistory.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(marginHistory);
    } catch (error) {
      logger.error(`Error fetching margin history: ${error}`);
      res.status(500).json({ error: 'Failed to fetch margin history' });
    }
  });
  
  // Get tournament margin history for a specific tournament
  app.get('/api/tournaments/margins/history', async (req, res) => {
    try {
      const { tournament, bookmaker, country } = req.query;
      
      if (!tournament) {
        return res.status(400).json({ error: 'Tournament name is required' });
      }
      
      // Import the utility functions
      const { getTournamentMarginHistory } = await import('./utils/tournamentMargins');
      
      // Get the tournament margin history
      // Include country filter if provided to ensure we only get margins for specific country's tournament
      const history = await getTournamentMarginHistory(
        tournament as string, 
        bookmaker as string | undefined,
        country as string | undefined
      );
      
      res.json(history);
    } catch (error) {
      logger.error(`Error fetching tournament margins history: ${error}`);
      res.status(500).json({ error: 'Failed to fetch tournament margins history' });
    }
  });
  
  // Get all tournament margins (latest)
  app.get('/api/tournaments/margins', async (req, res) => {
    try {
      // Import the db and sql
      const { db } = await import('./db');
      const { tournamentMargins } = await import('@shared/schema');
      
      // Get the latest tournament margins
      const results = await db.query.tournamentMargins.findMany({
        orderBy: (margins, { desc }) => [desc(margins.timestamp)]
      });
      
      res.json(results);
    } catch (error) {
      logger.error(`Error fetching all tournament margins: ${error}`);
      res.status(500).json({ error: 'Failed to fetch tournament margins' });
    }
  });
  
  // Debug endpoint to check for Premier League events
  // Previous Premier League check endpoint was removed to avoid duplicates
  
  // Special endpoint to fix Sportybet data
  app.get('/api/fix-sportybet', async (req, res) => {
    try {
      const apiKey = req.header('x-admin-key');
      if (apiKey !== process.env.ADMIN_API_KEY && apiKey !== 'pawaodds123') {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // This is a legacy endpoint for backward compatibility
      // Since we now use the Python Sportybet scraper by default, this fix
      // is no longer necessary for normal operation, but kept as a safety backup
      logger.critical(`Starting manual Sportybet fix via API endpoint (legacy operation)`);
      const { fixSportybetData } = await import('./utils/sportybetFix');
      await fixSportybetData(storage);
      
      // Get the updated counts for the response
      const allEvents = await storage.getEvents();
      const eventsWithSportybet = allEvents.filter(event => 
        event.oddsData && typeof event.oddsData === 'object' && 'sporty' in event.oddsData
      );
      
      // Read the raw data without reference to avoid modifying it
      const rawSportyData = await storage.getBookmakerData('sporty', true);
      // Create deep copy to prevent accidental modifications
      const sportyData = rawSportyData ? JSON.parse(JSON.stringify(rawSportyData)) : null;
      
      // Return results
      return res.json({
        success: true,
        message: `Sportybet fix completed successfully`,
        sportyDataCount: Array.isArray(sportyData) ? sportyData.length : 0,
        existingEventsWithSportybet: eventsWithSportybet.length,
        totalEvents: allEvents.length
      });
    } catch (error) {
      logger.critical(`Error in Sportybet fix: ${error}`);
      return res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
  });
  
  // Admin-only endpoint to check Premier League events
  app.get('/api/check-premier-league', async (req, res) => {
    try {
      const apiKey = req.header('x-admin-key');
      if (apiKey !== process.env.ADMIN_API_KEY && apiKey !== 'pawaodds123') {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      // Get all events from the database
      const events = await storage.getEvents();
      
      // Filter for Premier League events
      const premierLeagueEvents = events.filter(event => {
        return event.country === 'England' && 
               event.tournament === 'Premier League';
      });
      
      // Check how many have Sportybet odds
      const withSportybet = premierLeagueEvents.filter(event => {
        const oddsData = event.oddsData as Record<string, any>;
        return oddsData && oddsData.sporty;
      });
      
      // Check for upcoming matches (May 10-11)
      const upcomingMatches = premierLeagueEvents.filter(event => {
        // Get the date part
        const eventDate = event.date;
        // Check if it's May 10 or 11
        return eventDate && (eventDate === '2025-05-10' || eventDate === '2025-05-11');
      });
      
      // Use our helper function to get Premier League data from Sportybet
      // This is kept for diagnostics but uses the Python scraped data now
      const { getPremierLeagueData } = await import('./utils/sportybetFix');
      // Getting Premier League data with deep copy to prevent modifications
      const rawSportyData = await getPremierLeagueData(storage);
      
      res.json({
        total: premierLeagueEvents.length,
        withSportybet: withSportybet.length,
        upcomingMatchCount: upcomingMatches.length,
        
        // Add Sportybet source data information
        plEventsInSportyData: rawSportyData.premierLeagueCount,
        sportyTotalEvents: rawSportyData.totalEvents,
        
        // Database events
        databaseEvents: premierLeagueEvents.map(e => ({
          id: e.id,
          teams: e.teams,
          date: e.date,
          time: e.time,
          hasSportybet: Boolean((e.oddsData as Record<string, any>)?.sporty),
          bookmakers: Object.keys(e.oddsData as Record<string, any> || {})
        })),
        
        // Raw source events
        rawSportyEvents: rawSportyData.premierLeagueEvents
      });
      
    } catch (error) {
      logger.error(`Error checking Premier League events: ${error}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get tournament margin calculation details
  app.get('/api/tournaments/margins/details', async (req, res) => {
    try {
      const { tournament, bookmaker, country } = req.query;
      
      if (!tournament || !bookmaker) {
        return res.status(400).json({ error: 'Tournament name and bookmaker code are required' });
      }
      
      // Get all events for this tournament
      const events = await storage.getEvents();
      
      // Filter events by tournament name AND country if provided
      const tournamentEvents = events.filter(event => 
        (event.tournament === tournament || event.league === tournament) && 
        // If country is specified, only include events from that country
        (country ? event.country === country : true) &&
        event.oddsData && 
        event.oddsData[bookmaker as string]
      );
      
      if (tournamentEvents.length === 0) {
        return res.json({
          tournament: tournament,
          bookmaker: bookmaker,
          events: [],
          count: 0,
          message: 'No events found for this tournament and bookmaker'
        });
      }
      
      // Calculate margin for each event
      const eventsWithMargin = tournamentEvents.map(event => {
        const odds = event.oddsData[bookmaker as string];
        const homeOdds = parseFloat(odds.home?.toString() || '0');
        const drawOdds = parseFloat(odds.draw?.toString() || '0');
        const awayOdds = parseFloat(odds.away?.toString() || '0');
        
        // Skip if any odds are missing
        if (!homeOdds || !drawOdds || !awayOdds) {
          return {
            ...event,
            margin: null,
            marginCalculation: 'Missing odds'
          };
        }
        
        // Calculate margin
        const margin = (1 / homeOdds) + (1 / drawOdds) + (1 / awayOdds) - 1;
        
        return {
          id: event.id,
          home: event.home,
          away: event.away,
          time: event.time,
          homeOdds,
          drawOdds,
          awayOdds,
          margin,
          marginPercentage: (margin * 100).toFixed(2) + '%',
          marginCalculation: `(1/${homeOdds}) + (1/${drawOdds}) + (1/${awayOdds}) - 1 = ${margin.toFixed(4)}`
        };
      }).filter(event => event.margin !== null);
      
      // Calculate average margin
      const totalMargin = eventsWithMargin.reduce((sum, event) => sum + (event.margin || 0), 0);
      const averageMargin = totalMargin / eventsWithMargin.length;
      
      // Get the country from the first event (they should all be same country)
      const eventCountry = tournamentEvents.length > 0 ? tournamentEvents[0].country : null;
      
      res.json({
        tournament: tournament,
        country: country || eventCountry, // Use provided country or detect from event
        bookmaker: bookmaker,
        events: eventsWithMargin,
        count: eventsWithMargin.length,
        totalMargin,
        averageMargin,
        averageMarginPercentage: (averageMargin * 100).toFixed(2) + '%'
      });
    } catch (error) {
      logger.error(`Error fetching tournament margin details: ${error}`);
      res.status(500).json({ error: 'Failed to fetch tournament margin details' });
    }
  });
  
  // Add an endpoint to get all tournament margins grouped by country
  app.get('/api/tournaments/margins/by-country', async (req, res) => {
    try {
      // Import the db and sql
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      const { tournamentMargins } = await import('@shared/schema');
      
      // Get latest tournament margins from the database
      const results = await db.execute(sql`
        WITH latest_records AS (
          SELECT 
            DISTINCT ON (country_name, tournament, bookmaker_code) 
            id,
            country_name, 
            tournament, 
            bookmaker_code,
            average_margin,
            event_count,
            timestamp
          FROM tournament_margins
          ORDER BY country_name, tournament, bookmaker_code, timestamp DESC
        )
        SELECT * FROM latest_records
        ORDER BY country_name, tournament
      `);
      
      // Group the results by country
      const countriesMap = new Map();
      
      for (const record of results.rows) {
        const countryName = record.country_name || 'Unknown';
        
        if (!countriesMap.has(countryName)) {
          countriesMap.set(countryName, {
            name: countryName,
            tournaments: {}
          });
        }
        
        const country = countriesMap.get(countryName);
        const tournamentName = record.tournament;
        
        if (!country.tournaments[tournamentName]) {
          country.tournaments[tournamentName] = {
            name: tournamentName,
            bookmakers: {}
          };
        }
        
        country.tournaments[tournamentName].bookmakers[record.bookmaker_code] = {
          margin: parseFloat(record.average_margin),
          eventCount: record.event_count,
          timestamp: record.timestamp
        };
      }
      
      // Convert map to array and sort alphabetically
      const countries = Array.from(countriesMap.values()).map(country => {
        // Convert tournaments object to array for easier rendering
        const tournamentsArray = Object.values(country.tournaments).map((tournament: any) => ({
          ...tournament,
          // Keep bookmakers as an object for easy lookup by code
        }));
        
        return {
          ...country,
          tournaments: tournamentsArray
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
      
      res.json(countries);
    } catch (error) {
      console.error('Error fetching tournament margins by country:', error);
      res.status(500).json({ error: 'Failed to fetch tournament margins' });
    }
  });

  app.get('/api/stats', async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/scrapers/status', async (req, res) => {
    try {
      const scraperStatuses = await storage.getScraperStatuses();
      res.json(scraperStatuses);
    } catch (error) {
      console.error('Error fetching scraper statuses:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Admin endpoint for manually calculating tournament margins
  app.post('/api/admin/calculate/margins', simpleAdminAuth, async (req, res) => {
    try {
      // Import the tournament margins utility
      const { calculateAndStoreTournamentMargins } = await import('./utils/tournamentMargins');
      
      // Calculate and store tournament margins
      await calculateAndStoreTournamentMargins(storage);
      
      res.json({ 
        success: true, 
        message: 'Tournament margins calculation completed successfully' 
      });
    } catch (error) {
      console.error('Error calculating tournament margins:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to calculate tournament margins',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint to check if a custom scraper exists for a bookmaker
  app.get('/api/scrapers/custom/:bookmakerCode', async (req, res) => {
    try {
      const { bookmakerCode } = req.params;
      if (!bookmakerCode) {
        return res.status(400).json({ 
          success: false, 
          message: 'No bookmaker code provided' 
        });
      }
      
      // Check if the bookmaker exists first
      const bookmaker = await storage.getBookmakerByCode(bookmakerCode);
      if (!bookmaker) {
        return res.status(404).json({ 
          success: false, 
          message: `Bookmaker with code '${bookmakerCode}' not found` 
        });
      }
      
      // Check for custom scraper
      const hasCustomScraper = customScrapers.hasCustomScraper(bookmakerCode);
      
      // Find the actual file
      const customScraperDir = path.join(process.cwd(), 'server', 'scrapers', 'custom');
      const files = fs.readdirSync(customScraperDir);
      const scraperFiles = files.filter(file => file.startsWith(`${bookmakerCode}_scraper`));
      
      let fileInfo = null;
      if (scraperFiles.length > 0) {
        const filePath = path.join(customScraperDir, scraperFiles[0]);
        const stats = fs.statSync(filePath);
        fileInfo = {
          filename: scraperFiles[0],
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      }
      
      res.json({
        success: true,
        bookmaker: {
          id: bookmaker.id,
          code: bookmaker.code,
          name: bookmaker.name,
          active: bookmaker.active
        },
        hasCustomScraper,
        file: fileInfo
      });
    } catch (error) {
      console.error('Error checking custom scraper:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to check custom scraper', 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Endpoint to test a custom scraper
  // Test endpoint for adding some sample odds history
  app.get('/api/test/history', async (req, res) => {
    try {
      const { saveOddsHistory } = await import('./utils/oddsHistory');
      const sampleEvents = ['59902914', '51116539', '50868503'];
      const sampleBookmakers = ['bp GH', 'bp KE', 'sporty', 'betika KE'];
      
      const timestamp = new Date();
      // Go back 3 days
      timestamp.setDate(timestamp.getDate() - 3);
      
      for (const eventId of sampleEvents) {
        // Create 3 days of data, 4 entries per day
        for (let day = 0; day < 3; day++) {
          // Set time to this day at midnight
          timestamp.setDate(timestamp.getDate() + 1);
          timestamp.setHours(0, 0, 0, 0);
          
          for (let hour = 6; hour <= 18; hour += 4) {
            timestamp.setHours(hour);
            
            for (const bookmaker of sampleBookmakers) {
              // Create some random fluctuating odds
              const baseHome = 1.8 + Math.random() * 0.3;
              const baseDraw = 3.2 + Math.random() * 0.5;
              const baseAway = 3.8 + Math.random() * 0.6;
              
              await saveOddsHistory(
                eventId,
                eventId, // Using eventId as externalId for simplicity
                bookmaker,
                baseHome,
                baseDraw,
                baseAway
              );
            }
          }
        }
      }
      
      res.json({ success: true, message: 'Sample history data created' });
    } catch (error) {
      console.error('Error creating sample history:', error);
      res.status(500).json({ error: 'Failed to create sample history data' });
    }
  });
  
  app.post('/api/scrapers/test/:bookmakerCode', simpleAdminAuth, async (req, res) => {
    try {
      const { bookmakerCode } = req.params;
      
      if (!bookmakerCode) {
        return res.status(400).json({ 
          success: false, 
          message: 'No bookmaker code provided' 
        });
      }
      
      // Check if the bookmaker exists
      const bookmaker = await storage.getBookmakerByCode(bookmakerCode);
      if (!bookmaker) {
        return res.status(404).json({ 
          success: false, 
          message: `Bookmaker ${bookmakerCode} not found` 
        });
      }
      
      // Check if a custom scraper exists for this bookmaker
      if (!customScrapers.hasCustomScraper(bookmakerCode)) {
        return res.status(404).json({ 
          success: false, 
          message: `No custom scraper found for bookmaker ${bookmakerCode}` 
        });
      }
      
      // Run the custom scraper
      let scrapedData: any[] = [];
      
      try {
        // Select the appropriate scraper function
        switch (bookmakerCode) {
          case 'bet365':
            scrapedData = await customScrapers.scrapeBet365();
            break;
          case 'williamhill':
            scrapedData = await customScrapers.scrapeWilliamHill();
            break;
          case 'betfair':
            scrapedData = await customScrapers.scrapeBetfair();
            break;
          case 'paddypower':
            scrapedData = await customScrapers.scrapePaddyPower();
            break;
          default:
            scrapedData = await customScrapers.runCustomScraper(bookmakerCode);
        }
        
        // Return the scraped data
        res.json({ 
          success: true, 
          message: `Test successful for ${bookmaker.name} scraper`,
          events: scrapedData.slice(0, 5), // Return just the first 5 events for preview
          count: scrapedData.length,
          bookmaker: {
            id: bookmaker.id,
            code: bookmaker.code,
            name: bookmaker.name
          }
        });
      } catch (scraperError) {
        return res.status(500).json({ 
          success: false, 
          message: `Error running ${bookmaker.name} scraper`, 
          error: scraperError instanceof Error ? scraperError.message : String(scraperError)
        });
      }
    } catch (error) {
      console.error('Error testing custom scraper:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to test custom scraper', 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post('/api/scrapers/refresh', simpleAdminAuth, async (req, res) => {
    try {
      // Send immediate response that scraper job has been triggered
      res.json({ success: true, message: 'Scrapers triggered manually' });
      
      // Run scrapers
      await runAllScrapers(storage);
      
      // Broadcast updates to all connected WebSocket clients
      const stats = await storage.getStats();
      broadcast({
        type: 'stats',
        data: stats
      });
      
      const scraperStatuses = await storage.getScraperStatuses();
      broadcast({
        type: 'scraperStatuses',
        data: scraperStatuses
      });
      
      const events = await storage.getEvents();
      broadcast({
        type: 'events',
        data: events
      });
    } catch (error) {
      console.error('Error triggering scrapers:', error);
      broadcast({
        type: 'notification',
        data: {
          message: 'Failed to run scrapers: ' + (error instanceof Error ? error.message : String(error)),
          status: 'error'
        }
      });
    }
  });

  // Endpoint to manually process event data (for debugging)
  app.post('/api/events/process', simpleAdminAuth, async (req, res) => {
    try {
      // Process and map events
      await processAndMapEvents(storage);
      
      // Return success response
      res.json({ 
        success: true, 
        message: 'Events processed successfully' 
      });
      
      // Broadcast updates to all connected WebSocket clients
      const events = await storage.getEvents();
      broadcast({
        type: 'events',
        data: events
      });
    } catch (error) {
      console.error('Error processing events:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to process events',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint to run all scrapers manually
  app.post('/api/scrapers/run', simpleAdminAuth, async (req, res) => {
    try {
      // Send immediate response
      res.json({ 
        success: true, 
        message: 'Manual scraper run initiated' 
      });
      
      // Run scrapers
      await runAllScrapers(storage);
      
      // Broadcast updates to all connected WebSocket clients
      const stats = await storage.getStats();
      broadcast({
        type: 'stats',
        data: stats
      });
      
      const scraperStatuses = await storage.getScraperStatuses();
      broadcast({
        type: 'scraperStatuses',
        data: scraperStatuses
      });
      
      const events = await storage.getEvents();
      broadcast({
        type: 'events',
        data: events
      });
      
      broadcast({
        type: 'notification',
        data: {
          message: 'Scrapers completed successfully',
          status: 'success'
        }
      });
    } catch (error) {
      console.error('Error running scrapers manually:', error);
      broadcast({
        type: 'notification',
        data: {
          message: 'Failed to run scrapers: ' + (error instanceof Error ? error.message : String(error)),
          status: 'error'
        }
      });
    }
  });

  // Endpoint to upload a scraper script
  app.post('/api/scrapers/upload', simpleAdminAuth, (req, res, next) => {
    console.log('Upload request received:', req.body);
    
    // Store the bookmaker code in req before multer processes the file
    try {
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        // This is a workaround for multer middleware that needs 
        // to access req.body.bookmaker before parsing the entire form
        const bookmakerCode = req.headers['x-bookmaker-code'] || '';
        if (bookmakerCode) {
          req.body = req.body || {};
          req.body.bookmaker = bookmakerCode;
          console.log('Setting bookmaker code from header:', bookmakerCode);
        }
      }
    } catch (err) {
      console.error('Error processing upload request:', err);
    }
    
    // Continue to multer middleware
    next();
  }, upload.single('file'), async (req, res) => {
    try {
      console.log('Upload request processed with body:', req.body);
      
      // Check for file validation errors
      if (req.fileValidationError) {
        return res.status(400).json({ 
          success: false, 
          message: req.fileValidationError 
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      const bookmakerCode = req.body.bookmaker;
      if (!bookmakerCode) {
        // Try to get bookmaker code from query parameter as a backup
        const queryBookmaker = req.query.bookmaker;
        if (queryBookmaker && typeof queryBookmaker === 'string') {
          req.body.bookmaker = queryBookmaker;
          console.log('Using bookmaker from query parameter:', queryBookmaker);
        } else {
          return res.status(400).json({ 
            success: false, 
            message: 'No bookmaker code provided' 
          });
        }
      }

      // Make file executable
      const filePath = req.file.path;
      try {
        fs.chmodSync(filePath, 0o755); // rwx r-x r-x
      } catch (chmodError) {
        console.error('Error making file executable:', chmodError);
        // Continue anyway, as this might be platform-specific
      }

      // Get the bookmaker from the database to confirm it exists
      const bookmaker = await storage.getBookmakerByCode(bookmakerCode);
      if (!bookmaker) {
        // If the bookmaker doesn't exist, delete the uploaded file
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
        
        return res.status(404).json({ 
          success: false, 
          message: `Bookmaker with code '${bookmakerCode}' not found` 
        });
      }

      // If the bookmaker was found, mark it as having a custom scraper
      if (!bookmaker.active) {
        await storage.updateBookmaker(bookmaker.id, { active: true });
      }
      
      // File extension used to determine execution method
      const fileExt = path.extname(req.file.filename).toLowerCase();
      let scriptType = 'js'; // Default to JavaScript
      
      if (fileExt === '.py') {
        scriptType = 'python';
      } else if (fileExt === '.sh') {
        scriptType = 'shell';
      } else if (fileExt === '.ts') {
        scriptType = 'typescript';
      }
      
      // Register the custom scraper
      try {
        const filePath = req.file.path;
        customScrapers.registerCustomScraper(bookmakerCode, filePath);
        console.log(`Registered custom scraper for ${bookmakerCode}`);
      } catch (regError) {
        console.error('Error registering custom scraper:', regError);
        // Continue anyway, as this is not critical
      }
      
      res.json({ 
        success: true, 
        message: 'Scraper script uploaded successfully',
        file: {
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          type: scriptType
        },
        bookmaker: {
          id: bookmaker.id,
          code: bookmaker.code,
          name: bookmaker.name
        }
      });
    } catch (error) {
      console.error('Error uploading scraper script:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to upload scraper script', 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // CRUD endpoints for bookmakers
  app.post('/api/bookmakers', simpleAdminAuth, async (req, res) => {
    try {
      const bookmaker = req.body;
      const createdBookmaker = await storage.createBookmaker(bookmaker);
      res.status(201).json(createdBookmaker);
    } catch (error) {
      console.error('Error creating bookmaker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/bookmakers/:id', simpleAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmaker ID' });
      }

      const bookmaker = await storage.getBookmaker(id);
      if (!bookmaker) {
        return res.status(404).json({ message: 'Bookmaker not found' });
      }

      const updatedBookmaker = await storage.updateBookmaker(id, req.body);
      res.json(updatedBookmaker);
    } catch (error) {
      console.error('Error updating bookmaker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  app.delete('/api/bookmakers/:id', simpleAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bookmaker ID' });
      }
      
      const bookmaker = await storage.getBookmaker(id);
      if (!bookmaker) {
        return res.status(404).json({ message: 'Bookmaker not found' });
      }
      
      // Delete the bookmaker and associated data file if exists
      const success = await storage.deleteBookmaker(id);
      
      // Try to also delete the data file
      try {
        const filePath = path.join(process.cwd(), 'data', `${bookmaker.code}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error(`Error deleting data file for bookmaker ${bookmaker.code}:`, fileError);
        // Continue even if file deletion fails
      }
      
      if (success) {
        // Broadcast the deletion to connected WebSocket clients
        broadcast({
          type: 'bookmakerDeleted',
          data: { id, name: bookmaker.name, code: bookmaker.code }
        });
        
        res.status(200).json({ message: 'Bookmaker deleted successfully' });
      } else {
        res.status(500).json({ message: 'Failed to delete bookmaker' });
      }
    } catch (error) {
      console.error('Error deleting bookmaker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // CRUD endpoints for sports
  app.post('/api/sports', simpleAdminAuth, async (req, res) => {
    try {
      const sport = req.body;
      const createdSport = await storage.createSport(sport);
      res.status(201).json(createdSport);
    } catch (error) {
      console.error('Error creating sport:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/sports/:id', simpleAdminAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid sport ID' });
      }

      const sport = await storage.getSport(id);
      if (!sport) {
        return res.status(404).json({ message: 'Sport not found' });
      }

      const updatedSport = await storage.updateSport(id, req.body);
      res.json(updatedSport);
    } catch (error) {
      console.error('Error updating sport:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Health check endpoint for UptimeRobot to keep the app awake
  app.get('/ping', (req, res) => {
    // Get the current time
    const currentTime = new Date().toISOString();
    
    // Get info about the last scraper run from our global variables
    const lastScraperRunTime = global.lastScraperRunTime || 'No record';
    
    // Return a simple health check response
    res.status(200).json({
      status: 'ok',
      time: currentTime,
      lastScraperRun: lastScraperRunTime,
      message: 'PawaOdds server is running'
    });
  });

  return httpServer;
}
