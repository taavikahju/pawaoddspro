const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { log } = require('./vite.cjs');

// Register API routes
async function registerRoutes(app) {
  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server (while preserving the feature but removing ES Module usage)
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    log('WebSocket client connected');
    
    ws.on('message', (message) => {
      log(`Received: ${message}`);
      
      // Echo back the message
      ws.send(`Echo: ${message}`);
    });
    
    ws.on('close', () => {
      log('WebSocket client disconnected');
    });
  });

  // Helper function to broadcast to all clients
  function broadcast(data) {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(data));
      }
    });
  }

  // Basic API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/bookmakers', (req, res) => {
    res.json([
      { id: 1, name: "betpawa_ke", country: "KE", status: "active" },
      { id: 2, name: "betpawa_gh", country: "GH", status: "active" },
      { id: 3, name: "sportybet", country: "NG", status: "active" }
    ]);
  });

  app.get('/api/events', (req, res) => {
    res.json([
      { id: 101, name: "Manchester United vs Arsenal", league: "Premier League", odds: { home: 2.1, draw: 3.5, away: 2.7 } },
      { id: 102, name: "Barcelona vs Real Madrid", league: "La Liga", odds: { home: 1.8, draw: 3.9, away: 3.2 } },
      { id: 103, name: "Bayern Munich vs Dortmund", league: "Bundesliga", odds: { home: 1.6, draw: 4.2, away: 4.5 } }
    ]);
  });

  return httpServer;
}

module.exports = {
  registerRoutes
};