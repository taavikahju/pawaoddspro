const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'PawaOdds server is running',
    timestamp: new Date().toISOString()
  });
});

// Main route serves a simple HTML page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>PawaOdds</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 0; 
          background-color: #f5f5f5;
        }
        header {
          background: linear-gradient(to right, #35424a, #2c3e50);
          color: white;
          padding: 1rem 0;
          text-align: center;
        }
        .highlight { color: #00BCFF; }
        .container {
          width: 90%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 0;
        }
        .card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          padding: 2rem;
          margin-bottom: 2rem;
        }
        .status {
          background-color: #e6f4ff;
          border-left: 4px solid #00BCFF;
          padding: 1rem;
          margin: 1rem 0;
        }
        footer {
          background: #35424a;
          color: white;
          text-align: center;
          padding: 1rem 0;
          position: fixed;
          bottom: 0;
          width: 100%;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>pawa<span class="highlight">odds</span>.pro</h1>
      </header>
      
      <div class="container">
        <div class="card">
          <h2>Welcome to PawaOdds!</h2>
          <p>Your advanced sports betting odds comparison platform.</p>
          
          <div class="status">
            <strong>Status:</strong> We are currently setting up our full application with all bookmaker scrapers and data visualization.
          </div>
          
          <p>Server Time: ${new Date().toISOString()}</p>
        </div>
      </div>
      
      <footer>
        <p>&copy; 2025 PawaOdds</p>
      </footer>
    </body>
    </html>
  `);
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`PawaOdds server running at http://0.0.0.0:${port}/`);
});