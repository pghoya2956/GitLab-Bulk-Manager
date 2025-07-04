#!/bin/bash

# GitLab Health Check - 30초 만에 전체 상태 파악
# 즉시 실행 가능한 건강 체크 스크립트

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/common.sh"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                GitLab Health Check Report                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Generated: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. API 연결 상태
echo -e "${YELLOW}🔌 API Connection Status${NC}"
if curl -s --fail "${GITLAB_API_URL}/version" -H "Private-Token: ${GITLAB_TOKEN}" > /dev/null; then
    VERSION=$(curl -s "${GITLAB_API_URL}/version" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.version')
    echo -e "   ✅ Connected to GitLab ${GREEN}v${VERSION}${NC}"
else
    echo -e "   ❌ ${RED}Failed to connect to GitLab API${NC}"
    exit 1
fi
echo ""

# 2. 프로젝트 통계
echo -e "${YELLOW}📊 Project Statistics${NC}"
TOTAL_PROJECTS=$(curl -s "${GITLAB_API_URL}/projects?per_page=1" -H "Private-Token: ${GITLAB_TOKEN}" -I | grep -i "x-total:" | awk '{print $2}' | tr -d '\r')
RECENT_PROJECTS=$(curl -s "${GITLAB_API_URL}/projects?order_by=created_at&sort=desc&per_page=5" -H "Private-Token: ${GITLAB_TOKEN}")

echo -e "   📁 Total Projects: ${GREEN}${TOTAL_PROJECTS}${NC}"
echo -e "   🆕 Recent Projects:"
echo "$RECENT_PROJECTS" | jq -r '.[] | "      • \(.name) (created: \(.created_at | split("T")[0]))"'
echo ""

# 3. 활성 Merge Request 상태
echo -e "${YELLOW}🔀 Active Merge Requests${NC}"
OPEN_MRS=$(curl -s "${GITLAB_API_URL}/merge_requests?state=opened&scope=all" -H "Private-Token: ${GITLAB_TOKEN}")
MR_COUNT=$(echo "$OPEN_MRS" | jq 'length')

echo -e "   📝 Open MRs: ${GREEN}${MR_COUNT}${NC}"
if [ "$MR_COUNT" -gt 0 ]; then
    echo -e "   ⏳ Requiring Attention:"
    echo "$OPEN_MRS" | jq -r '.[] | select(.merge_status == "can_be_merged") | "      ✅ \(.title) - Ready to merge"' | head -3
    echo "$OPEN_MRS" | jq -r '.[] | select(.has_conflicts == true) | "      ⚠️  \(.title) - Has conflicts"' | head -3
fi
echo ""

# 4. CI/CD Pipeline 상태
echo -e "${YELLOW}🚀 CI/CD Pipeline Status${NC}"
RECENT_PIPELINES=$(curl -s "${GITLAB_API_URL}/projects/events?action=pushed&per_page=10" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.[].project_id' | sort -u | head -5)

FAILED_COUNT=0
SUCCESS_COUNT=0
RUNNING_COUNT=0

for PROJECT_ID in $RECENT_PIPELINES; do
    PIPELINE=$(curl -s "${GITLAB_API_URL}/projects/${PROJECT_ID}/pipelines?per_page=1" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.[0]')
    if [ "$PIPELINE" != "null" ]; then
        STATUS=$(echo "$PIPELINE" | jq -r '.status')
        case "$STATUS" in
            "failed") ((FAILED_COUNT++)) ;;
            "success") ((SUCCESS_COUNT++)) ;;
            "running"|"pending") ((RUNNING_COUNT++)) ;;
        esac
    fi
done

echo -e "   ✅ Successful: ${GREEN}${SUCCESS_COUNT}${NC}"
echo -e "   ❌ Failed: ${RED}${FAILED_COUNT}${NC}"
echo -e "   🔄 Running: ${YELLOW}${RUNNING_COUNT}${NC}"
echo ""

# 5. 스토리지 사용량 (그룹별)
echo -e "${YELLOW}💾 Storage Usage by Group${NC}"
GROUPS=$(curl -s "${GITLAB_API_URL}/groups?per_page=5" -H "Private-Token: ${GITLAB_TOKEN}")
echo "$GROUPS" | jq -r '.[] | "   📁 \(.full_name): \(.statistics.storage_size // 0 | . / 1048576 | floor) MB"' 2>/dev/null || echo "   ℹ️  Storage statistics not available"
echo ""

# 6. 사용자 활동
echo -e "${YELLOW}👥 User Activity (Last 24h)${NC}"
YESTERDAY=$(date -u -v-1d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '1 day ago' '+%Y-%m-%dT%H:%M:%SZ')
EVENTS=$(curl -s "${GITLAB_API_URL}/events?after=${YESTERDAY}&per_page=100" -H "Private-Token: ${GITLAB_TOKEN}")

PUSH_COUNT=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "pushed to")] | length')
MR_CREATED=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "opened" and .target_type == "MergeRequest")] | length')
ISSUE_CREATED=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "opened" and .target_type == "Issue")] | length')

echo -e "   🔨 Pushes: ${GREEN}${PUSH_COUNT}${NC}"
echo -e "   🔀 MRs Created: ${GREEN}${MR_CREATED}${NC}"
echo -e "   📋 Issues Created: ${GREEN}${ISSUE_CREATED}${NC}"
echo ""

# 7. 권장 사항
echo -e "${YELLOW}💡 Recommendations${NC}"
if [ "$FAILED_COUNT" -gt 0 ]; then
    echo -e "   ⚠️  ${RED}${FAILED_COUNT} pipeline(s) failed${NC} - Review and fix immediately"
fi
if [ "$MR_COUNT" -gt 10 ]; then
    echo -e "   ⚠️  ${YELLOW}${MR_COUNT} open MRs${NC} - Consider reviewing old MRs"
fi
if [ "$PUSH_COUNT" -eq 0 ]; then
    echo -e "   ℹ️  No pushes in last 24h - Check team activity"
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "💡 Run './gitlab-daily-digest.sh' for detailed daily report"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"