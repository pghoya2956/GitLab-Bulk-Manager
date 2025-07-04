#!/bin/bash

# GitLab Merge Assistant - MR 자동 분석 및 추천
# 열린 MR을 분석하고 병합 우선순위를 제안

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/common.sh"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 옵션
PROJECT_ID=""
AUTO_MERGE=false
SHOW_CONFLICTS=false

# 도움말
show_help() {
    cat << EOF
GitLab Merge Assistant - Intelligent MR Analysis Tool

Usage: $(basename "$0") [OPTIONS]

Options:
    -p, --project ID        Analyze MRs for specific project
    -a, --auto-merge        Suggest auto-mergeable MRs
    -c, --conflicts         Show MRs with conflicts
    -h, --help             Show this help message

Examples:
    # Analyze all open MRs
    $(basename "$0")

    # Find auto-mergeable MRs for project
    $(basename "$0") --project 123 --auto-merge
EOF
}

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project)
            PROJECT_ID="$2"
            shift 2
            ;;
        -a|--auto-merge)
            AUTO_MERGE=true
            shift
            ;;
        -c|--conflicts)
            SHOW_CONFLICTS=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}              GitLab Merge Request Assistant                  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# API 엔드포인트 설정
if [ -n "$PROJECT_ID" ]; then
    API_ENDPOINT="${GITLAB_API_URL}/projects/${PROJECT_ID}/merge_requests?state=opened"
else
    API_ENDPOINT="${GITLAB_API_URL}/merge_requests?state=opened&scope=all"
fi

# 열린 MR 가져오기
echo "🔍 Fetching open merge requests..."
OPEN_MRS=$(curl -s "${API_ENDPOINT}" -H "Private-Token: ${GITLAB_TOKEN}")
TOTAL_MRS=$(echo "$OPEN_MRS" | jq 'length')

if [ "$TOTAL_MRS" -eq 0 ]; then
    echo -e "${GREEN}✅ No open merge requests found!${NC}"
    exit 0
fi

echo -e "📊 Found ${YELLOW}${TOTAL_MRS}${NC} open merge requests"
echo ""

# MR 분석 및 스코어링
declare -A MR_SCORES
declare -A MR_REASONS

