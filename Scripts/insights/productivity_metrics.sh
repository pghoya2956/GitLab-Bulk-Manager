#!/bin/bash

# GitLab Productivity Metrics - 팀 생산성 측정 및 인사이트
# 개발 속도, 품질, 협업 효율성을 데이터 기반으로 분석

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
source "$BASE_DIR/lib/common.sh"
source "$BASE_DIR/lib/validation.sh"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# 기본값
PERIOD_DAYS=30
COMPARE_PERIOD=true
OUTPUT_FORMAT="console"
TEAM_VIEW=false
EXPORT_CSV=false

show_help() {
    cat << EOF
GitLab Productivity Metrics - Team Performance Analytics

Usage: $(basename "$0") [OPTIONS]

Options:
    -p, --period DAYS      Analysis period in days (default: 30)
    -c, --compare          Compare with previous period (default: true)
    -f, --format FORMAT    Output format: console/json/dashboard (default: console)
    -t, --team-view        Show team-level metrics (default: false)
    -e, --export           Export detailed CSV data
    -g, --group-id ID      Analyze specific group only
    -h, --help            Show this help message

Examples:
    # Weekly team productivity report
    $(basename "$0") --period 7 --team-view

    # Monthly comparison dashboard
    $(basename "$0") --period 30 --compare --format dashboard

    # Export quarterly metrics
    $(basename "$0") --period 90 --export

Description:
    Measures key productivity indicators:
    - Velocity: Commits, MRs, deployments per developer
    - Quality: Code review time, test coverage, bug rate
    - Collaboration: Review participation, response time
    - Efficiency: Cycle time, lead time, throughput
    
    Provides actionable insights for team improvement.
EOF
}

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--period)
            PERIOD_DAYS="$2"
            shift 2
            ;;
        -c|--compare)
            COMPARE_PERIOD=true
            shift
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -t|--team-view)
            TEAM_VIEW=true
            shift
            ;;
        -e|--export)
            EXPORT_CSV=true
            shift
            ;;
        -g|--group-id)
            GROUP_ID="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1" 1
            ;;
    esac
done

# 초기화
init_script
load_config "$BASE_DIR/config/gitlab.env"

# 메트릭 수집 시작
log "INFO" "Starting productivity metrics analysis..."

# 전역 변수
declare -A USER_METRICS
declare -A TEAM_METRICS
declare -A PROJECT_METRICS
TOTAL_COMMITS=0
TOTAL_MRS=0
TOTAL_REVIEWS=0
TOTAL_DEPLOYMENTS=0

