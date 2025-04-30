// Main server entry point for Replit deployment
// This file uses ES Module format

// Load environment variables if not in production
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './shared/schema.js';

// Get the current module's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  try {
    dotenv.config();
  } catch (error) {
    console.warn('dotenv not available, skipping .env loading');
  }
}

// Initialize database connection
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// Initialize Express
const app = express();

// Add basic middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Global error handler caught:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
    },
  });
});

// API routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Fetch all bookmakers
app.get('/api/bookmakers', async (req, res) => {
  try {
    const bookmakers = await db.select().from(schema.bookmakers);
    res.json(bookmakers);
  } catch (error) {
    console.error('Error fetching bookmakers:', error);
    res.status(500).json({ message: 'Failed to fetch bookmakers' });
  }
});

// Fetch all events
app.get('/api/events', async (req, res) => {
  try {
    const events = await db.select().from(schema.events);
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

// Fetch tournament margins
app.get('/api/tournament-margins', async (req, res) => {
  try {
    // For now we'll return sample data until we implement the database query
    const sampleData = [
      {
        id: 1,
        country: 'England',
        tournament: 'Premier League',
        margins: {
          betpawa_ke: {
            value: 1.058,
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          betpawa_gh: {
            value: 1.064,
            timestamp: new Date(Date.now() - 1800000).toISOString()
          },
          sportybet: {
            value: 1.052,
            timestamp: new Date(Date.now() - 900000).toISOString()
          }
        }
      },
      {
        id: 2,
        country: 'Spain',
        tournament: 'La Liga',
        margins: {
          betpawa_ke: {
            value: 1.061,
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          betpawa_gh: {
            value: 1.068,
            timestamp: new Date(Date.now() - 1800000).toISOString()
          },
          sportybet: {
            value: 1.055,
            timestamp: new Date(Date.now() - 900000).toISOString()
          }
        }
      },
      {
        id: 3,
        country: 'Germany',
        tournament: 'Bundesliga',
        margins: {
          betpawa_ke: {
            value: 1.059,
            timestamp: new Date(Date.now() - 3600000).toISOString()
          },
          betpawa_gh: {
            value: 1.093,
            timestamp: new Date(Date.now() - 1800000).toISOString()
          },
          sportybet: {
            value: 1.054,
            timestamp: new Date(Date.now() - 900000).toISOString()
          }
        }
      }
    ];
    res.json(sampleData);
  } catch (error) {
    console.error('Error fetching tournament margins:', error);
    res.status(500).json({ message: 'Failed to fetch tournament margins' });
  }
});

// Fetch countries
app.get('/api/countries', async (req, res) => {
  try {
    // If we have countries table, use that
    // const countries = await db.select().from(schema.countries);
    
    // For now, we'll return sample data
    const countries = [
      { name: 'England' },
      { name: 'Spain' },
      { name: 'Germany' }
    ];
    
    res.json(countries);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ message: 'Failed to fetch countries' });
  }
});

// Fetch tournaments by country
app.get('/api/tournaments', async (req, res) => {
  try {
    const { country } = req.query;
    
    if (!country) {
      return res.status(400).json({ message: 'Country parameter is required' });
    }
    
    // If we have tournaments table, use that with a filter
    // const tournaments = await db.select().from(schema.tournaments).where(eq(schema.tournaments.country, country));
    
    // For now, we'll return sample data
    const tournaments = {
      'England': [
        { name: 'Premier League', country: 'England' }
      ],
      'Spain': [
        { name: 'La Liga', country: 'Spain' }
      ],
      'Germany': [
        { name: 'Bundesliga', country: 'Germany' }
      ]
    };
    
    res.json(tournaments[country] || []);
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ message: 'Failed to fetch tournaments' });
  }
});

// Create a simple template for the tournament margins page (static HTML)
const tournamentMarginsTemplate = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tournament Margins - pawaodds.pro</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --foreground: 0 0% 98%;
      --background: 240 10% 3.9%;
      --primary: 207 90% 54%;
      --border: 240 3.7% 15.9%;
    }
    body {
      font-family: 'Inter', sans-serif;
      background-color: hsl(var(--background));
      color: hsl(var(--foreground));
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.5rem;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    th {
      background-color: rgba(255, 255, 255, 0.05);
      font-weight: 600;
    }
    .danger-triangle {
      color: #ef4444;
      display: inline-block;
      margin-left: 0.5rem;
    }
    .margin-low { color: #10b981; }
    .margin-medium { color: #f59e0b; }
    .margin-high { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="text-3xl font-bold mb-6">Tournament Margins</h1>
    
    <div class="bg-gray-800 rounded-lg shadow p-6 mb-6">
      <h2 class="text-xl font-semibold mb-4">API in Action</h2>
      <p class="mb-4">This page is a simple static demo. The real data is available through our API:</p>
      <ul class="list-disc pl-5 mb-4 space-y-2">
        <li><a href="/api/bookmakers" class="text-blue-400 hover:underline">/api/bookmakers</a> - List of all bookmakers</li>
        <li><a href="/api/tournament-margins" class="text-blue-400 hover:underline">/api/tournament-margins</a> - Tournament margin data</li>
        <li><a href="/api/countries" class="text-blue-400 hover:underline">/api/countries</a> - Available countries</li>
        <li><a href="/api/tournaments?country=England" class="text-blue-400 hover:underline">/api/tournaments?country=England</a> - Tournaments by country</li>
      </ul>
      <p>The real React frontend is being built separately. This static page is just to verify API functionality.</p>
    </div>
    
    <div id="margins-container" class="bg-gray-800 rounded-lg shadow p-6">
      <h2 class="text-xl font-semibold mb-4">Tournament Margins</h2>
      <div class="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>Tournament</th>
              <th>BetPawa Kenya</th>
              <th>BetPawa Ghana</th>
              <th>SportyBet</th>
            </tr>
          </thead>
          <tbody id="margins-table-body">
            <tr>
              <td colspan="5" class="text-center py-4">Loading tournament margins...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  
  <script>
    // Fetch the tournament margins data from the API
    fetch('/api/tournament-margins')
      .then(response => response.json())
      .then(data => {
        const tableBody = document.getElementById('margins-table-body');
        tableBody.innerHTML = '';
        
        if (data.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No tournament margins data available</td></tr>';
          return;
        }
        
        // Helper function to format margin as percentage
        function formatMargin(margin) {
          if (!margin) return '-';
          return ((margin - 1) * 100).toFixed(2) + '%';
        }
        
        // Helper function to get CSS class based on margin value
        function getMarginClass(margin) {
          if (!margin) return '';
          const percentage = (margin - 1) * 100;
          if (percentage < 5) return 'margin-low';
          if (percentage < 10) return 'margin-medium';
          return 'margin-high';
        }
        
        // Helper function to check if BetPawa has significant difference
        function hasSignificantDifference(margins) {
          const betpawaKeValue = margins?.betpawa_ke?.value;
          const betpawaGhValue = margins?.betpawa_gh?.value;
          const sportyValue = margins?.sportybet?.value;
          
          if (!betpawaKeValue && !betpawaGhValue) return false;
          if (!sportyValue) return false;
          
          const threshold = 0.025; // 2.5%
          
          if (betpawaKeValue && Math.abs(betpawaKeValue - sportyValue) >= threshold) return true;
          if (betpawaGhValue && Math.abs(betpawaGhValue - sportyValue) >= threshold) return true;
          
          return false;
        }
        
        // Populate the table
        data.forEach(item => {
          const row = document.createElement('tr');
          
          // Country column
          const countryCell = document.createElement('td');
          countryCell.textContent = item.country;
          row.appendChild(countryCell);
          
          // Tournament column
          const tournamentCell = document.createElement('td');
          tournamentCell.textContent = item.tournament;
          
          // Add warning triangle if there's a significant difference
          if (hasSignificantDifference(item.margins)) {
            const warningIcon = document.createElement('span');
            warningIcon.textContent = '⚠️';
            warningIcon.className = 'danger-triangle';
            warningIcon.title = 'Significant margin difference of 2.5% or more';
            tournamentCell.appendChild(warningIcon);
          }
          
          row.appendChild(tournamentCell);
          
          // Bookmaker columns
          const betpawaKeCell = document.createElement('td');
          betpawaKeCell.textContent = formatMargin(item.margins?.betpawa_ke?.value);
          betpawaKeCell.className = getMarginClass(item.margins?.betpawa_ke?.value);
          row.appendChild(betpawaKeCell);
          
          const betpawaGhCell = document.createElement('td');
          betpawaGhCell.textContent = formatMargin(item.margins?.betpawa_gh?.value);
          betpawaGhCell.className = getMarginClass(item.margins?.betpawa_gh?.value);
          row.appendChild(betpawaGhCell);
          
          const sportyCell = document.createElement('td');
          sportyCell.textContent = formatMargin(item.margins?.sportybet?.value);
          sportyCell.className = getMarginClass(item.margins?.sportybet?.value);
          row.appendChild(sportyCell);
          
          tableBody.appendChild(row);
        });
      })
      .catch(error => {
        console.error('Error fetching tournament margins:', error);
        const tableBody = document.getElementById('margins-table-body');
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading tournament margins data</td></tr>';
      });
  </script>
</body>
</html>
`;

// Serve the tournament margins page
app.get('/tournament-margins', (req, res) => {
  res.send(tournamentMarginsTemplate);
});

// API root info
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the pawaodds.pro API',
    endpoints: [
      '/api/status',
      '/api/bookmakers',
      '/api/events',
      '/api/tournament-margins',
      '/api/countries',
      '/api/tournaments?country=<country>'
    ]
  });
});

// Default route redirects to tournament margins page
app.get('/', (req, res) => {
  res.redirect('/tournament-margins');
});

// Create an HTTP server and WebSocket server
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send a welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to pawaodds.pro WebSocket server'
  }));
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      // Echo back the message (for testing)
      ws.send(JSON.stringify({
        type: 'echo',
        data
      }));
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Function to broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Start the server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}/`);
});

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, () => {
    console.log(`Received ${signal}, shutting down...`);
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});