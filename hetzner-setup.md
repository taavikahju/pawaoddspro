# Hetzner Cloud Deployment Guide

This guide provides step-by-step instructions for deploying to Hetzner Cloud and setting up GitHub Actions for continuous deployment.

## 1. Set Up Hetzner Cloud Server

### Create a Hetzner Cloud Account

1. If you don't have an account, sign up at [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. Create a new project for your application

### Generate SSH Keys (if you don't already have them)

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

### Create Server

1. In the Hetzner Cloud Console, click "Add Server"
2. Choose a location close to your target audience
3. Select "Ubuntu 22.04" as the OS
4. Choose a server type (recommended: CPX21 with 4GB RAM, 2 vCPUs)
5. Add your SSH key
6. Give your server a name (e.g., "pawaodds-production")
7. Click "Create & Buy Now"

### Connect to Your Server

```bash
ssh root@your-server-ip
```

## 2. Initial Server Setup

### Create a New User with Administrative Privileges

```bash
# Add new user
adduser deploy
# Add user to sudo group
usermod -aG sudo deploy

# Set up SSH key for the new user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### Switch to New User

```bash
su - deploy
```

### Set Up Basic Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
```

## 3. GitHub Repository Setup

### Create a Repository on GitHub

1. Go to [GitHub](https://github.com) and create a new repository
2. Push your local code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/pawaodds.git
git push -u origin main
```

### Set Up GitHub Actions Secrets

1. In your GitHub repository, go to Settings > Secrets > Actions
2. Add the following secrets:
   - `HOST`: Your server's IP address (e.g., `123.123.123.123`)
   - `USERNAME`: Your deployment user (e.g., `deploy`)
   - `SSH_KEY`: Your private SSH key (the content of your `~/.ssh/id_rsa` file)

## 4. Run Server Setup Script

You have two options for setting up the server:

### Option 1: Automatic Setup

1. Upload the setup script to your server:
   ```bash
   scp scripts/setup-server.sh deploy@your-server-ip:~/
   ```

2. Make it executable and run it:
   ```bash
   ssh deploy@your-server-ip
   chmod +x setup-server.sh
   ./setup-server.sh
   ```

### Option 2: Manual Setup

Follow the steps in `DEPLOYMENT.md` to manually set up your server environment.

## 5. Database Configuration

### Set Up Database Backup

Create a script to backup your PostgreSQL database:

```bash
mkdir -p /home/deploy/backups

# Create backup script
cat > /home/deploy/backup-db.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/home/deploy/backups"
BACKUP_FILE="$BACKUP_DIR/pawaodds_$TIMESTAMP.sql"
DATABASE="pawaodds"
USER="pawauser"

pg_dump -U $USER $DATABASE > $BACKUP_FILE
gzip $BACKUP_FILE

# Delete backups older than 7 days
find $BACKUP_DIR -name "pawaodds_*.sql.gz" -type f -mtime +7 -delete
EOF

# Make it executable
chmod +x /home/deploy/backup-db.sh

# Set up cron job for daily backup
(crontab -l 2>/dev/null; echo "0 2 * * * /home/deploy/backup-db.sh") | crontab -
```

## 6. SSL Certificate Setup

Set up SSL with Let's Encrypt:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 7. Monitoring Setup

### Set Up Basic System Monitoring

```bash
# Install Node Exporter for Prometheus (optional)
wget https://github.com/prometheus/node_exporter/releases/download/v1.3.1/node_exporter-1.3.1.linux-amd64.tar.gz
tar xvfz node_exporter-1.3.1.linux-amd64.tar.gz
sudo cp node_exporter-1.3.1.linux-amd64/node_exporter /usr/local/bin/
sudo useradd -rs /bin/false node_exporter

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service > /dev/null << 'EOF'
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

# Start and enable the service
sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter
```

### Set Up Application Monitoring with PM2

PM2 already includes basic monitoring capabilities through the `pm2 monit` command. Additionally, you can set up web-based monitoring:

```bash
# Install PM2 monitoring dashboard
pm2 install pm2-server-monit
pm2 install pm2-logrotate
pm2 save
```

## 8. Continuous Deployment with GitHub Actions

Your GitHub Actions workflow is already set up in `.github/workflows/deploy.yml`. This will automatically deploy changes pushed to your main branch.

### Testing the Deployment

1. Make a small change to your codebase
2. Commit and push to GitHub
3. Go to your GitHub repository > Actions tab to see the workflow in progress
4. Once completed, verify the change on your live site

## 9. Maintaining Your Server

### Regular Updates

Keep your server updated:

```bash
sudo apt update
sudo apt upgrade -y
```

### Regular Backups

In addition to database backups, consider backing up your application code:

```bash
# Create app backup script
cat > /home/deploy/backup-app.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/home/deploy/backups"
BACKUP_FILE="$BACKUP_DIR/app_$TIMESTAMP.tar.gz"
APP_DIR="/var/www/pawaodds"

tar -czf $BACKUP_FILE -C $APP_DIR .

# Delete backups older than 7 days
find $BACKUP_DIR -name "app_*.tar.gz" -type f -mtime +7 -delete
EOF

# Make it executable
chmod +x /home/deploy/backup-app.sh

# Set up cron job for weekly backup
(crontab -l 2>/dev/null; echo "0 3 * * 0 /home/deploy/backup-app.sh") | crontab -
```

## 10. Rollback Procedure

If a deployment fails, you can roll back to a previous version:

```bash
# SSH into your server
ssh deploy@your-server-ip

# Navigate to the application directory
cd /var/www/pawaodds

# Check git logs to find a commit to roll back to
git log --oneline -n 10

# Roll back to a specific commit
git reset --hard <commit-hash>

# Rebuild the application
npm install
npm run build

# Restart the application
pm2 restart pawaodds
```

## 11. Troubleshooting

### Check Application Logs

```bash
pm2 logs pawaodds
```

### Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Database Issues

```bash
sudo -u pawauser psql -d pawaodds
# Then run database queries to diagnose issues
```

### Process Management

```bash
pm2 list
pm2 monit
```

## 12. Additional Security Measures

### Set Up Fail2Ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Configure Nginx Security Headers

Edit your Nginx configuration to add additional security headers:

```bash
sudo nano /etc/nginx/sites-available/pawaodds
```

Add the following inside the server block:

```nginx
# Security headers
add_header X-Content-Type-Options nosniff;
add_header X-Frame-Options SAMEORIGIN;
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:;";
add_header Referrer-Policy no-referrer-when-downgrade;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
```

### Regular Security Audits

Consider running regular security audits using tools like:

```bash
# Install Lynis
sudo apt install -y lynis

# Run security audit
sudo lynis audit system
```