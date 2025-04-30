#!/bin/bash
echo "===== DEPLOY DEV TO PROD SCRIPT ====="
echo "This script prepares your development version for Replit deployment"

# Step 1: Clean up any stale build files or temporary configs
echo "Step 1: Cleaning up previous build files..."
rm -rf dist
rm -f package.json.clean package.json.dev package.json.deployment package.json.original
rm -f postcss.config.bak tailwind.config.bak vite.config.bak

# Step 2: Create deployment-compatible configurations
echo "Step 2: Creating deployment-compatible configurations..."

# Create CommonJS PostCSS config
cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
EOF
echo "✅ Created CommonJS postcss.config.cjs"

# Create CommonJS Tailwind config
cat > tailwind.config.cjs << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};
EOF
echo "✅ Created CommonJS tailwind.config.cjs"

# Create CommonJS vite config backup file
cat > vite.config.cjs << 'EOF'
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

module.exports = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    outDir: "dist/client",
  },
});
EOF
echo "✅ Created CommonJS vite.config.cjs backup"

# Step 3: Create modified package.json for deployment
echo "Step 3: Creating modified package.json for deployment..."
# Use jq if available, otherwise create a simple one
if command -v jq &> /dev/null; then
  jq '.type = "commonjs" | .scripts.build = "vite build --config vite.config.cjs && esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist"' package.json > package.json.deploy
  if [ $? -ne 0 ]; then
    echo "⚠️ Error using jq, creating basic package.json instead"
    # Create backup of original package.json
    cp package.json package.json.original
    # Extract and modify the build script manually
    sed 's/"type": "module"/"type": "commonjs"/g' package.json > package.json.deploy
    sed -i 's/vite build && esbuild server\/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/vite build --config vite.config.cjs \&\& esbuild server\/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist/g' package.json.deploy
  else
    echo "✅ Modified package.json for deployment (using jq)"
    cp package.json package.json.original
  fi
else
  # Create backup of original package.json
  cp package.json package.json.original
  # Extract and modify the build script manually
  sed 's/"type": "module"/"type": "commonjs"/g' package.json > package.json.deploy
  sed -i 's/vite build && esbuild server\/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/vite build --config vite.config.cjs \&\& esbuild server\/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist/g' package.json.deploy
  echo "✅ Modified package.json for deployment (using sed)"
fi

# Step 4: Set up clean production environment
echo "Step 4: Setting up SPA routing for clean production environment..."
mkdir -p public/tournament-margins public/live-heartbeat public/admin
[ -f client/index.html ] && cp client/index.html public/tournament-margins/index.html
[ -f client/index.html ] && cp client/index.html public/live-heartbeat/index.html
[ -f client/index.html ] && cp client/index.html public/admin/index.html
echo "✅ Set up SPA routing"

# Step 5: Create deployment instructions
echo "Step 5: Creating deployment instructions..."
cat > DEPLOY_DEV_TO_PROD_INSTRUCTIONS.md << 'EOF'
# Deploy Development to Production

## Before Deployment

1. Replace your package.json with the deployment-compatible version:
   ```
   cp package.json.deploy package.json
   ```

2. Make sure your environment has all the necessary secrets:
   - DATABASE_URL for PostgreSQL connection

## Deploy

3. Click the "Deploy" button in the Replit interface.

## After Deployment

4. Restore your development package.json:
   ```
   cp package.json.original package.json
   ```

## Explanation

This process:
1. Ensures compatibility between your development environment and Replit's production environment
2. Changes module format from ES modules to CommonJS for deployment
3. Uses explicit .cjs extension for configuration files to avoid module format confusion
4. Establishes proper client-side routing support for SPA

## Troubleshooting

If deployment fails:

1. Check error logs for specific package problems and remove problematic dependencies
2. Try manual build:
   ```
   vite build --config vite.config.cjs
   ```
EOF

echo ""
echo "✅ Deployment preparation complete!"
echo "Follow the instructions in DEPLOY_DEV_TO_PROD_INSTRUCTIONS.md to deploy your development version to production."