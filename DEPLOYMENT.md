# Deployment Guide: pawaodds.pro to Hetzner Cloud

This guide outlines the steps to deploy the pawaodds.pro application to a Hetzner Cloud server using GitHub for version control and automated deployments.

## Prerequisites

- A Hetzner Cloud account
- A GitHub account
- A domain name (optional, but recommended for production)
- SSH access to your server

## 1. Set Up GitHub Repository

1. Create a new repository on GitHub
2. Initialize Git in your local project:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/pawaodds.git
git push -u origin main
```

## 2. Set Up Hetzner Cloud Server

1. Log in to your Hetzner Cloud account
2. Create a new server:
   - Choose Ubuntu 22.04 as the operating system
   - Select a server plan with at least 2vCPU and 4GB RAM (CPX21 recommended)
   - Add your SSH key for secure access
   - Create the server

## 3. Prepare Server Environment

Connect to your server via SSH and set up the necessary environment:

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v
npm -v

# Install Python 3 (should be pre-installed on Ubuntu 22.04)
sudo apt install -y python3 python3-pip

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Git
sudo apt install -y git

# Install PM2 process manager
sudo npm install -g pm2
```

## 4. Set Up PostgreSQL Database

```bash
# Log in to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE pawaodds;
CREATE USER pawauser WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE pawaodds TO pawauser;
\q

# Update PostgreSQL to allow password authentication
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Edit the `pg_hba.conf` file, changing `peer` to `md5` for local connections.

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql
```

## 5. Clone Repository and Install Dependencies

```bash
# Create application directory
mkdir -p /var/www/pawaodds
cd /var/www/pawaodds

# Clone your repository
git clone https://github.com/yourusername/pawaodds.git .

# Install dependencies
npm install

# Create .env file
nano .env
```

Add the following environment variables to the `.env` file:

```
DATABASE_URL=postgres://pawauser:your_strong_password@localhost:5432/pawaodds
ADMIN_KEY=your_admin_key
NODE_ENV=production
```

## 6. Build and Initialize the Database

```bash
# Push database schema
npm run db:push

# Build the client
npm run build
```

## 7. Set Up Process Manager (PM2)

Create a PM2 configuration file:

```bash
nano ecosystem.config.js
```

Add this configuration:

```javascript
module.exports = {
  apps: [
    {
      name: "pawaodds",
      script: "tsx",
      args: "server/index.ts",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      },
      watch: false,
      max_memory_restart: "1G"
    }
  ]
}
```

Start the application:

```bash
# Start the application
pm2 start ecosystem.config.js

# Set up PM2 to start on system boot
pm2 startup
pm2 save
```

## 8. Set Up Nginx as Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/pawaodds
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/pawaodds /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 9. Set Up SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up by default
```

## 10. Set Up GitHub Actions for Automated Deployment (Optional)

Create a GitHub Actions workflow file in your repository at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Deploy to Production Server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /var/www/pawaodds
          git pull
          npm install
          npm run build
          npm run db:push
          pm2 restart pawaodds
```

Add the secrets to your GitHub repository:
- `HOST`: Your server's IP address
- `USERNAME`: Your SSH username
- `SSH_KEY`: Your SSH private key

## Maintaining the Application

- **Updates**: Use GitHub for version control and updates
- **Database Backups**: Set up regular PostgreSQL backups
- **Monitoring**: Use PM2 for application monitoring
- **Logs**: Check application logs with `pm2 logs pawaodds`

## Troubleshooting

- **Application doesn't start**: Check logs with `pm2 logs pawaodds`
- **Database connection issues**: Verify DATABASE_URL in .env file
- **Web server issues**: Check Nginx logs with `sudo journalctl -u nginx`

## Security Considerations

1. Set up a firewall (UFW)
2. Regularly update server packages
3. Use strong passwords for database and ADMIN_KEY
4. Consider setting up fail2ban to protect against brute force attacks