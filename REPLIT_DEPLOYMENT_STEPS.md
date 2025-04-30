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