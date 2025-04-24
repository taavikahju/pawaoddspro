#!/bin/bash
# Security hardening script for pawaodds.pro production server
# Run this script after initial server setup to enhance security

set -e  # Exit on any error

echo "===================================================="
echo "Running security hardening script"
echo "Started at: $(date)"
echo "===================================================="

# Update and upgrade packages
echo "[1/10] Updating and upgrading packages..."
sudo apt update
sudo apt upgrade -y

# Install security packages
echo "[2/10] Installing security packages..."
sudo apt install -y fail2ban ufw unattended-upgrades apt-listchanges apticron

# Set up automatic security updates
echo "[3/10] Setting up automatic security updates..."
sudo dpkg-reconfigure -plow unattended-upgrades

# Configure SSH
echo "[4/10] Hardening SSH configuration..."
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo tee -a /etc/ssh/sshd_config > /dev/null << EOF

# Added security settings
PermitRootLogin no
PasswordAuthentication no
X11Forwarding no
MaxAuthTries 5
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Restart SSH service (be careful - make sure you have SSH key access)
sudo systemctl restart sshd

# Configure firewall
echo "[5/10] Setting up firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
# Only enable if it's not already enabled
sudo ufw status | grep -q "Status: active" || sudo ufw --force enable

# Set up fail2ban
echo "[6/10] Configuring fail2ban..."
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo tee /etc/fail2ban/jail.d/custom.conf > /dev/null << EOF
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

sudo systemctl restart fail2ban

# Secure shared memory
echo "[7/10] Securing shared memory..."
if ! grep -q '/run/shm' /etc/fstab; then
    sudo tee -a /etc/fstab > /dev/null << EOF
# Secure shared memory
tmpfs     /run/shm     tmpfs     defaults,noexec,nosuid     0     0
EOF
fi

# Disable unnecessary services
echo "[8/10] Disabling unnecessary services..."
UNUSED_SERVICES="avahi-daemon cups bluetooth"
for service in $UNUSED_SERVICES; do
    if systemctl list-unit-files | grep -q $service; then
        sudo systemctl stop $service
        sudo systemctl disable $service
        echo "Disabled $service"
    else
        echo "$service not found, skipping"
    fi
done

# Set up log monitoring (optional)
echo "[9/10] Setting up log monitoring..."
sudo apt install -y logwatch
sudo tee /etc/cron.daily/00logwatch > /dev/null << EOF
#!/bin/bash
/usr/sbin/logwatch --output mail --mailto root --detail high
EOF
sudo chmod +x /etc/cron.daily/00logwatch

# Set up basic intrusion detection (optional)
echo "[10/10] Setting up basic intrusion detection..."
sudo apt install -y rkhunter
sudo rkhunter --update
sudo rkhunter --propupd
# Set up daily checks
cat > /etc/cron.daily/rkhunter-check << EOF
#!/bin/bash
/usr/bin/rkhunter --check --skip-keypress --report-warnings-only
EOF
chmod +x /etc/cron.daily/rkhunter-check

# Display summary
echo "===================================================="
echo "Security hardening completed at $(date)"
echo "The following measures have been implemented:"
echo "1. System packages updated"
echo "2. Security packages installed (fail2ban, firewall)"
echo "3. Automatic security updates configured"
echo "4. SSH hardened (root login disabled, password auth disabled)"
echo "5. Firewall configured (only SSH, HTTP, HTTPS allowed)"
echo "6. Fail2ban configured to protect against brute force"
echo "7. Shared memory secured"
echo "8. Unnecessary services disabled"
echo "9. Log monitoring set up"
echo "10. Basic intrusion detection installed"
echo ""
echo "IMPORTANT: Make sure you still have SSH access before closing this session!"
echo "===================================================="