analyze_mr() {
    local mr="$1"
    local mr_iid=$(echo "$mr" | jq -r '.iid')
    local mr_id=$(echo "$mr" | jq -r '.id')
    local project_id=$(echo "$mr" | jq -r '.project_id')
    local score=0
    local reasons=""
    
    # 1. 승인 상태 확인
    local approvals=$(curl -s "${GITLAB_API_URL}/projects/${project_id}/merge_requests/${mr_iid}/approvals" -H "Private-Token: ${GITLAB_TOKEN}")
    local approved=$(echo "$approvals" | jq -r '.approved // false')
    local approvals_left=$(echo "$approvals" | jq -r '.approvals_left // 0')
    
    if [ "$approved" = "true" ]; then
        score=$((score + 50))
        reasons="${reasons}✅ Fully approved|"
    elif [ "$approvals_left" -eq 1 ]; then
        score=$((score + 30))
        reasons="${reasons}👍 Needs 1 more approval|"
    fi
    
    # 2. CI/CD 상태
    local pipeline_status=$(echo "$mr" | jq -r '.head_pipeline.status // "none"')
    case "$pipeline_status" in
        "success")
            score=$((score + 40))
            reasons="${reasons}🟢 Pipeline passed|"
            ;;
        "failed")
            score=$((score - 20))
            reasons="${reasons}🔴 Pipeline failed|"
            ;;
        "running")
            score=$((score + 10))
            reasons="${reasons}🔄 Pipeline running|"
            ;;
    esac
    
    # 3. 충돌 여부
    local has_conflicts=$(echo "$mr" | jq -r '.has_conflicts // false')
    local merge_status=$(echo "$mr" | jq -r '.merge_status // "cannot_be_merged"')
    
    if [ "$has_conflicts" = "true" ]; then
        score=$((score - 30))
        reasons="${reasons}⚠️ Has conflicts|"
    elif [ "$merge_status" = "can_be_merged" ]; then
        score=$((score + 20))
        reasons="${reasons}✔️ Ready to merge|"
    fi
    
    # 4. 나이 (오래된 MR일수록 우선순위 높음)
    local created_at=$(echo "$mr" | jq -r '.created_at')
    local days_old=$(( ($(date +%s) - $(date -d "$created_at" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$created_at" +%s)) / 86400 ))
    
    if [ "$days_old" -gt 7 ]; then
        score=$((score + 15))
        reasons="${reasons}📅 ${days_old} days old|"
    elif [ "$days_old" -gt 3 ]; then
        score=$((score + 10))
        reasons="${reasons}📅 ${days_old} days old|"
    fi
    
    # 5. 변경 사항 크기
    local changes=$(curl -s "${GITLAB_API_URL}/projects/${project_id}/merge_requests/${mr_iid}/changes" -H "Private-Token: ${GITLAB_TOKEN}")
    local changes_count=$(echo "$changes" | jq '.changes | length')
    local additions=$(echo "$changes" | jq '[.changes[].diff | match("\\+[^+]"; "g")] | length' 2>/dev/null || echo "0")
    local deletions=$(echo "$changes" | jq '[.changes[].diff | match("-[^-]"; "g")] | length' 2>/dev/null || echo "0")
    
    if [ "$changes_count" -lt 5 ] && [ "$additions" -lt 100 ]; then
        score=$((score + 10))
        reasons="${reasons}📦 Small change|"
    fi
    
    MR_SCORES["$mr_id"]=$score
    MR_REASONS["$mr_id"]=$reasons
}

# 모든 MR 분석
echo "🔬 Analyzing merge requests..."
echo "$OPEN_MRS" | jq -c '.[]' | while IFS= read -r mr; do
    analyze_mr "$mr"
done

# 결과 정렬 및 표시
echo ""
echo -e "${YELLOW}📋 Merge Request Priority List${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 점수별로 정렬하여 표시
echo "$OPEN_MRS" | jq -r '.[] | @base64' | while IFS= read -r mr_encoded; do
    mr=$(echo "$mr_encoded" | base64 -d)
    mr_id=$(echo "$mr" | jq -r '.id')
    mr_title=$(echo "$mr" | jq -r '.title')
    mr_author=$(echo "$mr" | jq -r '.author.name')
    mr_project=$(echo "$mr" | jq -r '.references.full')
    mr_url=$(echo "$mr" | jq -r '.web_url')
    has_conflicts=$(echo "$mr" | jq -r '.has_conflicts // false')
    merge_status=$(echo "$mr" | jq -r '.merge_status // "unknown"')
    
    score=${MR_SCORES[$mr_id]:-0}
    reasons=${MR_REASONS[$mr_id]:-""}
    
    # 필터 적용
    if [ "$AUTO_MERGE" = true ] && [ "$merge_status" != "can_be_merged" ]; then
        continue
    fi
    
    if [ "$SHOW_CONFLICTS" = true ] && [ "$has_conflicts" != "true" ]; then
        continue
    fi
    
    # 점수에 따른 색상
    if [ "$score" -ge 80 ]; then
        color=$GREEN
        priority="🔥 HIGH"
    elif [ "$score" -ge 50 ]; then
        color=$YELLOW
        priority="🔸 MEDIUM"
    else
        color=$CYAN
        priority="🔹 LOW"
    fi
    
    echo -e "${color}${priority} Priority (Score: ${score})${NC}"
    echo -e "   📝 ${mr_title}"
    echo -e "   👤 Author: ${mr_author}"
    echo -e "   📁 Project: ${mr_project}"
    echo -e "   🔗 ${mr_url}"
    
    # 이유 표시
    if [ -n "$reasons" ]; then
        echo -e "   💡 Factors:"
        IFS='|' read -ra REASONS_ARRAY <<< "$reasons"
        for reason in "${REASONS_ARRAY[@]}"; do
            if [ -n "$reason" ]; then
                echo -e "      ${reason}"
            fi
        done
    fi
    
    # 추천 액션
    if [ "$score" -ge 80 ] && [ "$merge_status" = "can_be_merged" ]; then
        echo -e "   ${GREEN}➡️  Recommended: MERGE NOW${NC}"
    elif [ "$has_conflicts" = "true" ]; then
        echo -e "   ${RED}➡️  Action Required: RESOLVE CONFLICTS${NC}"
    elif [ "$score" -ge 50 ]; then
        echo -e "   ${YELLOW}➡️  Recommended: REVIEW SOON${NC}"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
done | sort -t':' -k2 -nr | head -20

# 요약 통계
echo ""
echo -e "${YELLOW}📊 Summary Statistics${NC}"

READY_TO_MERGE=$(echo "$OPEN_MRS" | jq '[.[] | select(.merge_status == "can_be_merged")] | length')
WITH_CONFLICTS=$(echo "$OPEN_MRS" | jq '[.[] | select(.has_conflicts == true)] | length')
APPROVED=$(echo "$OPEN_MRS" | jq -c '.[]' | while read -r mr; do
    project_id=$(echo "$mr" | jq -r '.project_id')
    mr_iid=$(echo "$mr" | jq -r '.iid')
    approved=$(curl -s "${GITLAB_API_URL}/projects/${project_id}/merge_requests/${mr_iid}/approvals" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.approved // false')
    [ "$approved" = "true" ] && echo "1"
done | wc -l)

echo -e "   ✅ Ready to merge: ${GREEN}${READY_TO_MERGE}${NC}"
echo -e "   ⚠️  With conflicts: ${RED}${WITH_CONFLICTS}${NC}"
echo -e "   👍 Fully approved: ${GREEN}${APPROVED}${NC}"
echo ""

# 액션 아이템
if [ "$READY_TO_MERGE" -gt 0 ]; then
    echo -e "${GREEN}💡 Quick Actions:${NC}"
    echo -e "   • ${GREEN}${READY_TO_MERGE} MRs${NC} can be merged immediately"
    echo -e "   • Run with --auto-merge to see only mergeable MRs"
fi

if [ "$WITH_CONFLICTS" -gt 0 ]; then
    echo -e "   • ${RED}${WITH_CONFLICTS} MRs${NC} need conflict resolution"
    echo -e "   • Run with --conflicts to see only conflicted MRs"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"