# Installation Guide

This guide will help you install and set up the GitLab Bulk Manager on your system.

## System Requirements

### Minimum Requirements
- **Node.js**: v16.0.0 or higher
- **npm**: v7.0.0 or higher
- **Memory**: 2GB RAM minimum
- **Storage**: 500MB available space
- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)

### Recommended Requirements
- **Node.js**: v18.0.0 or higher (LTS)
- **npm**: v8.0.0 or higher
- **Memory**: 4GB RAM or more
- **Storage**: 1GB available space
- **OS**: Latest stable version of your operating system

## Prerequisites

### 1. Node.js Installation

#### Windows
Download and install Node.js from [nodejs.org](https://nodejs.org/). Choose the LTS version.

#### macOS
Using Homebrew:
```bash
brew install node
```

Or download from [nodejs.org](https://nodejs.org/).

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Verify Installation
```bash
node --version  # Should show v16.0.0 or higher
npm --version   # Should show v7.0.0 or higher
```

### 3. Git Installation
Ensure Git is installed for cloning the repository:
```bash
git --version
```

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/gitlab-bulk-manager.git
cd gitlab-bulk-manager
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 4. Environment Configuration

#### Backend Configuration
```bash
cd ../backend
cp .env.example .env
```

Edit `.env` with your settings:
```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Session Configuration
SESSION_SECRET=your-secure-session-secret-here

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Configuration
The frontend configuration is handled through environment variables during build time. For development, the default settings work out of the box.

### 5. GitLab Personal Access Token

You'll need a GitLab Personal Access Token (PAT) with the following scopes:
- `api` - Full API access
- `read_api` - Read access to the API
- `read_repository` - Read access to repositories
- `write_repository` - Write access to repositories

To create a token:
1. Go to GitLab → Settings → Access Tokens
2. Create a new token with the required scopes
3. Save the token securely (you'll enter it during login)

## Quick Verification

### 1. Start the Backend Server
```bash
cd backend
npm run dev
```
You should see:
```
Server running on port 4000
Session middleware configured
CORS enabled for http://localhost:3000
```

### 2. Start the Frontend Development Server
In a new terminal:
```bash
cd frontend
npm run dev
```
You should see:
```
VITE ready in X ms
➜ Local: http://localhost:3000/
```

### 3. Access the Application
Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Troubleshooting Installation

### Common Issues

#### Port Already in Use
If you see "Error: listen EADDRINUSE :::4000":
```bash
# Find process using port 4000
lsof -i :4000  # macOS/Linux
netstat -ano | findstr :4000  # Windows

# Kill the process or change the port in .env
```

#### Node Version Issues
If you encounter compatibility issues:
```bash
# Use nvm to manage Node versions
nvm install 18
nvm use 18
```

#### Permission Errors
On Linux/macOS, if you get permission errors:
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### Dependencies Installation Fails
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

Once installation is complete:
1. Read the [Configuration Guide](./configuration.md) for detailed setup options
2. Follow the [Quick Start Tutorial](./quick-start.md) to create your first bulk operation
3. Review the [Architecture Overview](../architecture/overview.md) to understand the system

## Getting Help

If you encounter issues:
1. Check the [Troubleshooting Guide](../maintenance/troubleshooting.md)
2. Search existing [GitHub Issues](https://github.com/your-org/gitlab-bulk-manager/issues)
3. Create a new issue with detailed information about your problem