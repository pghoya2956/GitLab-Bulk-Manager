#!/bin/bash

# GitLab Instant Value Suite - Quick Installer
# 5분 안에 모든 스크립트 설정 완료

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 GitLab Instant Value Suite Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 실행 권한 부여
echo "📝 Setting executable permissions..."
chmod +x "$SCRIPT_DIR"/*.sh
echo "   ✅ Done"
echo ""

# 2. 환경 설정 확인
echo "🔧 Checking configuration..."
CONFIG_FILE="$SCRIPT_DIR/../config/gitlab.env"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "   ⚠️  Configuration file not found"
    echo "   Creating from example..."
    
    if [ -f "$SCRIPT_DIR/../config/gitlab.env.example" ]; then
        cp "$SCRIPT_DIR/../config/gitlab.env.example" "$CONFIG_FILE"
        echo "   ✅ Created $CONFIG_FILE"
        echo ""
        echo "   ⚠️  IMPORTANT: Edit $CONFIG_FILE with your GitLab credentials"
        echo "   Required variables:"
        echo "     - GITLAB_URL"
        echo "     - GITLAB_TOKEN"
        echo ""
        echo "   Press Enter after editing the config file..."
        read
    fi
else
    echo "   ✅ Configuration file exists"
fi

# 3. 의존성 확인
echo ""
echo "🔍 Checking dependencies..."
MISSING_DEPS=0

# jq 확인
if ! command -v jq &> /dev/null; then
    echo "   ❌ jq is not installed"
    echo "      Install: brew install jq (macOS) or apt-get install jq (Linux)"
    ((MISSING_DEPS++))
else
    echo "   ✅ jq found"
fi

# curl 확인
if ! command -v curl &> /dev/null; then
    echo "   ❌ curl is not installed"
    ((MISSING_DEPS++))
else
    echo "   ✅ curl found"
fi

# bc 확인 (cost analyzer용)
if ! command -v bc &> /dev/null; then
    echo "   ⚠️  bc is not installed (required for cost analysis)"
    echo "      Install: brew install bc (macOS) or apt-get install bc (Linux)"
else
    echo "   ✅ bc found"
fi

if [ "$MISSING_DEPS" -gt 0 ]; then
    echo ""
    echo "   ⚠️  Please install missing dependencies before continuing"
    exit 1
fi

# 4. 첫 실행 테스트
echo ""
echo "🧪 Testing connection..."
source "$CONFIG_FILE"

if curl -s --fail "${GITLAB_API_URL}/version" -H "Private-Token: ${GITLAB_TOKEN}" > /dev/null; then
    VERSION=$(curl -s "${GITLAB_API_URL}/version" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.version')
    echo "   ✅ Successfully connected to GitLab v${VERSION}"
else
    echo "   ❌ Failed to connect to GitLab"
    echo "   Please check your configuration in $CONFIG_FILE"
    exit 1
fi

# 5. 첫 번째 건강 체크 실행
echo ""
echo "🏃 Running first health check..."
echo ""
"$SCRIPT_DIR/gitlab-health-check.sh"

# 6. 선택적 cron 설정
echo ""
echo "⏰ Would you like to set up daily digest emails? (y/n)"
read -r SETUP_CRON

if [ "$SETUP_CRON" = "y" ] || [ "$SETUP_CRON" = "Y" ]; then
    echo "   Enter email address for daily digests:"
    read -r EMAIL_ADDRESS
    
    CRON_CMD="0 9 * * * $SCRIPT_DIR/gitlab-daily-digest.sh --email $EMAIL_ADDRESS"
    
    # 현재 crontab 확인
    if crontab -l 2>/dev/null | grep -q "gitlab-daily-digest.sh"; then
        echo "   ℹ️  Daily digest cron job already exists"
    else
        # cron job 추가
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo "   ✅ Daily digest scheduled for 9:00 AM"
    fi
fi

# 7. 완료
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Installation Complete!"
echo ""
echo "🎯 Quick Start Commands:"
echo "   ./gitlab-health-check.sh      - Check GitLab status (30 seconds)"
echo "   ./gitlab-merge-assistant.sh   - Analyze open merge requests"
echo "   ./gitlab-cost-analyzer.sh     - View cost breakdown"
echo "   ./gitlab-quick-clone.sh -h    - Smart project cloning"
echo "   ./gitlab-daily-digest.sh      - Generate daily report"
echo ""
echo "💡 Next Steps:"
echo "   1. Run health check regularly to monitor GitLab"
echo "   2. Use merge assistant before daily standup"
echo "   3. Run cost analyzer monthly for budget planning"
echo ""
echo "📚 Documentation: README.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"