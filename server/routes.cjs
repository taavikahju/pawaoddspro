const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { storage } = require('./storage.cjs');

// Initialize storage
const storageInstance = storage;

async function registerRoutes(app) {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server (for live updates)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('WebSocket message received:', data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Broadcast function for sending messages to all connected clients
  function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }
  
  // API Routes
  
  // Status endpoint
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: require('../package.json').version
    });
  });
  
  // Bookmakers endpoint
  app.get('/api/bookmakers', async (req, res) => {
    try {
      const bookmakers = await storageInstance.getBookmakers();
      res.json(bookmakers);
    } catch (error) {
      console.error('Error fetching bookmakers:', error);
      res.status(500).json({ error: 'Failed to fetch bookmakers' });
    }
  });
  
  // Events endpoint
  app.get('/api/events', async (req, res) => {
    try {
      // Get query parameters
      const { bookmaker, tournament, country, status } = req.query;
      
      // Fetch events with filters
      const events = await storageInstance.getEvents({ 
        bookmaker, 
        tournament, 
        country,
        status 
      });
      
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });
  
  // Tournament margins endpoint
  app.get('/api/tournament-margins', async (req, res) => {
    try {
      const margins = await storageInstance.getTournamentMargins();
      res.json(margins);
    } catch (error) {
      console.error('Error fetching tournament margins:', error);
      res.status(500).json({ error: 'Failed to fetch tournament margins' });
    }
  });
  
  // Countries endpoint
  app.get('/api/countries', async (req, res) => {
    try {
      const countries = await storageInstance.getCountries();
      res.json(countries);
    } catch (error) {
      console.error('Error fetching countries:', error);
      res.status(500).json({ error: 'Failed to fetch countries' });
    }
  });
  
  // Tournaments endpoint
  app.get('/api/tournaments', async (req, res) => {
    try {
      const { country } = req.query;
      const tournaments = await storageInstance.getTournaments(country);
      res.json(tournaments);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      res.status(500).json({ error: 'Failed to fetch tournaments' });
    }
  });
  
  // Admin routes (protected by API key)
  app.use('/api/admin', (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!apiKey || apiKey !== adminKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
  });
  
  // Trigger scraping manually
  app.post('/api/admin/scrape', async (req, res) => {
    try {
      const { bookmaker } = req.body;
      
      // This would trigger scraping in the full application
      // For now, we'll just return a success message
      res.json({ 
        status: 'success', 
        message: `Scraping triggered for ${bookmaker || 'all bookmakers'}`
      });
    } catch (error) {
      console.error('Error triggering scrape:', error);
      res.status(500).json({ error: 'Failed to trigger scraping' });
    }
  });
  
  return httpServer;
}

module.exports = { registerRoutes };