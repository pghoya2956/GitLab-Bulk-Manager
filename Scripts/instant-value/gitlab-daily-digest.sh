#!/bin/bash

# GitLab Daily Digest - 매일 아침 받는 요약 리포트
# 어제 일어난 모든 중요한 일을 한눈에 파악

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/common.sh"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# 날짜 계산
YESTERDAY=$(date -u -v-1d '+%Y-%m-%dT00:00:00Z' 2>/dev/null || date -u -d '1 day ago' '+%Y-%m-%dT00:00:00Z')
TODAY=$(date -u '+%Y-%m-%dT00:00:00Z')
REPORT_DATE=$(date '+%Y-%m-%d')

# 이메일 옵션
SEND_EMAIL=false
EMAIL_TO=""

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--email)
            SEND_EMAIL=true
            EMAIL_TO="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# HTML 리포트 시작
HTML_REPORT="/tmp/gitlab-daily-digest-${REPORT_DATE}.html"
cat > "$HTML_REPORT" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GitLab Daily Digest</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; }
        .section-title { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #667eea; }
        .stat-label { color: #666; margin-top: 5px; }
        .item { background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 5px; border-left: 4px solid #667eea; }
        .success { border-left-color: #28a745; }
        .warning { border-left-color: #ffc107; }
        .danger { border-left-color: #dc3545; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0;">GitLab Daily Digest</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">
EOF

echo "            $(date '+%A, %B %d, %Y')" >> "$HTML_REPORT"
echo "            </p>" >> "$HTML_REPORT"
echo "        </div>" >> "$HTML_REPORT"
echo "        <div class=\"content\">" >> "$HTML_REPORT"

# 터미널 출력 시작
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                   GitLab Daily Digest                        ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 ${REPORT_DATE} Summary"
echo ""

# 1. 어제의 활동 요약
echo -e "${YELLOW}📊 Yesterday's Activity Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 이벤트 수집
EVENTS=$(curl -s "${GITLAB_API_URL}/events?after=${YESTERDAY}&before=${TODAY}&per_page=300" -H "Private-Token: ${GITLAB_TOKEN}")

# 통계 계산
TOTAL_COMMITS=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "pushed to")] | length')
TOTAL_MRS_OPENED=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "opened" and .target_type == "MergeRequest")] | length')
TOTAL_MRS_MERGED=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "accepted")] | length')
TOTAL_ISSUES_CREATED=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "opened" and .target_type == "Issue")] | length')
TOTAL_ISSUES_CLOSED=$(echo "$EVENTS" | jq '[.[] | select(.action_name == "closed" and .target_type == "Issue")] | length')
ACTIVE_USERS=$(echo "$EVENTS" | jq -r '.[] | .author.username' | sort -u | wc -l)
ACTIVE_PROJECTS=$(echo "$EVENTS" | jq -r '.[] | select(.project_id != null) | .project_id' | sort -u | wc -l)

# HTML 통계 섹션
cat >> "$HTML_REPORT" << EOF
<div class="section">
    <h2 class="section-title">📊 Activity Overview</h2>
    <div class="stat-grid">
        <div class="stat-card">
            <div class="stat-number">$TOTAL_COMMITS</div>
            <div class="stat-label">Commits</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$TOTAL_MRS_MERGED</div>
            <div class="stat-label">MRs Merged</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$ACTIVE_USERS</div>
            <div class="stat-label">Active Users</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$ACTIVE_PROJECTS</div>
            <div class="stat-label">Active Projects</div>
        </div>
    </div>
</div>
EOF

# 터미널 통계
echo -e "   💻 Commits: ${GREEN}${TOTAL_COMMITS}${NC}"
echo -e "   🔀 MRs Opened: ${GREEN}${TOTAL_MRS_OPENED}${NC} | Merged: ${GREEN}${TOTAL_MRS_MERGED}${NC}"
echo -e "   📋 Issues Created: ${GREEN}${TOTAL_ISSUES_CREATED}${NC} | Closed: ${GREEN}${TOTAL_ISSUES_CLOSED}${NC}"
echo -e "   👥 Active Users: ${GREEN}${ACTIVE_USERS}${NC}"
echo -e "   📁 Active Projects: ${GREEN}${ACTIVE_PROJECTS}${NC}"
echo ""

# 2. Top Contributors
echo -e "${YELLOW}🏆 Top Contributors${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "<div class=\"section\"><h2 class=\"section-title\">🏆 Top Contributors</h2>" >> "$HTML_REPORT"

TOP_CONTRIBUTORS=$(echo "$EVENTS" | jq -r '.[] | select(.action_name == "pushed to") | .author.username' | sort | uniq -c | sort -rn | head -5)
RANK=1
echo "$TOP_CONTRIBUTORS" | while read -r count username; do
    echo -e "   ${RANK}. ${CYAN}@${username}${NC} - ${count} commits"
    echo "<div class=\"item\">$RANK. <strong>@$username</strong> - $count commits</div>" >> "$HTML_REPORT"
    ((RANK++))
