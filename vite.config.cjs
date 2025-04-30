const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

// Define __dirname for CommonJS compatibility
const __dirname = path.resolve();

module.exports = defineConfig({
  plugins: [
    react()
    // Remove the plugins that use top-level await
  ],
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