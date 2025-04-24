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

export async function registerRoutes(app: Express): Promise<Server> {
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
    
    // Send initial events data
    storage.getEvents().then(events => {
      ws.send(JSON.stringify({
        type: 'events',
        data: events
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
          ws.send(JSON.stringify({
            type: 'events',
            data: events
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
      broadcast({
        type: 'events',
        data: events
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

      res.json(events);
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
  app.post('/api/scrapers/test/:bookmakerCode', async (req, res) => {
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

  app.post('/api/scrapers/refresh', async (req, res) => {
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

  // Endpoint to run all scrapers manually
  app.post('/api/scrapers/run', async (req, res) => {
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
  app.post('/api/scrapers/upload', (req, res, next) => {
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
  app.post('/api/bookmakers', async (req, res) => {
    try {
      const bookmaker = req.body;
      const createdBookmaker = await storage.createBookmaker(bookmaker);
      res.status(201).json(createdBookmaker);
    } catch (error) {
      console.error('Error creating bookmaker:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/bookmakers/:id', async (req, res) => {
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

  // CRUD endpoints for sports
  app.post('/api/sports', async (req, res) => {
    try {
      const sport = req.body;
      const createdSport = await storage.createSport(sport);
      res.status(201).json(createdSport);
    } catch (error) {
      console.error('Error creating sport:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/sports/:id', async (req, res) => {
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
