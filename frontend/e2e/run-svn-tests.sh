#!/bin/bash

# SVN Migration Tests Runner
# This script runs the Playwright tests for SVN to GitLab migration feature

set -e

echo "🧪 Starting SVN Migration E2E Tests..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found. Creating from template..."
    cp .env.test .env.local
    echo "📝 Please edit .env.local with your GitLab PAT before running tests"
    exit 1
fi

# Load environment variables
export $(cat .env.local | grep -v '^#' | xargs)

# Check if PAT is set
if [ "$GITLAB_PAT" = "your-personal-access-token" ] || [ -z "$GITLAB_PAT" ]; then
    echo "❌ Please set GITLAB_PAT in .env.local before running tests"
    exit 1
fi

# Ensure SVN repos exist
if [ ! -d "../../sample/svn-repos" ]; then
    echo "📁 Creating SVN test repositories..."
    cd ../../sample
    ./svn-setup.sh
    cd ../frontend/e2e
fi

# Install dependencies if needed
if [ ! -d "../../node_modules/@playwright" ]; then
    echo "📦 Installing Playwright..."
    cd ../..
    npm install
    npx playwright install
    cd frontend/e2e
fi

# Run specific SVN migration tests
echo "🚀 Running SVN migration tests..."

# Run tests with custom config
npx playwright test tests/12-svn-migration.spec.ts \
    --config=playwright.config.ts \
    --reporter=list \
    --workers=1 \
    ${HEADLESS:+--headed} \
    ${DEBUG:+--debug}

echo "✅ SVN Migration tests completed!"

# Generate report if tests passed
if [ $? -eq 0 ]; then
    echo "📊 Generating test report..."
    npx playwright show-report
fi