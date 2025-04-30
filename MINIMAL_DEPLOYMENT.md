# Minimal Deployment Instructions

This is a minimal deployment version of your application that will work on Replit.

## How to Deploy

1. The simplified server (replit-deploy.cjs) is already set up to run
2. Click the "Deploy" button on Replit

## What This Version Includes

- Basic API endpoints for /api/status, /api/bookmakers, and /api/events
- Simple dashboard UI showing bookmakers and events
- Server that runs on port 5000 as required by Replit

## What This Version Doesn't Include

- Live scraper functionality (temporarily removed)
- Database access (using in-memory data instead)
- Advanced features like heartbeat tracking
- React frontend (using simple HTML template instead)

## How to Restore Your Original Application

After deployment is successful, you can restore your original application:

```bash
cp package.json.original package.json
```

## Next Steps After Deployment

Once this simplified version is deployed successfully, you can gradually add back the original
functionality by:

1. Converting ES Module files to CommonJS
2. Adding back database connections
3. Re-enabling scrapers that don't use ES Module syntax
