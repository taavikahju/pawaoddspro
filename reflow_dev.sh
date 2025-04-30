#!/bin/bash
echo "===== CREATING DEV SCRIPT FOR PACKAGE.JSON ====="

# Create a temporary file with the new package.json content
cat > package.json.tmp << 'EOF'
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server/vite.ts",
    "start": "node dist/index.js",
    "build": "tsc && vite build"
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
    "next-themes": "0.2.1",
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

# Move the tmp file to package.json (can't edit directly due to restrictions)
mv package.json.tmp new-package.json

echo "✅ Created new package.json file as new-package.json"
echo "You'll need to use this file in your deployment process"
echo "Due to Replit restrictions, you can't directly edit package.json"
echo "So we've created a new file for you to use in your deployment process"

# Create script to start the development server
cat > start-dev.sh << 'EOF'
#!/bin/bash
echo "Starting development server..."
NODE_ENV=development tsx server/vite.ts
EOF

chmod +x start-dev.sh

echo "✅ Created start-dev.sh script"
echo "Run './start-dev.sh' to start the development server"