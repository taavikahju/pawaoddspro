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

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    
    // Send initial data
    storage.getStats().then(stats => {
      ws.send(JSON.stringify({
        type: 'stats',
        data: stats
      }));
    }).catch(error => {
      console.error('Error sending initial stats:', error);
    });
    
    storage.getScraperStatuses().then(scraperStatuses => {
      ws.send(JSON.stringify({
        type: 'scraperStatuses',
        data: scraperStatuses
      }));
    }).catch(error => {
      console.error('Error sending initial scraper statuses:', error);
    });
    
    // Send initial events data - filtered to only include events with 3+ bookmakers
    storage.getEvents().then(events => {
      // Apply the same filter as the API endpoint
      const filteredEvents = events.filter(event => {
        if (!event.oddsData) return false;
        const bookmakerCount = Object.keys(event.oddsData).length;
        return bookmakerCount >= 3;
      });
      
      console.log(`WebSocket: Filtered ${events.length} events down to ${filteredEvents.length} with at least 3 bookmakers`);
      
      ws.send(JSON.stringify({
        type: 'events',
        data: filteredEvents
      }));
    }).catch(error => {
      console.error('Error sending initial events:', error);
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
            return bookmakerCount >= 3;
          });
          
          console.log(`WebSocket getEvents: Filtered ${events.length} events down to ${filteredEvents.length} with at least 3 bookmakers`);
          
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
            
            storage.getEvents().then(events => {
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
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
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
      
      console.log('Filename generator received bookmaker code:', bookmakerCode);
      console.log('Request body:', req.body);
      console.log('Request query:', req.query);
      console.log('Headers:', req.headers);
      
      // Try to get bookmaker code from custom header if not in body
      const headerBookmakerCode = req.headers['x-bookmaker-code'];
      const finalBookmakerCode = bookmakerCode || 
        (typeof headerBookmakerCode === 'string' ? headerBookmakerCode : '');
      
      if (!finalBookmakerCode) {
        console.error('No bookmaker code found in request');
        return cb(new Error('No bookmaker code provided'), '');
      }
      
      // Determine file extension
      let ext = path.extname(file.originalname);
      if (!ext) {
        // Default to .js if no extension
        ext = '.js';
      }
      
      const filename = `${finalBookmakerCode}_scraper${ext}`;
      console.log('Generated filename:', filename);
      
      cb(null, filename);
    }
  });
  
  // Initialize multer upload
  const upload = multer({ 
    storage: storage_config,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function(req, file, cb) {
      console.log("Upload request received with body:", req.body);
      
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
    
    storage.getEvents().then(events => {
      // Apply the same filter to ensure consistency
      const filteredEvents = events.filter(event => {
        if (!event.oddsData) return false;
        const bookmakerCount = Object.keys(event.oddsData).length;
        return bookmakerCount >= 3;
      });
      
      console.log(`Broadcast: Filtered ${events.length} events down to ${filteredEvents.length} with at least 3 bookmakers`);
      
      broadcast({
        type: 'events',
        data: filteredEvents
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
      const minBookmakers = req.query.minBookmakers ? parseInt(req.query.minBookmakers as string, 10) : 3;
      const pastOnly = req.query.past_only === 'true';
      const futureOnly = req.query.future_only === 'true';
      const country = req.query.country as string | undefined;
      const tournament = req.query.tournament as string | undefined;
      const afterDate = req.query.after_date as string | undefined;
      
      let events;

      if (sportIdParam) {
        const sportId = parseInt(sportIdParam, 10);
        if (isNaN(sportId)) {
          return res.status(400).json({ message: 'Invalid sport ID' });
        }
        events = await storage.getEventsBySportId(sportId);
      } else {
        events = await storage.getEvents();
      }
      
      // Filter events to only include those with at least the minimum number of bookmakers
      let filteredEvents = events.filter(event => {
        // Count bookmakers with odds for this event
        if (!event.oddsData) return false;
        
        const bookmakerCount = Object.keys(event.oddsData).length;
        return bookmakerCount >= minBookmakers;
      });
      
      // Apply time-based filters (past/future)
      // Debug to see what's coming from the database
      if (filteredEvents.length > 0) {
        console.log('First event sample:', JSON.stringify(filteredEvents[0] || {}, null, 2));
      }
      
      // Count events before filtering
      const beforeCount = filteredEvents.length;
      
      // We need to apply time-based filtering again as requested by the user
      if (pastOnly || futureOnly || afterDate) {
        const now = new Date();
        console.log('Filtering with time based filter, current time:', now.toISOString());
        
        // If afterDate is provided, parse it
        let afterDateObj: Date | null = null;
        if (afterDate) {
          try {
            afterDateObj = new Date(afterDate);
            console.log(`Filtering events after: ${afterDateObj.toISOString()}`);
          } catch (err) {
            console.error('Invalid after_date parameter:', afterDate);
          }
        }
        
        // Count events before filtering
        const beforeCount = filteredEvents.length;
        
        filteredEvents = filteredEvents.filter(event => {
          // Use any available time field to determine the event time
          let eventTime: Date | null = null;
          
          // Try all possible date field combinations
          if (event.startTime) {
            eventTime = new Date(event.startTime);
          } else if ((event as any).start_time) {
            eventTime = new Date((event as any).start_time);
          } else if (event.date && event.time) {
            // Parse date+time string
            try {
              eventTime = new Date(`${event.date} ${event.time}`);
            } catch (e) {
              // If parsing fails, create a date object from parts
              const dateParts = event.date.split('-').map(Number);
              const timeParts = event.time.split(':').map(Number);
              
              if (dateParts.length === 3 && timeParts.length >= 2) {
                eventTime = new Date(
                  dateParts[0], 
                  dateParts[1] - 1, // Month is 0-based in JS Date
                  dateParts[2],
                  timeParts[0],
                  timeParts[1],
                  timeParts.length > 2 ? timeParts[2] : 0
                );
              }
            }
          } 
          
          // If no valid time was determined, include the event by default
          if (!eventTime) {
            return true;
          }
          
          // Apply time filter based on past/future selection
          if (pastOnly) {
            return eventTime < now;
          } else if (futureOnly) {
            return eventTime >= now;
          }
          
          return true;
        });
        
        // Count events after filtering
        const afterCount = filteredEvents.length;
        console.log(`Time-based filtering: ${beforeCount} events -> ${afterCount} events (${pastOnly ? 'past' : 'future'} filter)`);
      }
      
      // Apply country filter
      if (country && country !== 'all') {
        filteredEvents = filteredEvents.filter(event => {
          if (!event.country) return false;
          // Normalize country names for comparison 
          // Remove duplicate spaces, trim, and convert to lowercase
          const normalizedEventCountry = event.country.toLowerCase().trim().replace(/\s+/g, ' ');
          const normalizedFilterCountry = country.toLowerCase().trim().replace(/\s+/g, ' ');
          return normalizedEventCountry === normalizedFilterCountry;
        });
      }
      
      // Apply tournament filter
      if (tournament && tournament !== 'all') {
        filteredEvents = filteredEvents.filter(event => {
          if (!event.tournament) return false;
          // Normalize tournament names for comparison
          const normalizedEventTournament = event.tournament.toLowerCase().trim().replace(/\s+/g, ' ');
          const normalizedFilterTournament = tournament.toLowerCase().trim().replace(/\s+/g, ' ');
          return normalizedEventTournament === normalizedFilterTournament;
        });
      }

      console.log(`Filtered ${events.length} events down to ${filteredEvents.length} with at least ${minBookmakers} bookmakers and applied filters`);
      
      res.json(filteredEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
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
      console.error('Error fetching event:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
  
  // Get odds history for a specific event
  app.get('/api/events/:eventId/history', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { bookmaker, format } = req.query;
      
      // Import the utility functions
      const { getOddsHistory } = await import('./utils/oddsHistory');
      
      // Get the history
      const history = await getOddsHistory(eventId);
      
      if (!history || history.length === 0) {
        return res.status(404).json({ 
          error: 'No historical data found',
          message: 'This event does not have any historical odds data recorded yet.'
        });
      }
      
      // Filter by bookmaker if specified
      let filteredHistory = history;
      if (bookmaker) {
        filteredHistory = history.filter(h => h.bookmakerCode === bookmaker);
      }
      
      // Sort by timestamp (oldest first for time series)
      filteredHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // If chart format is requested, transform the data for easier consumption by chart libraries
      if (format === 'chart') {
        // Group by bookmaker
        const bookmakerGroups: Record<string, any> = {};
        
        filteredHistory.forEach(entry => {
          const bookmakerCode = entry.bookmakerCode;
          
          if (!bookmakerGroups[bookmakerCode]) {
            bookmakerGroups[bookmakerCode] = {
              homeOdds: [],
              drawOdds: [],
              awayOdds: [],
              margins: []
            };
          }
          
          const timestamp = new Date(entry.timestamp).getTime();
          
          if (entry.homeOdds) {
            bookmakerGroups[bookmakerCode].homeOdds.push({
              x: timestamp,
              y: parseFloat(entry.homeOdds)
            });
          }
          
          if (entry.drawOdds) {
            bookmakerGroups[bookmakerCode].drawOdds.push({
              x: timestamp,
              y: parseFloat(entry.drawOdds)
            });
          }
          
          if (entry.awayOdds) {
            bookmakerGroups[bookmakerCode].awayOdds.push({
              x: timestamp,
              y: parseFloat(entry.awayOdds)
            });
          }
          
          if (entry.margin) {
            bookmakerGroups[bookmakerCode].margins.push({
              x: timestamp,
              y: parseFloat(entry.margin)
            });
          }
        });
        
        return res.json(bookmakerGroups);
      }
      
      // Default format - return raw history
      res.json(filteredHistory);
    } catch (error) {
      console.error('Error fetching odds history:', error);
      res.status(500).json({ error: 'Failed to fetch odds history' });
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

  return httpServer;
}
