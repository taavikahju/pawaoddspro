const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

// In CommonJS, __dirname is already available
// No need to redefine it

module.exports = defineConfig({
  plugins: [
    react(),
    {
      name: 'error-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Pass all requests to Vite's handler
          next();
        });
      }
    }
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