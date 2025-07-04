#!/bin/bash

# GitLab Cost Analyzer - 리소스 사용량 및 비용 분석
# 스토리지, CI/CD 사용량을 분석하고 비용 최적화 제안

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/common.sh"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 비용 설정 (월 단위, 예시 값)
STORAGE_COST_PER_GB=0.10  # $0.10 per GB per month
CI_MINUTE_COST=0.008      # $0.008 per minute
USER_COST_PER_MONTH=10    # $10 per active user

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}               GitLab Cost Analysis Report                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Report Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. 스토리지 분석
echo -e "${YELLOW}💾 Storage Analysis${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_STORAGE=0
declare -A GROUP_STORAGE
declare -A PROJECT_STORAGE

# 그룹별 스토리지 수집
GROUPS=$(curl -s "${GITLAB_API_URL}/groups?per_page=100&statistics=true" -H "Private-Token: ${GITLAB_TOKEN}")
echo "$GROUPS" | jq -c '.[]' | while IFS= read -r group; do
    GROUP_NAME=$(echo "$group" | jq -r '.full_name')
    GROUP_ID=$(echo "$group" | jq -r '.id')
    STORAGE_SIZE=$(echo "$group" | jq -r '.statistics.storage_size // 0')
    
    if [ "$STORAGE_SIZE" -gt 0 ]; then
        GROUP_STORAGE["$GROUP_NAME"]=$STORAGE_SIZE
        TOTAL_STORAGE=$((TOTAL_STORAGE + STORAGE_SIZE))
    fi
done

# 프로젝트별 스토리지 (상위 10개)
echo "📊 Top 10 Projects by Storage:"
PROJECTS=$(curl -s "${GITLAB_API_URL}/projects?per_page=100&statistics=true&order_by=storage_size&sort=desc" -H "Private-Token: ${GITLAB_TOKEN}")
echo "$PROJECTS" | jq -r '.[:10] | .[] | "\(.path_with_namespace)|\(.statistics.repository_size // 0)|\(.statistics.lfs_objects_size // 0)|\(.statistics.artifacts_size // 0)"' | \
while IFS='|' read -r name repo_size lfs_size artifacts_size; do
    total_size=$((repo_size + lfs_size + artifacts_size))
    total_mb=$((total_size / 1048576))
    
    printf "   %-40s %8d MB" "$name" "$total_mb"
    
    # 분석
    if [ "$lfs_size" -gt "$repo_size" ]; then
        echo -e " ${YELLOW}⚠️  Large LFS usage${NC}"
    elif [ "$artifacts_size" -gt "$repo_size" ]; then
        echo -e " ${YELLOW}⚠️  Large artifacts${NC}"
    else
        echo ""
    fi
done

# 스토리지 비용 계산
TOTAL_GB=$((TOTAL_STORAGE / 1073741824))
STORAGE_MONTHLY_COST=$(echo "$TOTAL_GB * $STORAGE_COST_PER_GB" | bc)

echo ""
echo -e "💰 Storage Cost Summary:"
echo -e "   Total Storage: ${YELLOW}${TOTAL_GB} GB${NC}"
echo -e "   Monthly Cost: ${GREEN}\$${STORAGE_MONTHLY_COST}${NC}"
echo ""

# 2. CI/CD 사용량 분석
echo -e "${YELLOW}🚀 CI/CD Usage Analysis${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 지난 30일간의 파이프라인 통계
MONTH_AGO=$(date -u -v-30d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '30 days ago' '+%Y-%m-%dT%H:%M:%SZ')
TOTAL_PIPELINES=0
TOTAL_DURATION=0
FAILED_PIPELINES=0

echo "📈 Last 30 Days Pipeline Statistics:"

