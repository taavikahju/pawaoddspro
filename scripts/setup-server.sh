#!/bin/bash
# Server setup script for pawaodds.pro
# Run on a fresh Ubuntu 22.04 server to set up the environment

set -e  # Exit on any error

# Configuration - EDIT THESE VALUES
APP_NAME="pawaodds"
DOMAIN="pawaodds.pro"
DB_NAME="pawaodds"
DB_USER="pawauser"
DB_PASSWORD="your_secure_password_here"
ADMIN_KEY="your_secure_admin_key_here"
GIT_REPO="https://github.com/yourusername/pawaodds.git"
APP_DIR="/var/www/pawaodds"

# Print banner
echo "===================================================="
echo "Setting up server for ${APP_NAME}"
echo "Running on $(date)"
echo "===================================================="

# Update system packages
echo "[1/10] Updating system packages..."
sudo apt update
sudo apt upgrade -y

# Install dependencies
echo "[2/10] Installing dependencies..."
sudo apt install -y curl git nginx software-properties-common python3 python3-pip ufw

# Install Node.js 20.x
echo "[3/10] Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v

# Install PM2
echo "[4/10] Installing PM2..."
sudo npm install -g pm2 tsx

# Install PostgreSQL
echo "[5/10] Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Configure PostgreSQL
echo "[6/10] Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};"
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH SUPERUSER;"

# Set up application directory
echo "[7/10] Setting up application directory..."
sudo mkdir -p ${APP_DIR}
sudo chown $(whoami):$(whoami) ${APP_DIR}
cd ${APP_DIR}

# Clone the repository
echo "[8/10] Cloning repository..."
git clone ${GIT_REPO} .

# Install application dependencies
echo "[9/10] Installing application dependencies..."
npm install

# Create .env file
echo "[10/10] Creating environment file..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
ADMIN_KEY=${ADMIN_KEY}
SESSION_SECRET=$(openssl rand -hex 32)
TZ=UTC
EOF

# Build the application
echo "[11/16] Building application..."
npm run build

# Initialize database
echo "[12/16] Initializing database..."
npm run db:push

# Set up PM2
echo "[13/16] Setting up PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))

# Set up Nginx
echo "[14/16] Setting up Nginx..."
sudo cp ${APP_DIR}/nginx.conf /etc/nginx/sites-available/${APP_NAME}
sudo sed -i "s/pawaodds.pro/${DOMAIN}/g" /etc/nginx/sites-available/${APP_NAME}
sudo ln -s /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configure firewall
echo "[15/16] Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

# Print completion message
echo "[16/16] Setup complete!"
echo "===================================================="
echo "Server setup for ${APP_NAME} is complete!"
echo "The application is now running at: http://${DOMAIN}"
echo ""
echo "Next steps:"
echo "1. Set up an SSL certificate with Let's Encrypt:"
echo "   sudo apt install certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
echo "2. Check application logs:"
echo "   pm2 logs ${APP_NAME}"
echo ""
echo "3. Add DNS records for your domain to point to this server's IP:"
echo "   Server IP: $(hostname -I | awk '{print $1}')"
echo "===================================================="