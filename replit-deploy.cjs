const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple API endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mock API endpoints for essential data
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

// Serve static files (if available)
const staticPath = path.join(__dirname, 'dist/public');
if (fs.existsSync(staticPath)) {
  console.log(`Serving static files from ${staticPath}`);
  app.use(express.static(staticPath));
  
  // SPA fallback for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // Fallback HTML if no static files
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PawaOdds Scraper</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background-color: #f5f7fa; }
            h1 { color: #0066cc; margin-bottom: 30px; }
            .status { padding: 15px; background: #f0f8ff; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #0066cc; }
            .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .card h2 { color: #333; margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; background: #f5f5f5; padding: 10px; }
            td { padding: 10px; border-top: 1px solid #eee; }
            .odds { display: inline-block; padding: 4px 8px; border-radius: 4px; margin-right: 5px; background: #e6f7ff; }
            .bookmaker { display: flex; align-items: center; padding: 10px; border: 1px solid #eee; border-radius: 4px; margin-bottom: 10px; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
            .badge-success { background: #e6f9ee; color: #00a854; }
            .badge-country { background: #f5f5f5; color: #666; margin-left: 10px; }
            .navbar { display: flex; background: #001529; padding: 10px 20px; margin-bottom: 20px; border-radius: 5px; }
            .nav-item { color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; }
            .nav-item:hover { background: #1890ff; }
          </style>
        </head>
        <body>
          <div class="navbar">
            <a href="/" class="nav-item">Dashboard</a>
            <a href="/api/bookmakers" class="nav-item">Bookmakers API</a>
            <a href="/api/events" class="nav-item">Events API</a>
          </div>
          
          <h1>PawaOdds Scraper</h1>
          
          <div class="status">
            <p>✅ Server is running successfully!</p>
            <p>Server time: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="card">
            <h2>Bookmakers</h2>
            <div class="bookmakers-container">
              <div class="bookmaker">
                <div>
                  <strong>BetPawa Kenya</strong>
                  <span class="badge badge-success">Active</span>
                  <span class="badge badge-country">KE</span>
                </div>
              </div>
              <div class="bookmaker">
                <div>
                  <strong>BetPawa Ghana</strong>
                  <span class="badge badge-success">Active</span>
                  <span class="badge badge-country">GH</span>
                </div>
              </div>
              <div class="bookmaker">
                <div>
                  <strong>SportyBet</strong>
                  <span class="badge badge-success">Active</span>
                  <span class="badge badge-country">NG</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card">
            <h2>Recent Events</h2>
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>League</th>
                  <th>Odds</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Manchester United vs Arsenal</td>
                  <td>Premier League</td>
                  <td>
                    <span class="odds">H: 2.1</span>
                    <span class="odds">D: 3.5</span>
                    <span class="odds">A: 2.7</span>
                  </td>
                </tr>
                <tr>
                  <td>Barcelona vs Real Madrid</td>
                  <td>La Liga</td>
                  <td>
                    <span class="odds">H: 1.8</span>
                    <span class="odds">D: 3.9</span>
                    <span class="odds">A: 3.2</span>
                  </td>
                </tr>
                <tr>
                  <td>Bayern Munich vs Dortmund</td>
                  <td>Bundesliga</td>
                  <td>
                    <span class="odds">H: 1.6</span>
                    <span class="odds">D: 4.2</span>
                    <span class="odds">A: 4.5</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="card">
            <h2>System Information</h2>
            <p>This is a simplified placeholder for the PawaOdds Scraper tool. The full application includes:</p>
            <ul>
              <li>Automated scraping from multiple bookmakers</li>
              <li>Tournament margin calculation</li>
              <li>Event mapping across bookmakers</li>
              <li>Live status monitoring for BetPawa Ghana/Kenya</li>
            </ul>
          </div>
        </body>
      </html>
    `);
  });
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});