done
echo "</div>" >> "$HTML_REPORT"
echo ""

# 3. CI/CD 상태
echo -e "${YELLOW}🚀 CI/CD Pipeline Status${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "<div class=\"section\"><h2 class=\"section-title\">🚀 CI/CD Status</h2>" >> "$HTML_REPORT"

# 어제의 파이프라인 통계
PIPELINES_YESTERDAY=$(curl -s "${GITLAB_API_URL}/pipelines?updated_after=${YESTERDAY}&updated_before=${TODAY}&per_page=100" -H "Private-Token: ${GITLAB_TOKEN}")
PIPELINE_SUCCESS=$(echo "$PIPELINES_YESTERDAY" | jq '[.[] | select(.status == "success")] | length' 2>/dev/null || echo "0")
PIPELINE_FAILED=$(echo "$PIPELINES_YESTERDAY" | jq '[.[] | select(.status == "failed")] | length' 2>/dev/null || echo "0")
PIPELINE_TOTAL=$((PIPELINE_SUCCESS + PIPELINE_FAILED))

if [ "$PIPELINE_TOTAL" -gt 0 ]; then
    SUCCESS_RATE=$(( (PIPELINE_SUCCESS * 100) / PIPELINE_TOTAL ))
    echo -e "   ✅ Success Rate: ${GREEN}${SUCCESS_RATE}%${NC} (${PIPELINE_SUCCESS}/${PIPELINE_TOTAL})"
    
    if [ "$SUCCESS_RATE" -ge 90 ]; then
        echo "<div class=\"item success\">✅ Excellent! ${SUCCESS_RATE}% success rate</div>" >> "$HTML_REPORT"
    elif [ "$SUCCESS_RATE" -ge 70 ]; then
        echo "<div class=\"item warning\">⚠️ Success rate: ${SUCCESS_RATE}% - needs improvement</div>" >> "$HTML_REPORT"
    else
        echo "<div class=\"item danger\">❌ Low success rate: ${SUCCESS_RATE}% - immediate attention required</div>" >> "$HTML_REPORT"
    fi
    
    # 실패한 파이프라인 상세
    if [ "$PIPELINE_FAILED" -gt 0 ]; then
        echo -e "   ${RED}❌ Failed Pipelines:${NC}"
        # 실제 구현에서는 프로젝트별로 조회해야 함
        echo "      (Run gitlab-health-check.sh for details)"
    fi
else
    echo -e "   ℹ️  No pipeline runs yesterday"
    echo "<div class=\"item\">No pipeline runs yesterday</div>" >> "$HTML_REPORT"
fi
echo "</div>" >> "$HTML_REPORT"
echo ""

# 4. 주목할 만한 변경사항
echo -e "${YELLOW}🔥 Notable Changes${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "<div class=\"section\"><h2 class=\"section-title\">🔥 Notable Changes</h2>" >> "$HTML_REPORT"

# 큰 규모의 푸시 (10개 이상 커밋)
BIG_PUSHES=$(echo "$EVENTS" | jq -r '.[] | select(.action_name == "pushed to" and .push_data.commit_count >= 10) | "\(.author.username) pushed \(.push_data.commit_count) commits to \(.project.name)"' | head -5)
if [ -n "$BIG_PUSHES" ]; then
    echo -e "   ${MAGENTA}Large Pushes:${NC}"
    echo "$BIG_PUSHES" | while IFS= read -r push; do
        echo "      • $push"
        echo "<div class=\"item\">📦 $push</div>" >> "$HTML_REPORT"
    done
fi

