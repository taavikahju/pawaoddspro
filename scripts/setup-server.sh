#!/bin/bash
# Server setup script for pawaodds.pro
# Run this script on a fresh Ubuntu server to set up the environment

set -e  # Exit on any error

echo "===================================================="
echo "Setting up server for pawaodds.pro"
echo "Started at: $(date)"
echo "===================================================="

# Update system packages
echo "[1/7] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "[2/7] Installing required packages..."
sudo apt install -y curl git nginx certbot python3-certbot-nginx postgresql postgresql-contrib build-essential python3 python3-pip

# Install Node.js
echo "[3/7] Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

# Install PM2 globally
echo "[4/7] Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "[5/7] Setting up application directory..."
APP_DIR="/var/www/pawaodds"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Create deploy user (optional)
echo "[6/7] Setting up deploy user..."
read -p "Do you want to create a dedicated deploy user? (y/n): " CREATE_DEPLOY_USER
if [[ "$CREATE_DEPLOY_USER" == "y" ]]; then
  sudo adduser deploy --gecos "Deploy User,,,," --disabled-password
  sudo usermod -aG sudo deploy
  sudo mkdir -p /home/deploy/.ssh
  
  # Set up SSH key authentication for deploy user
  read -p "Enter your public SSH key for the deploy user: " SSH_KEY
  echo $SSH_KEY | sudo tee -a /home/deploy/.ssh/authorized_keys
  
  sudo chown -R deploy:deploy /home/deploy/.ssh
  sudo chmod 700 /home/deploy/.ssh
  sudo chmod 600 /home/deploy/.ssh/authorized_keys
  
  # Give deploy user access to application directory
  sudo chown -R deploy:deploy $APP_DIR
  
  echo "Deploy user created successfully."
fi

# Set up PostgreSQL database
echo "[7/7] Setting up PostgreSQL database..."
DB_NAME="pawaodds"
DB_USER="pawauser"

# Generate a random password
DB_PASSWORD=$(openssl rand -base64 32)

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Configure PostgreSQL for remote access if needed
# sudo -u postgres cp /etc/postgresql/*/main/postgresql.conf /etc/postgresql/*/main/postgresql.conf.bak
# sudo -u postgres sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
# sudo -u postgres cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.bak
# echo "host    all             all             0.0.0.0/0               md5" | sudo -u postgres tee -a /etc/postgresql/*/main/pg_hba.conf
# sudo systemctl restart postgresql

# Generate .env file
echo "Creating .env file..."
if [[ "$CREATE_DEPLOY_USER" == "y" ]]; then
  ENV_PATH="/home/deploy/pawaodds.env"
  sudo touch $ENV_PATH
  sudo chown deploy:deploy $ENV_PATH
else
  ENV_PATH="$APP_DIR/.env"
  touch $ENV_PATH
fi

# Generate a secure admin key
ADMIN_KEY=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

cat > $ENV_PATH << EOF
# Database configuration
DATABASE_URL=postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Admin key for protected routes
ADMIN_KEY=$ADMIN_KEY

# Node environment
NODE_ENV=production
EOF

echo "Environment file created at $ENV_PATH"

# Set up basic Nginx configuration
echo "Setting up Nginx configuration..."
sudo tee /etc/nginx/sites-available/pawaodds << EOF
server {
    listen 80;
    server_name _;  # Replace with your domain when ready

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/pawaodds /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# Print summary
echo "===================================================="
echo "Server setup completed at $(date)"
echo "Here's what was set up:"
echo "- System packages updated"
echo "- Node.js $(node -v) installed"
echo "- PM2 installed"
echo "- PostgreSQL installed"
echo "- Database '$DB_NAME' created"
echo "- Database user '$DB_USER' created"
echo "- Nginx configured"
if [[ "$CREATE_DEPLOY_USER" == "y" ]]; then
  echo "- Deploy user created"
fi
echo ""
echo "IMPORTANT INFORMATION (SAVE THIS):"
echo "- Database URL: postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo "- Admin Key: $ADMIN_KEY"
echo ""
echo "Next steps:"
echo "1. If you're using GitHub Actions for deployment:"
echo "   - Add these secrets to your GitHub repository:"
echo "     SSH_PRIVATE_KEY: Your SSH private key"
echo "     SERVER_IP: Your server IP address"
echo "     SERVER_USER: ${CREATE_DEPLOY_USER:+deploy:$USER}"
echo "     SERVER_DIR: $APP_DIR"
echo ""
echo "2. If you're doing manual deployment:"
echo "   - Clone your repository to $APP_DIR"
echo "   - Copy the environment file to $APP_DIR/.env"
echo "   - Run: cd $APP_DIR && npm ci && npm run build && npm run db:push"
echo "   - Start the application: pm2 start ecosystem.config.js"
echo "===================================================="

# Save the summary to a file for reference
if [[ "$CREATE_DEPLOY_USER" == "y" ]]; then
  SUMMARY_PATH="/home/deploy/setup-summary.txt"
  sudo touch $SUMMARY_PATH
  sudo chown deploy:deploy $SUMMARY_PATH
else
  SUMMARY_PATH="$HOME/setup-summary.txt"
  touch $SUMMARY_PATH
fi

cat > $SUMMARY_PATH << EOF
==================================================
PAWAODDS.PRO SERVER SETUP SUMMARY
Setup completed at $(date)
==================================================

IMPORTANT CREDENTIALS (KEEP SECURE):
- Database URL: postgres://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
- Admin Key: $ADMIN_KEY

GITHUB SECRETS FOR DEPLOYMENT:
- SSH_PRIVATE_KEY: Your SSH private key
- SERVER_IP: $(curl -s icanhazip.com)
- SERVER_USER: ${CREATE_DEPLOY_USER:+deploy:$USER}
- SERVER_DIR: $APP_DIR

MANUAL DEPLOYMENT COMMANDS:
cd $APP_DIR
git clone <your-repo-url> .
cp $ENV_PATH $APP_DIR/.env
npm ci
npm run build
npm run db:push
pm2 start ecosystem.config.js
EOF

echo "Setup summary saved to $SUMMARY_PATH"