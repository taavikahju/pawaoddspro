#!/bin/bash
echo "===== FRESH DEPLOYMENT SETUP ====="
echo "This script prepares your project for a clean deployment from scratch"

# Step 1: Clean up any existing deployment files
echo "Step 1: Cleaning up existing deployment files..."
rm -rf dist
rm -f postcss.config.* tailwind.config.* vite.config.cjs package.json.deploy package.json.bak
rm -f REPLIT_DEPLOYMENT_STEPS.md DEPLOY_DEV_TO_PROD_INSTRUCTIONS.md MINIMAL_DEPLOYMENT_INSTRUCTIONS.md CLEAN_DEPLOY_INSTRUCTIONS.md

# Step 2: Create fresh deployment files
echo "Step 2: Creating fresh deployment files..."

# Create PostCSS Config
cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
EOF
echo "✅ Created PostCSS config"

# Create tailwind config
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
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
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
echo "✅ Created Tailwind config"

# Vite config for deployment
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
echo "✅ Created Vite config"

# Create temp deployment package.json
cp package.json package.json.bak
cat > package.json.deploy << 'EOF'
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node dist/index.js",
    "build": "vite build --config vite.config.cjs && esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist"
  },
  "dependencies": {
    "@hookform/resolvers": "3.3.2",
    "@neondatabase/serverless": "0.6.0",
    "@tailwindcss/typography": "0.5.10",
    "@tanstack/react-query": "5.8.4",
    "@vitejs/plugin-react": "4.2.0",
    "autoprefixer": "10.4.15",
    "axios": "1.6.2",
    "clsx": "2.0.0",
    "connect-pg-simple": "9.0.0",
    "drizzle-orm": "0.28.6",
    "drizzle-zod": "0.5.1",
    "esbuild": "0.19.8",
    "express": "4.18.2",
    "express-session": "1.17.3",
    "lucide-react": "0.292.0",
    "memorystore": "1.6.7",
    "node-cron": "3.0.3",
    "passport": "0.6.0",
    "passport-local": "1.0.0",
    "postcss": "8.4.31",
    "react": "18.2.0",
    "react-country-flag": "3.1.0",
    "react-dom": "18.2.0",
    "react-hook-form": "7.48.2",
    "react-icons": "4.12.0",
    "tailwindcss": "3.3.5",
    "tailwindcss-animate": "1.0.7",
    "vite": "5.0.2",
    "wouter": "2.12.0",
    "ws": "8.14.2",
    "zod": "3.22.4"
  }
}
EOF
echo "✅ Created deployment package.json"

# Set up SPA routing support
echo "Step 3: Setting up SPA routing..."
mkdir -p public/tournament-margins public/live-heartbeat public/admin
if [ -f client/index.html ]; then
  cp client/index.html public/tournament-margins/index.html
  cp client/index.html public/live-heartbeat/index.html
  cp client/index.html public/admin/index.html
  echo "✅ Set up SPA routing"
else
  echo "⚠️ Warning: client/index.html not found, SPA routing setup incomplete"
fi

# Create deployment instructions
cat > FRESH_DEPLOYMENT_STEPS.md << 'EOF'
# Fresh Deployment Instructions

## Deployment Steps

1. Replace your package.json with the deployment version:
   ```bash
   cp package.json.deploy package.json
   ```

2. Click the Deploy button in Replit.

3. After deployment completes, restore your development package.json:
   ```bash
   cp package.json.bak package.json
   ```

## What This Does

This approach:
1. Uses CommonJS for all configuration files (postcss, tailwind, vite)
2. Uses a simplified package.json with compatible dependencies
3. Sets up SPA routing for client-side navigation
4. Changes build command to output CommonJS format for server files

## Troubleshooting

If you encounter issues:

1. **NPM errors**: Further reduce dependencies in package.json.deploy
2. **Build errors**: Check build logs for specific module errors
3. **Runtime errors**: Look for missing dependencies or configuration issues 
4. **SPA routing issues**: Ensure client routes have proper index.html files

The key to successful deployment is maintaining CommonJS compatibility throughout
the build process, which this script ensures.
EOF

echo ""
echo "✅ Fresh deployment setup complete!"
echo "Follow the instructions in FRESH_DEPLOYMENT_STEPS.md to deploy your application."