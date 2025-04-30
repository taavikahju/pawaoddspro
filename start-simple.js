// Simple server starter
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// Middleware
app.use(express.json());

// Simple API endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Simple API endpoint for bookmakers data
app.get('/api/bookmakers', (req, res) => {
  res.json([
    { id: 1, name: "betpawa_ke", country: "KE", status: "active" },
    { id: 2, name: "betpawa_gh", country: "GH", status: "active" },
    { id: 3, name: "sportybet", country: "NG", status: "active" }
  ]);
});

// Simple API endpoint for events data
app.get('/api/events', (req, res) => {
  res.json([
    { id: 101, name: "Manchester United vs Arsenal", league: "Premier League", odds: { home: 2.1, draw: 3.5, away: 2.7 } },
    { id: 102, name: "Barcelona vs Real Madrid", league: "La Liga", odds: { home: 1.8, draw: 3.9, away: 3.2 } },
    { id: 103, name: "Bayern Munich vs Dortmund", league: "Bundesliga", odds: { home: 1.6, draw: 4.2, away: 4.5 } }
  ]);
});

// Simple HTML response for root
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>PawaOdds Scraper</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #0066cc; }
          .status { padding: 15px; background: #f0f8ff; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h1>PawaOdds Scraper</h1>
        <div class="status">
          <p>✅ Server is running successfully!</p>
          <p>Server time: ${new Date().toLocaleString()}</p>
        </div>
        <p>This is a simple placeholder page for the PawaOdds Scraper tool.</p>
      </body>
    </html>
  `);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});