const express = require("express");
const { registerRoutes } = require("./routes");
const { setupVite, serveStatic, log } = require("./vite");
const { startHeartbeatTracker } = require("./scrapers/custom/live-heartbeat");
const { storage } = require("./storage");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// No site-wide access protection
app.use((req, res, next) => {
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${res.statusCode} in ${duration}ms :: ${req.originalUrl}`);
  });
  next();
});

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
  });
});

// Setup routes that handle database operations (users, items, etc)
async function startServer() {
  const server = await registerRoutes(app);
  
  // Set up static file serving and Vite for development when applicable
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Start the heartbeat tracker
  startHeartbeatTracker(storage);
}

startServer().catch(console.error);