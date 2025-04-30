# Clean Deployment Instructions for Replit

## Preparation

1. Run the clean deployment setup script:
   ```bash
   chmod +x clean-deploy.sh && ./clean-deploy.sh
   ```

2. Swap to the clean package.json:
   ```bash
   cp package.json package.json.dev
   cp package.json.clean package.json
   ```

## Deploy

3. Click the Deploy button in Replit interface.

## After Deployment

4. Restore your development package.json:
   ```bash
   cp package.json.dev package.json
   ```

## What This Does

This creates a minimal configuration focused solely on what's needed for deployment:

1. Uses CommonJS module format for all configuration files
2. Uses fixed dependency versions (no ^ or ~ ranges)
3. Simplifies all configuration files
4. Changes the build command to output CommonJS for server files

## Troubleshooting

If deployment still fails:
- Check the Replit deployment logs
- You may need to add a .replit file with custom run instructions