# 날짜 계산
END_DATE=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
START_DATE=$(date -u -v-${PERIOD_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${PERIOD_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')

if [ "$COMPARE_PERIOD" = true ]; then
    PREV_END_DATE=$START_DATE
    PREV_START_DATE=$(date -u -v-$((PERIOD_DAYS * 2))d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "$((PERIOD_DAYS * 2)) days ago" '+%Y-%m-%dT%H:%M:%SZ')
fi

# 개발자 메트릭 수집
collect_developer_metrics() {
    local user_id=$1
    local username=$2
    local period_start=$3
    local period_end=$4
    
    # 커밋 수집
    local commits=$(gitlab_api "GET" "/users/$user_id/events?action=pushed&after=$period_start&before=$period_end&per_page=1000")
    local commit_count=0
    local lines_added=0
    local lines_removed=0
    
    if [ $? -eq 200 ]; then
        commit_count=$(echo "$commits" | jq '[.[] | select(.push_data.commit_count > 0)] | length')
        
        # 각 푸시의 상세 정보 수집 (샘플링)
        echo "$commits" | jq -r '.[:5] | .[] | .project_id' | while read -r project_id; do
            local commit_details=$(gitlab_api "GET" "/projects/$project_id/repository/commits?since=$period_start&until=$period_end&per_page=20")
            if [ $? -eq 200 ]; then
                lines_added=$((lines_added + $(echo "$commit_details" | jq '[.[] | .stats.additions // 0] | add' || echo 0)))
                lines_removed=$((lines_removed + $(echo "$commit_details" | jq '[.[] | .stats.deletions // 0] | add' || echo 0)))
            fi
        done
    fi
    
    # MR 메트릭
    local mrs_created=$(gitlab_api "GET" "/merge_requests?author_id=$user_id&created_after=$period_start&created_before=$period_end&per_page=100")
    local mrs_merged=$(gitlab_api "GET" "/merge_requests?author_id=$user_id&state=merged&updated_after=$period_start&updated_before=$period_end&per_page=100")
    
    local mr_created_count=0
    local mr_merged_count=0
    local total_mr_time=0
    local mr_review_time=0
    
    if [ $? -eq 200 ]; then
        mr_created_count=$(echo "$mrs_created" | jq 'length')
        mr_merged_count=$(echo "$mrs_merged" | jq 'length')
        
        # MR 사이클 타임 계산
        echo "$mrs_merged" | jq -c '.[]' | while read -r mr; do
            local created=$(echo "$mr" | jq -r '.created_at')
            local merged=$(echo "$mr" | jq -r '.merged_at // ""')
            
            if [ -n "$merged" ]; then
                local cycle_hours=$(( ($(date -d "$merged" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$merged" +%s) - $(date -d "$created" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$created" +%s)) / 3600 ))
                total_mr_time=$((total_mr_time + cycle_hours))
            fi
        done
    fi
    
    # 코드 리뷰 참여
    local reviews=$(gitlab_api "GET" "/users/$user_id/events?action=commented&target_type=MergeRequest&after=$period_start&before=$period_end&per_page=200")
    local review_count=0
    
    if [ $? -eq 200 ]; then
        review_count=$(echo "$reviews" | jq 'length')
    fi
    
    # 이슈 메트릭
    local issues_created=$(gitlab_api "GET" "/issues?author_id=$user_id&created_after=$period_start&created_before=$period_end&per_page=100")
    local issues_closed=$(gitlab_api "GET" "/issues?assignee_id=$user_id&state=closed&updated_after=$period_start&updated_before=$period_end&per_page=100")
    
    local issue_created_count=0
    local issue_closed_count=0
    
    if [ $? -eq 200 ]; then
        issue_created_count=$(echo "$issues_created" | jq 'length')
        issue_closed_count=$(echo "$issues_closed" | jq 'length')
    fi
    
    # 메트릭 저장
    local metrics="$commit_count|$lines_added|$lines_removed|$mr_created_count|$mr_merged_count|$review_count|$issue_created_count|$issue_closed_count|$total_mr_time"
    
    return 0
}

# 팀 레벨 메트릭 계산
calculate_team_metrics() {
    local group_id=$1
    local period_start=$2
    local period_end=$3
    
    # 배포 빈도
    local deployments=0
    local deployment_success_rate=0
    
    # 프로젝트별 파이프라인 확인
    local projects=$(gitlab_api "GET" "/groups/$group_id/projects?include_subgroups=true&per_page=100")
    if [ $? -eq 200 ]; then
        echo "$projects" | jq -c '.[]' | while read -r project; do
            local project_id=$(echo "$project" | jq -r '.id')
            local pipelines=$(gitlab_api "GET" "/projects/$project_id/pipelines?updated_after=$period_start&updated_before=$period_end&per_page=100")
            
            if [ $? -eq 200 ]; then
                local prod_deployments=$(echo "$pipelines" | jq '[.[] | select(.ref == "main" or .ref == "master" or .ref == "production")] | length')
                local success_deployments=$(echo "$pipelines" | jq '[.[] | select((.ref == "main" or .ref == "master" or .ref == "production") and .status == "success")] | length')
                
                deployments=$((deployments + prod_deployments))
                [ "$prod_deployments" -gt 0 ] && deployment_success_rate=$((deployment_success_rate + success_deployments * 100 / prod_deployments))
            fi
        done
    fi
    
    # 평균 리드 타임 (첫 커밋에서 배포까지)
    # 평균 사이클 타임 (MR 오픈에서 머지까지)
    # MTTR (Mean Time To Recovery)
    
    echo "$deployments|$deployment_success_rate"
}

# 생산성 점수 계산
calculate_productivity_score() {
    local commits=$1
    local mrs=$2
    local reviews=$3
    local issues=$4
    
    # 가중치 적용
    local score=$((commits * 1 + mrs * 5 + reviews * 2 + issues * 3))
    
    # 정규화 (0-100)
    local normalized_score=$((score * 100 / (PERIOD_DAYS * 20)))
    [ "$normalized_score" -gt 100 ] && normalized_score=100
    
    echo "$normalized_score"
}

# 메인 분석 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}             GitLab Productivity Metrics Report               ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Period: $(date -d "$START_DATE" '+%Y-%m-%d' 2>/dev/null || date -r "$(date -j -f "%Y-%m-%dT%H:%M:%S" "$START_DATE" +%s)" '+%Y-%m-%d') to $(date '+%Y-%m-%d')"
echo -e "📊 Analysis Type: $([ "$TEAM_VIEW" = true ] && echo "Team" || echo "Individual")"
echo ""

# 사용자 목록 가져오기
if [ -n "$GROUP_ID" ]; then
    echo "📁 Analyzing group ID: $GROUP_ID"
    MEMBERS=$(gitlab_api "GET" "/groups/$GROUP_ID/members/all?per_page=100")
else
    echo "🌐 Analyzing all accessible users"
    MEMBERS=$(gitlab_api "GET" "/users?active=true&per_page=100")
fi

if [ $? -ne 0 ]; then
    error_exit "Failed to fetch users" 2
fi

TOTAL_USERS=$(echo "$MEMBERS" | jq 'length')
echo "👥 Found $TOTAL_USERS active users"
echo ""

# 현재 기간 메트릭 수집
echo "📊 Collecting current period metrics..."
CURRENT=0

declare -A CURRENT_METRICS
echo "$MEMBERS" | jq -c '.[]' | while IFS= read -r member; do
    ((CURRENT++))
    show_progress "$CURRENT" "$TOTAL_USERS" "Analyzing users"
    
    user_id=$(echo "$member" | jq -r '.id')
    username=$(echo "$member" | jq -r '.username // .name')
    
    metrics=$(collect_developer_metrics "$user_id" "$username" "$START_DATE" "$END_DATE")
    CURRENT_METRICS["$user_id"]="$username|$metrics"
    
    # 전역 카운터 업데이트
    IFS='|' read -r commits lines_add lines_del mrs_created mrs_merged reviews issues_created issues_closed mr_time <<< "$metrics"
    TOTAL_COMMITS=$((TOTAL_COMMITS + commits))
    TOTAL_MRS=$((TOTAL_MRS + mrs_merged))
    TOTAL_REVIEWS=$((TOTAL_REVIEWS + reviews))
done

echo ""
echo ""

# 이전 기간 메트릭 수집 (비교용)
declare -A PREVIOUS_METRICS
if [ "$COMPARE_PERIOD" = true ]; then
    echo "📊 Collecting previous period metrics for comparison..."
    CURRENT=0
    
    echo "$MEMBERS" | jq -c '.[]' | while IFS= read -r member; do
        ((CURRENT++))
        show_progress "$CURRENT" "$TOTAL_USERS" "Analyzing previous period"
        
        user_id=$(echo "$member" | jq -r '.id')
        username=$(echo "$member" | jq -r '.username // .name')
        
        metrics=$(collect_developer_metrics "$user_id" "$username" "$PREV_START_DATE" "$PREV_END_DATE")
        PREVIOUS_METRICS["$user_id"]="$username|$metrics"
    done
    
    echo ""
    echo ""
fi

# 결과 출력
case "$OUTPUT_FORMAT" in
    json)
        # JSON 출력
        echo "{"
        echo "  \"period\": {"
        echo "    \"start\": \"$START_DATE\","
        echo "    \"end\": \"$END_DATE\","
        echo "    \"days\": $PERIOD_DAYS"
        echo "  },"
        echo "  \"summary\": {"
        echo "    \"total_commits\": $TOTAL_COMMITS,"
        echo "    \"total_merge_requests\": $TOTAL_MRS,"
        echo "    \"total_reviews\": $TOTAL_REVIEWS,"
        echo "    \"active_developers\": $TOTAL_USERS"
        echo "  },"
        echo "  \"developers\": ["
        
        for user_id in "${!CURRENT_METRICS[@]}"; do
            IFS='|' read -r username commits lines_add lines_del mrs_created mrs_merged reviews issues_created issues_closed mr_time <<< "${CURRENT_METRICS[$user_id]}"
            score=$(calculate_productivity_score "$commits" "$mrs_merged" "$reviews" "$issues_closed")
            
            echo "    {"
            echo "      \"user_id\": $user_id,"
            echo "      \"username\": \"$username\","
            echo "      \"metrics\": {"
            echo "        \"commits\": $commits,"
            echo "        \"lines_added\": $lines_add,"
            echo "        \"merge_requests\": $mrs_merged,"
            echo "        \"reviews\": $reviews,"
            echo "        \"issues_closed\": $issues_closed,"
            echo "        \"productivity_score\": $score"
            echo "      }"
            echo "    },"
        done | sed '$ s/,$//'
        
        echo "  ]"
        echo "}"
        ;;
    dashboard)
        # HTML Dashboard
        cat << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GitLab Productivity Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2.5em; font-weight: bold; color: #667eea; }
        .metric-label { color: #666; margin-top: 5px; }
        .chart-container { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .leaderboard { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .leader-item { display: flex; justify-content: space-between; padding: 15px; border-bottom: 1px solid #eee; }
        .leader-item:hover { background: #f8f9fa; }
        .trend-up { color: #28a745; }
        .trend-down { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GitLab Productivity Dashboard</h1>
            <p>
EOF
        echo "Period: $(date -d "$START_DATE" '+%B %d' 2>/dev/null || date -r "$(date -j -f "%Y-%m-%dT%H:%M:%S" "$START_DATE" +%s)" '+%B %d') - $(date '+%B %d, %Y')"
        echo "            </p>"
        echo "        </div>"
        
        # 주요 메트릭 카드
        echo "        <div class=\"metrics-grid\">"
        echo "            <div class=\"metric-card\">"
        echo "                <div class=\"metric-value\">$TOTAL_COMMITS</div>"
        echo "                <div class=\"metric-label\">Total Commits</div>"
        echo "            </div>"
        echo "            <div class=\"metric-card\">"
        echo "                <div class=\"metric-value\">$TOTAL_MRS</div>"
        echo "                <div class=\"metric-label\">Merge Requests</div>"
        echo "            </div>"
        echo "            <div class=\"metric-card\">"
        echo "                <div class=\"metric-value\">$TOTAL_REVIEWS</div>"
        echo "                <div class=\"metric-label\">Code Reviews</div>"
        echo "            </div>"
        echo "            <div class=\"metric-card\">"
        echo "                <div class=\"metric-value\">$((TOTAL_COMMITS / PERIOD_DAYS))</div>"
        echo "                <div class=\"metric-label\">Daily Velocity</div>"
        echo "            </div>"
        echo "        </div>"
        
        # 차트 섹션
        echo "        <div class=\"chart-container\">"
        echo "            <h2>Developer Activity</h2>"
        echo "            <canvas id=\"activityChart\"></canvas>"
        echo "        </div>"
        
        # 리더보드
        echo "        <div class=\"leaderboard\">"
        echo "            <h2>Top Contributors</h2>"
        
        # 생산성 점수로 정렬
        for user_id in "${!CURRENT_METRICS[@]}"; do
            IFS='|' read -r username commits lines_add lines_del mrs_created mrs_merged reviews issues_created issues_closed mr_time <<< "${CURRENT_METRICS[$user_id]}"
            score=$(calculate_productivity_score "$commits" "$mrs_merged" "$reviews" "$issues_closed")
            echo "$score|$username|$commits|$mrs_merged|$reviews"
        done | sort -rn | head -10 | while IFS='|' read -r score username commits mrs reviews; do
            echo "            <div class=\"leader-item\">"
            echo "                <div><strong>$username</strong></div>"
            echo "                <div>Score: $score | Commits: $commits | MRs: $mrs | Reviews: $reviews</div>"
            echo "            </div>"
        done
        
        echo "        </div>"
        echo "    </div>"
        
        # 차트 스크립트
        echo "    <script>"
        echo "        const ctx = document.getElementById('activityChart').getContext('2d');"
        echo "        new Chart(ctx, {"
        echo "            type: 'bar',"
        echo "            data: {"
        echo "                labels: ["
        
        # 상위 10명의 라벨
        for user_id in "${!CURRENT_METRICS[@]}"; do
            IFS='|' read -r username rest <<< "${CURRENT_METRICS[$user_id]}"
            echo "'$username',"
        done | head -10 | sed '$ s/,$//'
        
        echo "                ],"
        echo "                datasets: [{"
        echo "                    label: 'Productivity Score',"
        echo "                    data: ["
        
        # 상위 10명의 점수
        for user_id in "${!CURRENT_METRICS[@]}"; do
            IFS='|' read -r username commits lines_add lines_del mrs_created mrs_merged reviews issues_created issues_closed mr_time <<< "${CURRENT_METRICS[$user_id]}"
            score=$(calculate_productivity_score "$commits" "$mrs_merged" "$reviews" "$issues_closed")
            echo "$score,"
        done | head -10 | sed '$ s/,$//'
        
        echo "                    ],"
        echo "                    backgroundColor: 'rgba(102, 126, 234, 0.5)',"
        echo "                    borderColor: 'rgba(102, 126, 234, 1)',"
        echo "                    borderWidth: 1"
        echo "                }]"
        echo "            },"
        echo "            options: {"
        echo "                scales: {"
        echo "                    y: {"
        echo "                        beginAtZero: true"
        echo "                    }"
        echo "                }"
        echo "            }"
        echo "        });"
        echo "    </script>"
        echo "</body>"
        echo "</html>"
        ;;
    *)
        # 콘솔 출력
        echo -e "${YELLOW}📊 Team Productivity Summary${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 팀 전체 통계
        AVG_COMMITS=$((TOTAL_COMMITS / (TOTAL_USERS + 1)))
        AVG_MRS=$((TOTAL_MRS / (TOTAL_USERS + 1)))
        AVG_REVIEWS=$((TOTAL_REVIEWS / (TOTAL_USERS + 1)))
        
        echo -e "📈 Team Velocity (${PERIOD_DAYS} days):"
        echo -e "   Total Commits: ${GREEN}$TOTAL_COMMITS${NC} (avg: $AVG_COMMITS/dev)"
        echo -e "   Merged MRs: ${GREEN}$TOTAL_MRS${NC} (avg: $AVG_MRS/dev)"
        echo -e "   Code Reviews: ${GREEN}$TOTAL_REVIEWS${NC} (avg: $AVG_REVIEWS/dev)"
        echo -e "   Daily Velocity: ${YELLOW}$((TOTAL_COMMITS / PERIOD_DAYS))${NC} commits/day"
        
        # 비교 (이전 기간)
        if [ "$COMPARE_PERIOD" = true ]; then
            echo ""
            echo -e "${YELLOW}📊 Trend Analysis (vs previous period)${NC}"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            # 이전 기간 집계
            PREV_COMMITS=0
            PREV_MRS=0
            PREV_REVIEWS=0
            
            for user_id in "${!PREVIOUS_METRICS[@]}"; do
                IFS='|' read -r username commits lines_add lines_del mrs_created mrs_merged reviews rest <<< "${PREVIOUS_METRICS[$user_id]}"
                PREV_COMMITS=$((PREV_COMMITS + commits))
                PREV_MRS=$((PREV_MRS + mrs_merged))
                PREV_REVIEWS=$((PREV_REVIEWS + reviews))
            done
            
            # 변화율 계산
            COMMIT_CHANGE=$(( (TOTAL_COMMITS - PREV_COMMITS) * 100 / (PREV_COMMITS + 1) ))
            MR_CHANGE=$(( (TOTAL_MRS - PREV_MRS) * 100 / (PREV_MRS + 1) ))
            REVIEW_CHANGE=$(( (TOTAL_REVIEWS - PREV_REVIEWS) * 100 / (PREV_REVIEWS + 1) ))
            
            # 트렌드 표시
            [ "$COMMIT_CHANGE" -ge 0 ] && COMMIT_TREND="${GREEN}↑" || COMMIT_TREND="${RED}↓"
            [ "$MR_CHANGE" -ge 0 ] && MR_TREND="${GREEN}↑" || MR_TREND="${RED}↓"
            [ "$REVIEW_CHANGE" -ge 0 ] && REVIEW_TREND="${GREEN}↑" || REVIEW_TREND="${RED}↓"
            
            echo -e "   Commits: $COMMIT_TREND ${COMMIT_CHANGE}%${NC} ($PREV_COMMITS → $TOTAL_COMMITS)"
            echo -e "   Merge Requests: $MR_TREND ${MR_CHANGE}%${NC} ($PREV_MRS → $TOTAL_MRS)"
            echo -e "   Code Reviews: $REVIEW_TREND ${REVIEW_CHANGE}%${NC} ($PREV_REVIEWS → $TOTAL_REVIEWS)"
        fi
        
        echo ""
        echo -e "${YELLOW}🏆 Top Performers${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 생산성 점수로 정렬하여 상위 10명 표시
        RANK=1
        for user_id in "${!CURRENT_METRICS[@]}"; do
            IFS='|' read -r username commits lines_add lines_del mrs_created mrs_merged reviews issues_created issues_closed mr_time <<< "${CURRENT_METRICS[$user_id]}"
            score=$(calculate_productivity_score "$commits" "$mrs_merged" "$reviews" "$issues_closed")
            echo "$score|$user_id|$username|$commits|$mrs_merged|$reviews|$issues_closed"
        done | sort -rn | head -10 | while IFS='|' read -r score user_id username commits mrs reviews issues; do
            echo -e "${CYAN}$RANK. $username${NC} (Score: $score/100)"
            echo -e "   📝 Commits: $commits | 🔀 MRs: $mrs | 👀 Reviews: $reviews | ✅ Issues: $issues"
            
            # 이전 기간 비교
            if [ "$COMPARE_PERIOD" = true ] && [ -n "${PREVIOUS_METRICS[$user_id]}" ]; then
                IFS='|' read -r _ prev_commits _ _ _ prev_mrs prev_reviews _ prev_issues _ <<< "${PREVIOUS_METRICS[$user_id]}"
                
                commit_diff=$((commits - prev_commits))
                mr_diff=$((mrs - prev_mrs))
                
                [ "$commit_diff" -ge 0 ] && commit_sign="+" || commit_sign=""
                [ "$mr_diff" -ge 0 ] && mr_sign="+" || mr_sign=""
                
                echo -e "   ${YELLOW}Δ${NC} Commits: ${commit_sign}${commit_diff} | MRs: ${mr_sign}${mr_diff}"
            fi
            
            ((RANK++))
            echo ""
        done
        
        # 인사이트
        echo -e "${YELLOW}💡 Insights & Recommendations${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 낮은 활동 개발자
        LOW_ACTIVITY=0
        NO_COMMITS=0
        NO_REVIEWS=0
        
        for user_id in "${!CURRENT_METRICS[@]}"; do
            IFS='|' read -r username commits _ _ _ _ reviews rest <<< "${CURRENT_METRICS[$user_id]}"
            [ "$commits" -eq 0 ] && ((NO_COMMITS++))
            [ "$reviews" -eq 0 ] && ((NO_REVIEWS++))
            [ "$commits" -lt 5 ] && [ "$reviews" -lt 3 ] && ((LOW_ACTIVITY++))
        done
        
        if [ "$LOW_ACTIVITY" -gt 0 ]; then
            echo -e "   ${RED}⚠️  $LOW_ACTIVITY developers${NC} have low activity"
            echo -e "      • $NO_COMMITS with no commits"
            echo -e "      • $NO_REVIEWS not participating in reviews"
            echo -e "      → Consider pairing or mentoring programs"
        fi
        
        # 코드 리뷰 참여율
        REVIEW_PARTICIPATION=$((TOTAL_USERS - NO_REVIEWS))
        REVIEW_RATE=$((REVIEW_PARTICIPATION * 100 / TOTAL_USERS))
        
        if [ "$REVIEW_RATE" -lt 70 ]; then
            echo -e "   ${YELLOW}📝 Low review participation:${NC} $REVIEW_RATE%"
            echo -e "      → Encourage code review culture"
        fi
        
        # MR 처리 속도
        if [ "$TOTAL_MRS" -gt 0 ]; then
            echo -e "   ${GREEN}✅ Team merged $TOTAL_MRS MRs${NC}"
            echo -e "      → Avg: $((TOTAL_MRS * 7 / PERIOD_DAYS)) MRs/week"
        fi
        
        # 팀 밸런스
        echo ""
        echo -e "   ${BLUE}Team Balance:${NC}"
        TOP_20_PERCENT=$((TOTAL_USERS / 5 + 1))
        TOP_COMMITS=0
        
        for user_id in "${!CURRENT_METRICS[@]}"; do
            IFS='|' read -r username commits rest <<< "${CURRENT_METRICS[$user_id]}"
            echo "$commits"
        done | sort -rn | head -"$TOP_20_PERCENT" | while read -r commits; do
            TOP_COMMITS=$((TOP_COMMITS + commits))
        done
        
        CONCENTRATION=$((TOP_COMMITS * 100 / (TOTAL_COMMITS + 1)))
        echo -e "      • Top 20% developers: ${CONCENTRATION}% of commits"
        
        if [ "$CONCENTRATION" -gt 60 ]; then
            echo -e "      ${YELLOW}→ Work is concentrated. Distribute tasks more evenly${NC}"
        else
            echo -e "      ${GREEN}→ Good work distribution${NC}"
        fi
        ;;
esac

# CSV 내보내기
if [ "$EXPORT_CSV" = true ]; then
    CSV_FILE="$BASE_DIR/logs/productivity_metrics_$(date +%Y%m%d_%H%M%S).csv"
    
    echo "Username,Commits,Lines Added,Lines Removed,MRs Created,MRs Merged,Reviews,Issues Created,Issues Closed,Productivity Score" > "$CSV_FILE"
    
    for user_id in "${!CURRENT_METRICS[@]}"; do
        IFS='|' read -r username commits lines_add lines_del mrs_created mrs_merged reviews issues_created issues_closed mr_time <<< "${CURRENT_METRICS[$user_id]}"
        score=$(calculate_productivity_score "$commits" "$mrs_merged" "$reviews" "$issues_closed")
        echo "$username,$commits,$lines_add,$lines_del,$mrs_created,$mrs_merged,$reviews,$issues_created,$issues_closed,$score" >> "$CSV_FILE"
    done
    
    echo ""
    echo -e "${GREEN}📄 CSV exported to: $CSV_FILE${NC}"
fi

# 요약
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Productivity Analysis Complete!${NC}"
echo -e "   📈 Team Productivity Score: $((TOTAL_COMMITS + TOTAL_MRS * 5 + TOTAL_REVIEWS * 2))"
echo -e "   👥 Active Developers: $((TOTAL_USERS - LOW_ACTIVITY)) / $TOTAL_USERS"
echo -e "   🚀 Velocity Trend: $([ "$COMMIT_CHANGE" -ge 0 ] && echo "Improving ↑" || echo "Declining ↓")"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log "INFO" "Productivity metrics analysis completed"