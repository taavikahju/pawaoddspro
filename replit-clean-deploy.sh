#!/bin/bash

echo "===== REPLIT CLEAN DEPLOYMENT SCRIPT ====="
echo "This script prepares your project for a clean deployment on Replit"

# Step 1: Clean up previous files
echo "Step 1: Cleaning up previous files..."
rm -f postcss.config.cjs tailwind.config.cjs vite.config.cjs package.json.deploy

# Step 2: Create CommonJS config files
echo "Step 2: Creating CommonJS config files..."

# Create PostCSS config
cat > postcss.config.cjs << 'EOF'
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
  ]
};
EOF
echo "✅ Created PostCSS config"

# Create Tailwind config
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

# Create Vite config
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
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
EOF
echo "✅ Created Vite config"

# Step 3: Create deployment package.json
echo "Step 3: Creating deployment package.json..."
cp package.json package.json.original
cat > package.json.deploy << 'EOF'
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "node server/index.cjs",
    "build": "vite build --config vite.config.cjs && esbuild server/index.cjs --platform=node --packages=external --bundle --format=cjs --outdir=dist",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@neondatabase/serverless": "^0.8.1",
    "@tailwindcss/typography": "^0.5.10",
    "@tanstack/react-query": "^5.27.2",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "axios": "^1.6.7",
    "clsx": "^2.1.0",
    "connect-pg-simple": "^9.0.1",
    "drizzle-orm": "^0.30.0",
    "drizzle-zod": "^0.5.1",
    "esbuild": "^0.20.2",
    "express": "^4.18.3",
    "express-session": "^1.18.0",
    "lucide-react": "^0.338.0",
    "memorystore": "^1.6.7",
    "node-cron": "^3.0.3",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "postcss": "^8.4.35",
    "react": "^18.2.0",
    "react-country-flag": "^3.1.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.51.0",
    "react-icons": "^5.0.1",
    "tailwindcss": "^3.4.1",
    "tailwindcss-animate": "^1.0.7",
    "vite": "^5.1.6",
    "wouter": "^3.0.0",
    "ws": "^8.16.0",
    "zod": "^3.22.4"
  }
}
EOF
echo "✅ Created deployment package.json"

# Step 4: Set up SPA routing for client-side routing
echo "Step 4: Setting up SPA routing..."
mkdir -p public/tournament-margins
cat > public/tournament-margins/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PawaOdds</title>
  <script>
    // Rewrite to root for SPA client-side routing
    window.location.href = "/#/tournament-margins";
  </script>
</head>
<body>
  <p>Redirecting...</p>
</body>
</html>
EOF
echo "✅ Set up SPA routing"

echo ""
echo "✅ Deployment preparation complete!"
echo "Follow the instructions in REPLIT_DEPLOYMENT_STEPS.md to deploy your application."