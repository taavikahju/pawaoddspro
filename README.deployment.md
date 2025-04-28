# Deployment Fix Instructions

This guide explains how to fix the deployment issues for the PawaOdds application, particularly the error:
`Cannot find module '/home/runner/workspace/dist/server/index.js'`

## Issue Overview

The deployment is failing because:
1. The build process is not generating the server files in the correct location
2. There's a compatibility issue between ES modules and CommonJS modules
3. The `.mjs` files need to be handled correctly during build

## Fix Steps

1. First, run the normal build process:
   ```
   npm run build
   ```

2. Then, run the deployment fix script:
   ```
   ./deploy-fix.sh
   ```

This will:
- Create the necessary directory structure in the `dist` folder
- Copy the ES module files to the correct locations
- Create proper configuration files for deployment

## What Changed

We made several changes to fix the module issues:

1. Changed `bp_gh_live_scraper.js` to use ES Module syntax with imports/exports
2. Renamed it to `bp_gh_live_scraper.mjs` to clearly mark it as an ES module
3. Updated imports in `server/index.ts` and `server/scrapers/custom/live-scraper-adapter.ts`
4. Created TypeScript declaration files for better type support

## For Future Deployments

Always run both steps during deployment:
1. `npm run build` (standard build process)
2. `./deploy-fix.sh` (deployment structure fix)

## Troubleshooting

If deployment still fails, check:
1. The `dist/server/scrapers/custom/` directory exists and contains the `.mjs` file
2. The `dist/server-info.json` file has the correct entrypoint
3. The `dist/package.json` has `"type": "module"` set correctly