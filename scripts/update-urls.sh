#!/bin/bash

# Script to update repository URLs throughout the project
# Usage: ./scripts/update-urls.sh YOUR_GITHUB_USERNAME

if [ $# -eq 0 ]; then
    echo "❌ Error: Please provide your GitHub username"
    echo "Usage: $0 YOUR_GITHUB_USERNAME"
    exit 1
fi

GITHUB_USERNAME=$1
OLD_URL="yourusername"
NEW_URL="$GITHUB_USERNAME"

echo "🔄 Updating repository URLs from '$OLD_URL' to '$NEW_URL'..."

# Files to update
FILES=(
    "package.json"
    "backend/package.json"
    "frontend/package.json"
    "README.md"
    "SECURITY.md"
    "CHANGELOG.md"
    ".github/dependabot.yml"
)

# Update each file
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "📝 Updating $file..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/$OLD_URL/$NEW_URL/g" "$file"
        else
            # Linux
            sed -i "s/$OLD_URL/$NEW_URL/g" "$file"
        fi
    else
        echo "⚠️  Warning: $file not found, skipping..."
    fi
done

echo "✅ Repository URLs updated successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Review the changes: git diff"
echo "2. Commit the changes: git commit -am 'chore: update repository URLs'"
echo "3. Create repository on GitHub: https://github.com/new"
echo "4. Push to GitHub: git push origin main"