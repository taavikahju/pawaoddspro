// CommonJS version of the server entry point
const express = require("express");
const path = require("path");
const fs = require("fs");

// Create Express app
const app = express();
app.use(express.json());

// Serve static files
const STATIC_PATH = path.resolve(__dirname, "client/public");
if (fs.existsSync(STATIC_PATH)) {
  app.use(express.static(STATIC_PATH));
}

// Basic health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.get("/api/bookmakers", (req, res) => {
  // Sample data
  res.json([
    { id: 1, name: "betpawa_ke", country: "KE" },
    { id: 2, name: "betpawa_gh", country: "GH" },
    { id: 3, name: "sportybet", country: "NG" }
  ]);
});

// Serve index.html for all other routes (SPA support)
app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "client/index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});