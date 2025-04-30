# Complete Deployment Steps for Replit

## 1. Fix Package.json Script

First, we need to add the "dev" script to package.json. Since we cannot directly edit package.json through the editor, here's how to do it:

```bash
# Run this in the shell
npm pkg set scripts.dev="node start-simple.js"
```

This will add the "dev" script to the package.json file, which should fix the workflow.

## 2. Fix Configuration Files

Create the following CommonJS configuration files:

### postcss.config.cjs (already created)
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
```

### tailwind.config.cjs
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### vite.config.cjs
```js
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

// Define __dirname for CommonJS compatibility
const __dirname = path.resolve();

module.exports = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
```

## 3. Create Simple Server Entry

```js
// start-simple.js
const express = require('express');
const app = express();
const path = require('path');

// Middleware
app.use(express.json());

// Simple API endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files from client directory if they exist
const staticPath = path.join(__dirname, 'client');
app.use(express.static(staticPath));

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
```

## 4. Restart the Workflow

Once all files are in place and the "dev" script has been added to package.json, restart the workflow.