# 활성 프로젝트별 파이프라인 분석
ACTIVE_PROJECTS=$(curl -s "${GITLAB_API_URL}/projects?last_activity_after=${MONTH_AGO}&per_page=50" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.[].id')

for PROJECT_ID in $ACTIVE_PROJECTS; do
    PIPELINES=$(curl -s "${GITLAB_API_URL}/projects/${PROJECT_ID}/pipelines?updated_after=${MONTH_AGO}&per_page=100" -H "Private-Token: ${GITLAB_TOKEN}")
    
    PROJECT_PIPELINE_COUNT=$(echo "$PIPELINES" | jq 'length')
    PROJECT_DURATION=$(echo "$PIPELINES" | jq '[.[] | .duration // 0] | add')
    PROJECT_FAILED=$(echo "$PIPELINES" | jq '[.[] | select(.status == "failed")] | length')
    
    TOTAL_PIPELINES=$((TOTAL_PIPELINES + PROJECT_PIPELINE_COUNT))
    TOTAL_DURATION=$((TOTAL_DURATION + PROJECT_DURATION))
    FAILED_PIPELINES=$((FAILED_PIPELINES + PROJECT_FAILED))
done

# CI/CD 비용 계산
CI_MINUTES=$((TOTAL_DURATION / 60))
CI_MONTHLY_COST=$(echo "$CI_MINUTES * $CI_MINUTE_COST" | bc)

echo -e "   Total Pipelines: ${YELLOW}${TOTAL_PIPELINES}${NC}"
echo -e "   Total CI Minutes: ${YELLOW}${CI_MINUTES}${NC}"
echo -e "   Failed Pipelines: ${RED}${FAILED_PIPELINES}${NC} ($(( (FAILED_PIPELINES * 100) / (TOTAL_PIPELINES + 1) ))%)"
echo -e "   Average Duration: $(( TOTAL_DURATION / (TOTAL_PIPELINES + 1) / 60 )) minutes"
echo ""
echo -e "💰 CI/CD Cost Summary:"
echo -e "   Monthly Cost: ${GREEN}\$${CI_MONTHLY_COST}${NC}"
echo ""

# 3. 사용자 활동 및 비용
echo -e "${YELLOW}👥 User Activity & Costs${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 활성 사용자 수
ACTIVE_USERS=$(curl -s "${GITLAB_API_URL}/users?active=true&per_page=1" -H "Private-Token: ${GITLAB_TOKEN}" -I | grep -i "x-total:" | awk '{print $2}' | tr -d '\r')
BLOCKED_USERS=$(curl -s "${GITLAB_API_URL}/users?blocked=true&per_page=1" -H "Private-Token: ${GITLAB_TOKEN}" -I | grep -i "x-total:" | awk '{print $2}' | tr -d '\r')

# 최근 활동 사용자
RECENT_EVENTS=$(curl -s "${GITLAB_API_URL}/events?after=${MONTH_AGO}&per_page=1000" -H "Private-Token: ${GITLAB_TOKEN}")
ACTIVE_USER_IDS=$(echo "$RECENT_EVENTS" | jq -r '.[] | .author_id' | sort -u | wc -l)

USER_MONTHLY_COST=$(echo "$ACTIVE_USERS * $USER_COST_PER_MONTH" | bc)

echo -e "   Total Users: ${YELLOW}${ACTIVE_USERS}${NC}"
echo -e "   Active (30 days): ${GREEN}${ACTIVE_USER_IDS}${NC}"
echo -e "   Blocked Users: ${RED}${BLOCKED_USERS}${NC}"
echo -e "   Inactive Users: $((ACTIVE_USERS - ACTIVE_USER_IDS))"
echo ""
echo -e "💰 User License Cost:"
echo -e "   Monthly Cost: ${GREEN}\$${USER_MONTHLY_COST}${NC}"
echo -e "   Cost per Active User: \$$(echo "$USER_MONTHLY_COST / $ACTIVE_USER_IDS" | bc)"
echo ""

# 4. 총 비용 요약
echo -e "${YELLOW}💵 Total Cost Summary${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_MONTHLY_COST=$(echo "$STORAGE_MONTHLY_COST + $CI_MONTHLY_COST + $USER_MONTHLY_COST" | bc)
TOTAL_YEARLY_COST=$(echo "$TOTAL_MONTHLY_COST * 12" | bc)

echo -e "   Storage:     ${GREEN}\$${STORAGE_MONTHLY_COST}${NC} /month"
echo -e "   CI/CD:       ${GREEN}\$${CI_MONTHLY_COST}${NC} /month"
echo -e "   Users:       ${GREEN}\$${USER_MONTHLY_COST}${NC} /month"
echo -e "   ─────────────────────────────"
echo -e "   ${CYAN}Total:       \$${TOTAL_MONTHLY_COST} /month${NC}"
echo -e "   ${CYAN}Annual:      \$${TOTAL_YEARLY_COST} /year${NC}"
echo ""

# 5. 비용 최적화 제안
echo -e "${YELLOW}💡 Cost Optimization Recommendations${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RECOMMENDATIONS=0

# 스토리지 최적화
if [ "$TOTAL_GB" -gt 100 ]; then
    echo -e "   ${RED}🗑️  Storage Optimization:${NC}"
    echo "      • Clean up old artifacts (potential savings: ~20%)"
    echo "      • Review LFS usage in large projects"
    echo "      • Archive inactive projects"
    ((RECOMMENDATIONS++))
fi

# CI/CD 최적화
FAILURE_RATE=$(( (FAILED_PIPELINES * 100) / (TOTAL_PIPELINES + 1) ))
if [ "$FAILURE_RATE" -gt 20 ]; then
    echo -e "   ${RED}🚀 CI/CD Optimization:${NC}"
    echo "      • High failure rate (${FAILURE_RATE}%) wastes CI minutes"
    echo "      • Fix failing tests to save ~$(( CI_MONTHLY_COST * FAILURE_RATE / 100 )) /month"
    ((RECOMMENDATIONS++))
fi

# 사용자 최적화
INACTIVE_RATIO=$(( ((ACTIVE_USERS - ACTIVE_USER_IDS) * 100) / ACTIVE_USERS ))
if [ "$INACTIVE_RATIO" -gt 20 ]; then
    echo -e "   ${RED}👥 User License Optimization:${NC}"
    echo "      • $((ACTIVE_USERS - ACTIVE_USER_IDS)) inactive users found"
    echo "      • Potential savings: \$$((  (ACTIVE_USERS - ACTIVE_USER_IDS) * USER_COST_PER_MONTH )) /month"
    echo "      • Consider blocking or removing inactive users"
    ((RECOMMENDATIONS++))
fi

if [ "$RECOMMENDATIONS" -eq 0 ]; then
    echo -e "   ${GREEN}✅ Your GitLab usage is well-optimized!${NC}"
fi

echo ""

# 6. 트렌드 예측
echo -e "${YELLOW}📈 Usage Trends & Forecast${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 간단한 선형 증가 예측 (월 5% 증가 가정)
GROWTH_RATE=1.05
COST_3_MONTHS=$(echo "$TOTAL_MONTHLY_COST * $GROWTH_RATE * $GROWTH_RATE * $GROWTH_RATE" | bc)
COST_6_MONTHS=$(echo "$TOTAL_MONTHLY_COST * $GROWTH_RATE * $GROWTH_RATE * $GROWTH_RATE * $GROWTH_RATE * $GROWTH_RATE * $GROWTH_RATE" | bc)

echo -e "   Current:    \$${TOTAL_MONTHLY_COST} /month"
echo -e "   3 months:   \$${COST_3_MONTHS} /month (+$(echo "($COST_3_MONTHS - $TOTAL_MONTHLY_COST)" | bc))"
echo -e "   6 months:   \$${COST_6_MONTHS} /month (+$(echo "($COST_6_MONTHS - $TOTAL_MONTHLY_COST)" | bc))"
echo ""

# 액션 아이템 생성
if [ "$RECOMMENDATIONS" -gt 0 ]; then
    echo -e "${GREEN}📋 Action Items:${NC}"
    echo "   1. Review and implement optimization recommendations"
    echo "   2. Set up automated cleanup jobs for artifacts"
    echo "   3. Create monthly cost review process"
    echo "   4. Consider implementing usage quotas"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Run this analysis monthly to track cost trends"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"