#!/bin/bash
echo "===== PRODUCTION BUILD SCRIPT ====="
echo "This script prepares your project for deployment"

# Step 1: Clean up any existing build artifacts
echo "Step 1: Cleaning up previous build artifacts..."
rm -rf dist

# Step 2: Create CommonJS config files
echo "Step 2: Creating CommonJS config files..."
cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
EOF
echo "✅ Created PostCSS config"

cat > tailwind.config.cjs << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
EOF
echo "✅ Created Tailwind config"

# Step 3: Create a Vite config for production
cat > vite.config.cjs << 'EOF'
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

module.exports = defineConfig({
  root: "./client",  // Explicitly set the root directory
  plugins: [react()],
  build: {
    outDir: "../dist/client",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
EOF
echo "✅ Created Vite config for production"

# Step 4: Create a build script
cat > build-production.sh << 'EOF'
#!/bin/bash
echo "Building for production..."

# Build the client
echo "Building client..."
npx vite build --config vite.config.cjs

# Build the server
echo "Building server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist

echo "Build complete!"
EOF
chmod +x build-production.sh
echo "✅ Created build-production.sh script"

# Step 5: Set up SPA routing
echo "Step 5: Setting up SPA routing..."
mkdir -p public/tournament-margins public/live-heartbeat public/admin
# Copy index.html to these directories
if [ -f client/index.html ]; then
  cp client/index.html public/tournament-margins/index.html
  cp client/index.html public/live-heartbeat/index.html
  cp client/index.html public/admin/index.html
  echo "✅ Set up SPA routing"
else
  echo "⚠️ Warning: client/index.html not found, SPA routing setup incomplete"
fi

echo ""
echo "✅ Production build setup complete!"
echo "To build for production, run:"
echo "  ./build-production.sh"
echo ""
echo "For Replit deployment:"
echo "1. Run this script (./production-build.sh)"
echo "2. Run the build script (./build-production.sh)"
echo "3. Click the Deploy button in Replit"