# Fresh Deployment Instructions

## Deployment Steps

1. Run the fresh deployment script:
   ```bash
   ./fresh-deploy.sh
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