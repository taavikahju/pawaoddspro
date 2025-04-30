# Entry Fix Deployment Instructions

## Deployment Steps

1. Run the entry fix deployment script:
   ```bash
   ./deploy-fix-entry.sh
   ```

2. Replace your package.json with the deployment version:
   ```bash
   cp package.json.deploy package.json
   ```

3. Click the Deploy button in Replit.

4. After deployment completes, restore your development package.json:
   ```bash
   cp package.json.bak package.json
   ```

## What This Script Fixes

The main issue in previous deployment attempts was related to Vite not being able to find the entry module (index.html). This script:

1. Explicitly sets the root directory for Vite to "./client"
2. Matches React and ReactDOM versions to avoid peer dependency conflicts
3. Uses CommonJS format for configuration files
4. Uses a simplified build command that works with the explicit root

## Troubleshooting

If you encounter further issues:

1. Check the Vite documentation for the latest CommonJS configuration approach
2. Make sure all dependency versions are compatible
3. Verify that client/index.html exists and is properly formatted