const express = require('express');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { registerRoutes } = require('./routes.cjs');

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

async function main() {
  try {
    // Register API routes
    const server = await registerRoutes(app);
    
    // Serve static files from the React app (if available)
    const frontendPath = path.join(__dirname, '../dist/client');
    if (fs.existsSync(frontendPath)) {
      console.log(`Serving static frontend from: ${frontendPath}`);
      app.use(express.static(frontendPath));
      
      // SPA fallback for client-side routing
      app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    } else {
      console.log('No frontend build found. Serving tournament margins template.');
      // Serve root directory for static files
      app.use(express.static(path.join(__dirname, '..')));
      
      // Route to serve the tournament margins template
      app.get('/tournament-margins-template', (req, res) => {
        res.sendFile(path.join(__dirname, '../tournament-margins-template.html'));
      });
      
      // Add a redirect from the root to our template for demo purposes
      app.get('/', (req, res) => {
        res.redirect('/tournament-margins-template');
      });
    }
    
    // Start the server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}/`);
    });
    
    // Handle graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, () => {
        console.log(`Received ${signal}, shutting down...`);
        server.close(() => {
          console.log('Server closed');
          process.exit(0);
        });
      });
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
main().catch(err => {
  console.error('Unhandled error in main:', err);
  process.exit(1);
});