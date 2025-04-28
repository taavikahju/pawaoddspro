import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startHeartbeatTracker } from "./scrapers/custom/live-heartbeat";
import { storage } from "./storage";
// Added import for bp_gh_live_scraper
const { runLiveScraper } = require("./scrapers/custom/bp_gh_live_scraper.js");


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
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

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

    // Start the heartbeat tracker with default URL
    const defaultHeartbeatUrl = 'https://www.betpawa.com.gh/api/sportsbook/v2/events/lists/by-queries?q=%7B%22queries%22%3A%5B%7B%22query%22%3A%7B%22eventType%22%3A%22LIVE%22%2C%22categories%22%3A%5B%222%22%5D%2C%22zones%22%3A%7B%7D%7D%2C%22view%22%3A%7B%22marketTypes%22%3A%5B%223743%22%5D%7D%2C%22skip%22%3A0%2C%22sort%22%3A%7B%22competitionPriority%22%3A%22DESC%22%7D%2C%22take%22%3A20%7D%5D%7D';
    startHeartbeatTracker(defaultHeartbeatUrl, storage);
    log('Live heartbeat tracker started automatically');

    // Start SportyBet scraper automatically
    try {
      setTimeout(async () => {
        // Import here to avoid circular dependencies
        const { runCustomScraper } = await import('./scrapers/custom/integration');

        log('🚀 Running SportyBet scraper on server start...');
        try {
          const events = await runCustomScraper('sporty');
          log(`✅ SportyBet scraper collected ${events.length} events`);

          // Save the data to storage
          await storage.saveBookmakerData('sporty', events);
          log('✅ SportyBet data saved to storage');
        } catch (error) {
          console.error('Error running SportyBet scraper:', error);
        }
      }, 10000); // Wait 10 seconds after server start
    } catch (error) {
      console.error('Failed to initialize SportyBet scraper:', error);
    }

    // Added to run the live scraper. Adjust the scheduling as needed.
    setInterval(runLiveScraper, 60000); // Run every minute
    log('Live scraper started.');
  });
})();