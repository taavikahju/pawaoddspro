#!/bin/bash
echo "===== REPLIT CLEAN DEPLOYMENT SCRIPT ====="
echo "This script prepares your project for a clean deployment on Replit"

# Step 1: Clean up previous build files and configs
echo "Step 1: Cleaning up previous files..."
rm -rf dist
rm -f package.json.deploy package.json.clean package.json.original
rm -f postcss.config.js postcss.config.cjs tailwind.config.js tailwind.config.cjs
rm -f vite.config.deployment.js vite.config.cjs

# Step 2: Create clean deployment-compatible config files
echo "Step 2: Creating CommonJS config files..."

# Create postcss.config.cjs
cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
};
EOF
echo "✅ Created PostCSS config"

# Create tailwind.config.cjs
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

# Create vite.config.cjs for deployment
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

# Step 3: Create deployment package.json
echo "Step 3: Creating deployment package.json..."
# Back up original package.json
cp package.json package.json.original

# Create deployment-compatible package.json
cat > package.json.deploy << 'EOF'
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "vite build --config vite.config.cjs && esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@hookform/resolvers": "3.3.2",
    "@neondatabase/serverless": "0.6.0",
    "@tanstack/react-query": "5.8.4",
    "@tailwindcss/typography": "0.5.10",
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

# Step 4: Set up SPA routing
echo "Step 4: Setting up SPA routing..."
mkdir -p public/tournament-margins public/live-heartbeat public/admin
# Copy the index.html to these directories for SPA routing
if [ -f client/index.html ]; then
  cp client/index.html public/tournament-margins/index.html
  cp client/index.html public/live-heartbeat/index.html
  cp client/index.html public/admin/index.html
  echo "✅ Set up SPA routing"
else
  echo "⚠️ Warning: client/index.html not found, SPA routing setup incomplete"
fi

# Step 5: Create deployment instructions
cat > REPLIT_DEPLOYMENT_STEPS.md << 'EOF'
# Replit Deployment Steps

## Before Deploying

1. Run the clean deployment script:
   ```bash
   chmod +x replit-clean-deploy.sh && ./replit-clean-deploy.sh
   ```

2. Swap to the deployment package.json:
   ```bash
   mv package.json.deploy package.json
   ```

3. Click the Deploy button in Replit interface.

## After Deployment

4. Restore your development package.json:
   ```bash
   mv package.json.original package.json
   ```

## What This Script Does

This script prepares your project for deployment by:

1. Creating CommonJS-compatible configuration files
2. Generating a deployment-specific package.json with:
   - Fixed version numbers
   - CommonJS module type
   - Simplified dependencies
   - Modified build command

3. Setting up SPA routing support for client-side navigation

## Fixing Deployment Issues

If you encounter deployment issues:

1. Check the Replit deployment logs for specific errors
2. If package installation fails, try removing more dependencies from package.json.deploy
3. If build fails due to PostCSS, make sure postcss.config.cjs is properly loaded
4. If client-side routing doesn't work, ensure the SPA routing setup is correct
EOF

echo ""
echo "✅ Deployment preparation complete!"
echo "Follow the instructions in REPLIT_DEPLOYMENT_STEPS.md to deploy your application."