# 새로운 프로젝트
NEW_PROJECTS=$(curl -s "${GITLAB_API_URL}/projects?created_after=${YESTERDAY}&created_before=${TODAY}" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.[] | .name' | head -5)
if [ -n "$NEW_PROJECTS" ]; then
    echo -e "   ${GREEN}New Projects:${NC}"
    echo "$NEW_PROJECTS" | while IFS= read -r project; do
        echo "      • $project"
        echo "<div class=\"item success\">🆕 New project: $project</div>" >> "$HTML_REPORT"
    done
fi
echo "</div>" >> "$HTML_REPORT"
echo ""

# 5. 오늘 해야 할 일
echo -e "${YELLOW}📝 Today's Action Items${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "<div class=\"section\"><h2 class=\"section-title\">📝 Today's Action Items</h2>" >> "$HTML_REPORT"

# 리뷰 대기 중인 MR
OPEN_MRS=$(curl -s "${GITLAB_API_URL}/merge_requests?state=opened&scope=all" -H "Private-Token: ${GITLAB_TOKEN}")
MR_COUNT=$(echo "$OPEN_MRS" | jq 'length')
OLD_MRS=$(echo "$OPEN_MRS" | jq -r '.[] | select((.created_at | strptime("%Y-%m-%dT%H:%M:%S") | mktime) < (now - 7*24*60*60)) | .title' 2>/dev/null | wc -l)

if [ "$MR_COUNT" -gt 0 ]; then
    echo -e "   🔀 ${YELLOW}${MR_COUNT} MRs${NC} await review"
    echo "<div class=\"item warning\">🔀 $MR_COUNT merge requests await review</div>" >> "$HTML_REPORT"
    
    if [ "$OLD_MRS" -gt 0 ]; then
        echo -e "      ${RED}⚠️  ${OLD_MRS} MRs${NC} are older than 7 days!"
        echo "<div class=\"item danger\">⚠️ $OLD_MRS MRs are older than 7 days!</div>" >> "$HTML_REPORT"
    fi
fi

# CI/CD 실패 대응
if [ "$PIPELINE_FAILED" -gt 0 ]; then
    echo -e "   🚨 ${RED}Fix ${PIPELINE_FAILED} failed pipelines${NC}"
    echo "<div class=\"item danger\">🚨 Fix $PIPELINE_FAILED failed pipelines</div>" >> "$HTML_REPORT"
fi

# 비활성 프로젝트 체크
INACTIVE_DAYS=30
INACTIVE_DATE=$(date -u -v-${INACTIVE_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${INACTIVE_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')
INACTIVE_COUNT=$(curl -s "${GITLAB_API_URL}/projects?last_activity_before=${INACTIVE_DATE}&per_page=1" -H "Private-Token: ${GITLAB_TOKEN}" -I | grep -i "x-total:" | awk '{print $2}' | tr -d '\r')

if [ "$INACTIVE_COUNT" -gt 10 ]; then
    echo -e "   🗄️  Consider archiving ${INACTIVE_COUNT} inactive projects"
    echo "<div class=\"item\">🗄️ Consider archiving $INACTIVE_COUNT inactive projects (>30 days)</div>" >> "$HTML_REPORT"
fi

echo "</div>" >> "$HTML_REPORT"
echo ""

# 6. 주간 트렌드 (월요일에만)
if [ "$(date +%u)" -eq 1 ]; then
    echo -e "${YELLOW}📈 Weekly Trends${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    echo "<div class=\"section\"><h2 class=\"section-title\">📈 Weekly Trends</h2>" >> "$HTML_REPORT"
    
    WEEK_AGO=$(date -u -v-7d '+%Y-%m-%dT00:00:00Z' 2>/dev/null || date -u -d '7 days ago' '+%Y-%m-%dT00:00:00Z')
    WEEK_EVENTS=$(curl -s "${GITLAB_API_URL}/events?after=${WEEK_AGO}&per_page=1000" -H "Private-Token: ${GITLAB_TOKEN}")
    
    WEEK_COMMITS=$(echo "$WEEK_EVENTS" | jq '[.[] | select(.action_name == "pushed to")] | length')
    WEEK_MRS=$(echo "$WEEK_EVENTS" | jq '[.[] | select(.action_name == "accepted")] | length')
    
    echo -e "   📊 Last 7 days: ${GREEN}${WEEK_COMMITS}${NC} commits, ${GREEN}${WEEK_MRS}${NC} MRs merged"
    echo "<div class=\"item\">📊 Last 7 days: $WEEK_COMMITS commits, $WEEK_MRS MRs merged</div>" >> "$HTML_REPORT"
    
    echo "</div>" >> "$HTML_REPORT"
    echo ""
fi

# HTML 리포트 마무리
cat >> "$HTML_REPORT" << 'EOF'
        </div>
        <div class="footer">
            <p>Generated by GitLab Daily Digest Script</p>
            <p>Run <code>gitlab-health-check.sh</code> for real-time status</p>
        </div>
    </div>
</body>
</html>
EOF

# 요약
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Daily Digest Complete!${NC}"
echo -e "   📄 HTML Report: ${CYAN}${HTML_REPORT}${NC}"

# 이메일 전송
if [ "$SEND_EMAIL" = true ] && [ -n "$EMAIL_TO" ]; then
    echo -e "   📧 Sending email to: ${EMAIL_TO}..."
    
    # macOS의 경우
    if command -v mail &> /dev/null; then
        cat "$HTML_REPORT" | mail -s "GitLab Daily Digest - ${REPORT_DATE}" -a "Content-Type: text/html" "$EMAIL_TO"
        echo -e "   ✅ Email sent!"
    else
        echo -e "   ⚠️  Mail command not found. Please install mail utility."
    fi
fi

echo ""
echo "💡 Tips:"
echo "   • Add to cron for daily execution: 0 9 * * * $0"
echo "   • Use --email flag to receive reports via email"
echo "   • Open HTML report in browser for better visualization"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"