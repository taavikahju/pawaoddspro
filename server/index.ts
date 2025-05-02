import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// Python Sportybet scraper is now the primary implementation
// Legacy fix no longer needed for normal operation, but kept in code as a safety net
// import { fixSportybetData } from "./utils/sportybetFix";
import { storage } from "./storage";
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file if it exists
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
          console.log(`Set environment variable: ${key.trim()} = ${value.trim()}`);
        }
      }
    });
  }
} catch (error) {
  console.error('Error loading .env file:', error);
}

// Set admin key for development if not already set
if (!process.env.ADMIN_KEY) {
  process.env.ADMIN_KEY = 'pawaodds123';
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// No site-wide access protection
app.use((req, res, next) => {
  next();
});

// Disabled API request logging middleware
app.use((req, res, next) => {
  next();
});

(async () => {
  const server = await registerRoutes(app);

  // NOTE: Automatic Sportybet fix has been disabled
  // We now use the Python Sportybet scraper which doesn't need the fix
  
  // For historical reference, the following code was used for the 
  // JavaScript Sportybet fix that ran every 15 minutes:
  /*
  const SPORTYBET_FIX_INTERVAL = 15 * 60 * 1000;
  
  setTimeout(async () => {
    try {
      log('Running initial Sportybet data fix...', 'scheduler');
      await fixSportybetData(storage);
    } catch (error) {
      console.error('Error in initial Sportybet fix:', error);
    }
  }, 60 * 1000);
  
  setInterval(async () => {
    try {
      log('Running scheduled Sportybet data fix...', 'scheduler');
      await fixSportybetData(storage);
    } catch (error) {
      console.error('Error in scheduled Sportybet fix:', error);
    }
  }, SPORTYBET_FIX_INTERVAL);
  */
  
  // The auto-fix is no longer needed as the Python implementation
  // is much more robust and doesn't suffer from reference issues

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
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
