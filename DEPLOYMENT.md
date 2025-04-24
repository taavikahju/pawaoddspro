# Deployment Guide for PawaOdds.pro

This guide provides comprehensive instructions for deploying the PawaOdds application to a production environment. The application is designed to be deployed on a Hetzner Cloud server, but the instructions can be adapted for other hosting providers.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deploy with GitHub Actions (Recommended)](#deploy-with-github-actions-recommended)
3. [Manual Deployment](#manual-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Database Backups](#database-backups)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

- A GitHub account and repository for your code
- A Hetzner Cloud account (or another cloud provider)
- Basic knowledge of Linux, Git, and Node.js
- Domain name (optional)

## Deploy with GitHub Actions (Recommended)

This method provides continuous deployment through GitHub Actions.

### Step 1: Set Up Server

1. Create a Hetzner Cloud server (CPX11 or higher recommended - 2GB RAM, 1 vCPU)
2. Choose Ubuntu 22.04 as the operating system
3. Upload your SSH key during server creation or add it later
4. Connect to your server via SSH: `ssh root@your-server-ip`
5. Run the setup script:

```bash
# Download the setup script
curl -O https://raw.githubusercontent.com/yourusername/pawaodds/main/scripts/setup-server.sh

# Make it executable
chmod +x setup-server.sh

# Run the script
./setup-server.sh
```

6. Follow the prompts to set up the deploy user and environment
7. Save the generated credentials from the output

### Step 2: Configure GitHub Secrets

In your GitHub repository, go to Settings > Secrets and variables > Actions, and add the following secrets:

- `SSH_PRIVATE_KEY`: Your SSH private key (content of ~/.ssh/id_rsa)
- `SERVER_IP`: Your server IP address
- `SERVER_USER`: Username to connect with (e.g., `deploy`)
- `SERVER_DIR`: Application directory (e.g., `/var/www/pawaodds`)

### Step 3: Configure GitHub Actions

The workflow file should already be in your repository at `.github/workflows/deploy.yml`. If not, create it with this content:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.7.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
          
      - name: Add host to known_hosts
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -t rsa ${{ secrets.SERVER_IP }} >> ~/.ssh/known_hosts
          
      - name: Deploy to server
        env:
          SERVER_IP: ${{ secrets.SERVER_IP }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
          SERVER_DIR: ${{ secrets.SERVER_DIR }}
        run: |
          ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && git pull"
          ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && npm ci"
          ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && npm run build"
          ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && npm run db:push"
          ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && pm2 restart pawaodds || pm2 start ecosystem.config.js"
          
      - name: Verify deployment
        env:
          SERVER_IP: ${{ secrets.SERVER_IP }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
        run: |
          ssh $SERVER_USER@$SERVER_IP "pm2 status"
```

### Step 4: Initial Deployment

1. Clone your repository to the server:

```bash
# If using deploy user
su - deploy
cd /var/www/pawaodds
git clone https://github.com/yourusername/pawaodds.git .
```

2. Copy the environment file:

```bash
cp ~/pawaodds.env .env
```

3. Install dependencies and build:

```bash
npm ci
npm run build
npm run db:push
```

4. Start the application:

```bash
pm2 start ecosystem.config.js
```

### Step 5: Set Up SSL (Optional)

```bash
sudo certbot --nginx -d yourdomain.com
```

### Step 6: Push Changes to Deploy

Now, whenever you push changes to the `main` branch, GitHub Actions will automatically deploy them to your server.

## Manual Deployment

If you prefer not to use GitHub Actions, you can deploy manually:

1. Set up the server as described in Step 1 above
2. Clone your repository directly to the server
3. Set up environment variables
4. Install dependencies and build
5. Start with PM2

Use the `scripts/fast-deploy.sh` script for quick manual deployments.

## Docker Deployment

For containerized deployment:

1. SSH into your server
2. Install Docker and Docker Compose:

```bash
curl -fsSL https://get.docker.com | sudo bash
sudo apt install -y docker-compose
```

3. Clone your repository and navigate to it
4. Create a `.env` file with your environment variables
5. Build and start containers:

```bash
docker-compose up -d
```

## Environment Configuration

The application requires the following environment variables:

```
# Database configuration
DATABASE_URL=postgres://username:password@localhost:5432/dbname

# Admin key for protected routes
ADMIN_KEY=your-secure-admin-key

# Node environment
NODE_ENV=production
```

## Database Backups

Set up automatic daily backups using the provided script:

```bash
# Download the backup script
curl -O https://raw.githubusercontent.com/yourusername/pawaodds/main/scripts/backup-db.sh

# Make it executable
chmod +x backup-db.sh

# Set up a daily cron job
(crontab -l 2>/dev/null; echo "0 3 * * * /path/to/backup-db.sh") | crontab -
```

## Troubleshooting

### Application Not Starting

Check PM2 logs:

```bash
pm2 logs pawaodds
```

### Database Connection Issues

Verify your database connection:

```bash
psql -U yourdbuser -d yourdbname -c "SELECT 1;"
```

### Server Issues

Check nginx logs:

```bash
sudo tail -f /var/log/nginx/error.log
```

### Deploy Script Not Working

Make sure your GitHub secrets are correctly set and that the deploy user has appropriate permissions.

---

For additional help or to report issues, please open an issue on the GitHub repository.