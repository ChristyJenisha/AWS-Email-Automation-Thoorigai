#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# EC2 Server Initialization Script (Ubuntu 24.04 / Amazon Linux 2023)
# ==============================================================================

echo "==> Updating package indices..."
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg git ufw
  
  # Install Docker
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  
  echo \
    "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  
  # Setup basic UFW firewall
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf update -y
  sudo dnf install -y docker git
  sudo systemctl enable --now docker
  
  # Install Docker Compose plugin
  DOCKER_CONFIG=${DOCKER_CONFIG:-/usr/local/lib/docker}
  sudo mkdir -p $DOCKER_CONFIG/cli-plugins
  sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) -o $DOCKER_CONFIG/cli-plugins/docker-compose
  sudo chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose
fi

# Add current user to docker group
sudo usermod -aG docker "$USER"

echo "==> Docker and Docker Compose installed successfully."
echo "==> Please log out and back in to refresh group permissions, then clone your repository."
