#!/bin/bash

# GitLab Bulk Manager Setup Script
# This script helps set up the development environment

set -e

echo "🚀 GitLab Bulk Manager Setup"
echo "=========================="
echo ""

# Check Node.js version
echo "📋 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18.0.0 or higher is required"
    echo "   Current version: $(node -v)"
    echo "   Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check npm version
echo "📋 Checking npm version..."
NPM_VERSION=$(npm -v | cut -d'.' -f1)
if [ "$NPM_VERSION" -lt 9 ]; then
    echo "❌ Error: npm 9.0.0 or higher is required"
    echo "   Current version: $(npm -v)"
    echo "   Please update npm: npm install -g npm@latest"
    exit 1
fi
echo "✅ npm version: $(npm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup environment files
echo ""
echo "⚙️  Setting up environment files..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env file"
    echo "⚠️  Please edit backend/.env and add your GitLab personal access token"
else
    echo "✅ backend/.env already exists"
fi

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p docs/images
echo "✅ Directories created"

# Make scripts executable
echo ""
echo "🔧 Making scripts executable..."
chmod +x manage.sh
chmod +x setup.sh
echo "✅ Scripts are now executable"

# Final instructions
echo ""
echo "✨ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit backend/.env and add your GitLab personal access token"
echo "2. Run './manage.sh start' to start the application"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "📚 Documentation:"
echo "- README.md - General information"
echo "- CONTRIBUTING.md - Contribution guidelines"
echo "- frontend/docs/ - Detailed documentation"
echo ""
echo "Happy coding! 🎉"