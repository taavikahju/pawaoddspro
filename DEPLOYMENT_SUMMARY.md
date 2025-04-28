# PawaOdds Deployment Guide

## Deploying to Replit

Follow these simple steps to deploy the PawaOdds application on Replit:

1. **Build the application with our improved script:**
   ```
   ./build-deploy.sh
   ```

   This script performs the following tasks:
   - Builds the application using Vite and esbuild
   - Fixes the directory structure for deployment
   - Places client files in the proper location
   - Copies all necessary scraper files
   - Sets up package.json and server-info.json files

2. **Deploy using Replit's deployment feature:**
   - Click the "Deploy" button in Replit interface
   - The application will be deployed to your Replit subdomain

## Troubleshooting Common Issues

### If deployment fails:

1. **Check file structure**
   - Ensure the script completed successfully
   - Verify that `dist/server/public` directory contains client files
   - Confirm `dist/server/index.js` exists

2. **Database connection issues**
   - Verify that the PostgreSQL database is accessible
   - Check environment variables in the Replit Secrets panel

3. **Scraper issues**
   - Confirm that all scraper files were copied to `dist/server/scrapers/custom`
   - Look for any import path issues in scraper files

## Monitoring Your Deployment

- Check the deployment logs in Replit
- Verify that the application is responding to API requests
- Monitor the WebSocket connections for live heartbeat tracking

## Technical Note

The main issues that required fixing in the deployment process were:

1. Client files needed to be in `/dist/server/public` but were being placed elsewhere
2. Server file needed to be in `/dist/server/index.js` but was at `/dist/index.js`
3. ES Module compatibility required fixing with a proper package.json configuration

The `build-deploy.sh` script addresses all these issues and performs the necessary file organization for a successful deployment.