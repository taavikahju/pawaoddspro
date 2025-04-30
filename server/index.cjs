const express = require('express');
const path = require('path');
const { registerRoutes } = require('./routes.cjs');
const { setupVite, serveStatic, log } = require('./vite.cjs');
// Removed live scraper imports

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// No site-wide access protection
app.use((req, res, next) => {
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Use Promise instead of async/await at top level
const startServer = () => {
  registerRoutes(app)
    .then(server => {
      app.use((err, _req, res, _next) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
  
        res.status(status).json({ message });
        throw err;
      });
  
      // importantly only setup vite in development and after
      // setting up all the other routes so the catch-all route
      // doesn't interfere with the other routes
      if (app.get("env") === "development") {
        setupVite(app, server)
          .then(() => {
            // ALWAYS serve the app on port 5000
            // this serves both the API and the client.
            // It is the only port that is not firewalled.
            const port = 5000;
            server.listen({
              port,
              host: "0.0.0.0", // Updated to listen on all interfaces
              reusePort: true,
            }, () => {
              log(`serving on port ${port}`);
  
              // Removed live heartbeat tracking
              log('Live heartbeat tracker disabled for deployment');
  
              // Start SportyBet scraper automatically but without dynamic import
              try {
                setTimeout(() => {
                  // Using require instead of dynamic import
                  const { runCustomScraper } = require('./scrapers/custom/integration.cjs');
  
                  log('🚀 Running SportyBet scraper on server start...');
                  try {
                    runCustomScraper('sporty')
                      .then(events => {
                        log(`✅ SportyBet scraper collected ${events.length} events`);
  
                        // Save the data to storage
                        const { storage } = require('./storage.cjs');
                        storage.saveBookmakerData('sporty', events)
                          .then(() => {
                            log('✅ SportyBet data saved to storage');
                          })
                          .catch(error => {
                            console.error('Error saving SportyBet data:', error);
                          });
                      })
                      .catch(error => {
                        console.error('Error running SportyBet scraper:', error);
                      });
                  } catch (error) {
                    console.error('Error running SportyBet scraper:', error);
                  }
                }, 10000); // Wait 10 seconds after server start
              } catch (error) {
                console.error('Failed to initialize SportyBet scraper:', error);
              }
  
              // Removed live scraper interval
              log('Live scraper disabled for deployment.');
            });
          })
          .catch(err => {
            console.error('Error setting up Vite:', err);
          });
      } else {
        serveStatic(app);
        
        // ALWAYS serve the app on port 5000
        const port = 5000;
        server.listen({
          port,
          host: "0.0.0.0", // Updated to listen on all interfaces
          reusePort: true,
        }, () => {
          log(`serving on port ${port} in production mode`);
        });
      }
    })
    .catch(err => {
      console.error('Error registering routes:', err);
    });
};

startServer();