#!/bin/bash

# GitLab Smart Permissions - 지능형 권한 최적화
# 사용 패턴을 분석하여 불필요한 권한 제거 및 보안 강화

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
INACTIVE_DAYS=60
ANALYSIS_DAYS=90
DRY_RUN=false
AUTO_FIX=false
REPORT_FORMAT="console"

show_help() {
    cat << EOF
GitLab Smart Permissions - Intelligent Access Control Optimization

Usage: $(basename "$0") [OPTIONS]

Options:
    -i, --inactive DAYS     Consider users inactive after DAYS (default: 60)
    -a, --analysis DAYS     Analyze activity for past DAYS (default: 90)
    -d, --dry-run          Preview changes without applying
    -f, --auto-fix         Automatically apply safe optimizations
    -r, --report FORMAT    Output format: console/json/html (default: console)
    -g, --group-id ID      Analyze specific group only
    -h, --help            Show this help message

Examples:
    # Analyze permissions and show recommendations
    $(basename "$0") --dry-run

    # Auto-fix obvious permission issues
    $(basename "$0") --auto-fix --inactive 30

    # Generate HTML security report
    $(basename "$0") --report html > security_report.html

Description:
    Analyzes GitLab permissions to:
    - Identify over-privileged users
    - Find inactive users with active permissions
    - Detect permission anomalies
    - Suggest principle of least privilege
    - Track permission changes over time
    
    Helps maintain security while reducing license costs.
EOF
}

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--inactive)
            INACTIVE_DAYS="$2"
            shift 2
            ;;
        -a|--analysis)
            ANALYSIS_DAYS="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--auto-fix)
            AUTO_FIX=true
            shift
            ;;
        -r|--report)
            REPORT_FORMAT="$2"
            shift 2
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

# 분석 시작
log "INFO" "Starting smart permissions analysis..."

# 전역 변수
declare -A USER_ACTIVITY
declare -A USER_PERMISSIONS
declare -A PERMISSION_ISSUES
TOTAL_USERS=0
ISSUES_FOUND=0

# 날짜 계산
INACTIVE_DATE=$(date -u -v-${INACTIVE_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${INACTIVE_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')
ANALYSIS_DATE=$(date -u -v-${ANALYSIS_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${ANALYSIS_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')

# 사용자 활동 분석
analyze_user_activity() {
    local user_id=$1
    local username=$2
    
    # 최근 활동 조회
    local events=$(gitlab_api "GET" "/users/$user_id/events?after=$ANALYSIS_DATE&per_page=100")
    if [ $? -ne 200 ]; then
        log "WARN" "Failed to get events for user $username"
        return
    fi
    
    local event_count=$(echo "$events" | jq 'length')
    local last_push=$(echo "$events" | jq -r '[.[] | select(.action_name == "pushed to")] | first | .created_at // "never"')
    local last_merge=$(echo "$events" | jq -r '[.[] | select(.action_name == "accepted")] | first | .created_at // "never"')
    local last_comment=$(echo "$events" | jq -r '[.[] | select(.action_name == "commented on")] | first | .created_at // "never"')
    
    # 활동 유형 분석
    local push_count=$(echo "$events" | jq '[.[] | select(.action_name == "pushed to")] | length')
    local merge_count=$(echo "$events" | jq '[.[] | select(.action_name == "accepted")] | length')
    local review_count=$(echo "$events" | jq '[.[] | select(.action_name == "commented on" and .target_type == "MergeRequest")] | length')
    
    USER_ACTIVITY["$user_id"]="$username|$event_count|$push_count|$merge_count|$review_count|$last_push|$last_merge|$last_comment"
}

# 권한 분석
analyze_permissions() {
    local member=$1
    local user_id=$(echo "$member" | jq -r '.user_id // .id')
    local username=$(echo "$member" | jq -r '.username // .name')
    local access_level=$(echo "$member" | jq -r '.access_level')
    local expires_at=$(echo "$member" | jq -r '.expires_at // "never"')
    local group_id=$(echo "$member" | jq -r '.source_id // ""')
    
    # 사용자 활동 분석
    analyze_user_activity "$user_id" "$username"
    
    # 활동 데이터 가져오기
    local activity_data="${USER_ACTIVITY[$user_id]}"
    IFS='|' read -r _ event_count push_count merge_count review_count last_push last_merge last_comment <<< "$activity_data"
    
    # 권한 저장
    USER_PERMISSIONS["$user_id"]="$username|$access_level|$expires_at|$group_id"
    
    # 문제 식별
    local issues=""
    local risk_level=0
    
    # 1. 비활성 사용자의 높은 권한
    if [[ "$last_push" < "$INACTIVE_DATE" ]] && [ "$access_level" -ge 40 ]; then
        issues="${issues}Inactive user with high privileges|"
        risk_level=$((risk_level + 3))
    fi
    
    # 2. 개발자 권한이지만 코드 푸시 없음
    if [ "$access_level" -ge 30 ] && [ "$push_count" -eq 0 ] && [ "$event_count" -gt 0 ]; then
        issues="${issues}Developer without code contributions|"
        risk_level=$((risk_level + 2))
    fi
    
    # 3. 관리자 권한이지만 관리 활동 없음
    if [ "$access_level" -ge 50 ] && [ "$merge_count" -eq 0 ] && [ "$review_count" -lt 5 ]; then
        issues="${issues}Admin without management activity|"
        risk_level=$((risk_level + 4))
    fi
    
    # 4. 만료되지 않는 게스트 권한
    if [ "$access_level" -eq 10 ] && [ "$expires_at" = "never" ] && [ "$event_count" -lt 5 ]; then
        issues="${issues}Permanent guest with low activity|"
        risk_level=$((risk_level + 1))
    fi
    
    # 5. 너무 높은 권한 (활동 대비)
    if [ "$access_level" -ge 40 ] && [ "$event_count" -lt 10 ] && [ "$push_count" -lt 5 ]; then
        issues="${issues}Possibly over-privileged|"
        risk_level=$((risk_level + 2))
    fi
    
    if [ -n "$issues" ]; then
        PERMISSION_ISSUES["$user_id"]="$username|$access_level|$risk_level|$issues"
        ((ISSUES_FOUND++))
    fi
    
    ((TOTAL_USERS++))
}

# 권한 최적화 제안
suggest_optimization() {
    local user_id=$1
    local current_level=$2
    local activity_data="${USER_ACTIVITY[$user_id]}"
    
    IFS='|' read -r username event_count push_count merge_count review_count rest <<< "$activity_data"
    
    # 활동 기반 권한 제안
    local suggested_level=$current_level
    local reason=""
    
    if [ "$event_count" -eq 0 ]; then
        suggested_level=0  # 제거
        reason="No activity in $ANALYSIS_DAYS days"
    elif [ "$push_count" -eq 0 ] && [ "$current_level" -ge 30 ]; then
        suggested_level=20  # Reporter
        reason="No code contributions"
    elif [ "$push_count" -gt 0 ] && [ "$push_count" -lt 5 ] && [ "$current_level" -ge 40 ]; then
        suggested_level=30  # Developer
        reason="Limited code contributions"
    elif [ "$merge_count" -eq 0 ] && [ "$review_count" -lt 10 ] && [ "$current_level" -ge 50 ]; then
        suggested_level=40  # Maintainer
        reason="No admin activities"
    fi
    
    echo "$suggested_level|$reason"
}

# 메인 분석 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}             GitLab Smart Permissions Analysis                ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Analysis Period: Last $ANALYSIS_DAYS days"
echo -e "⏰ Inactive Threshold: $INACTIVE_DAYS days"
echo -e "🔧 Mode: $([ "$DRY_RUN" = true ] && echo "Dry Run" || echo "Live")"
echo ""

# 멤버 목록 가져오기
if [ -n "$GROUP_ID" ]; then
    echo "📁 Analyzing group ID: $GROUP_ID"
    MEMBERS=$(gitlab_api_paginated "GET" "/groups/$GROUP_ID/members/all")
else
    echo "🌐 Analyzing all accessible groups"
    # 모든 그룹의 멤버 수집
    GROUPS=$(gitlab_api_paginated "GET" "/groups")
    MEMBERS="[]"
    
    echo "$GROUPS" | jq -c '.[]' | while IFS= read -r group; do
        group_id=$(echo "$group" | jq -r '.id')
        group_members=$(gitlab_api "GET" "/groups/$group_id/members/all?per_page=100")
        if [ $? -eq 200 ]; then
            MEMBERS=$(echo "$MEMBERS" "$group_members" | jq -s 'add')
        fi
    done
fi

if [ $? -ne 0 ]; then
    error_exit "Failed to fetch members" 2
fi

TOTAL_MEMBERS=$(echo "$MEMBERS" | jq 'length')
echo "👥 Found $TOTAL_MEMBERS members to analyze"
echo ""

# 분석 실행
echo "🔍 Analyzing permissions..."
CURRENT=0
echo "$MEMBERS" | jq -c '.[]' | while IFS= read -r member; do
    ((CURRENT++))
    show_progress "$CURRENT" "$TOTAL_MEMBERS" "Analyzing members"
    analyze_permissions "$member"
done

echo ""
echo ""

# 결과 출력
case "$REPORT_FORMAT" in
    json)
        # JSON 출력
        echo "{"
        echo "  \"summary\": {"
        echo "    \"total_users\": $TOTAL_USERS,"
        echo "    \"issues_found\": $ISSUES_FOUND,"
        echo "    \"analysis_date\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\""
        echo "  },"
        echo "  \"issues\": ["
        for user_id in "${!PERMISSION_ISSUES[@]}"; do
            IFS='|' read -r username level risk issues <<< "${PERMISSION_ISSUES[$user_id]}"
            echo "    {"
            echo "      \"user_id\": $user_id,"
            echo "      \"username\": \"$username\","
            echo "      \"access_level\": $level,"
            echo "      \"risk_level\": $risk,"
            echo "      \"issues\": \"$issues\""
            echo "    },"
        done | sed '$ s/,$//'
        echo "  ]"
        echo "}"
        ;;
    html)
        # HTML 리포트
        cat << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GitLab Permissions Security Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; }
        .risk-high { background: #ffebee; border-left: 4px solid #f44336; }
        .risk-medium { background: #fff3e0; border-left: 4px solid #ff9800; }
        .risk-low { background: #e8f5e9; border-left: 4px solid #4caf50; }
        .user-card { margin: 15px 0; padding: 15px; border-radius: 5px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2.5em; font-weight: bold; color: #e74c3c; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GitLab Permissions Security Report</h1>
            <p>Generated on 
EOF
        echo "$(date '+%Y-%m-%d %H:%M:%S')</p>"
        echo "        </div>"
        echo "        <div class=\"content\">"
        echo "            <div class=\"stats\">"
        echo "                <div class=\"stat-card\">"
        echo "                    <div class=\"stat-number\">$TOTAL_USERS</div>"
        echo "                    <div>Total Users</div>"
        echo "                </div>"
        echo "                <div class=\"stat-card\">"
        echo "                    <div class=\"stat-number\">$ISSUES_FOUND</div>"
        echo "                    <div>Security Issues</div>"
        echo "                </div>"
        echo "                <div class=\"stat-card\">"
        echo "                    <div class=\"stat-number\">$((ISSUES_FOUND * 100 / (TOTAL_USERS + 1)))%</div>"
        echo "                    <div>Risk Rate</div>"
        echo "                </div>"
        echo "            </div>"
        echo "            <h2>Permission Issues Found</h2>"
        
        # 위험도별 정렬
        for user_id in "${!PERMISSION_ISSUES[@]}"; do
            IFS='|' read -r username level risk issues <<< "${PERMISSION_ISSUES[$user_id]}"
            echo "$risk|$user_id|$username|$level|$issues"
        done | sort -rn | while IFS='|' read -r risk user_id username level issues; do
            local risk_class="risk-low"
            [ "$risk" -ge 3 ] && risk_class="risk-medium"
            [ "$risk" -ge 5 ] && risk_class="risk-high"
            
            echo "            <div class=\"user-card $risk_class\">"
            echo "                <h3>$username</h3>"
            echo "                <p><strong>Current Level:</strong> $(number_to_access_level $level)</p>"
            echo "                <p><strong>Issues:</strong> ${issues%|}</p>"
            echo "                <p><strong>Risk Score:</strong> $risk/10</p>"
            echo "            </div>"
        done
        
        echo "        </div>"
        echo "    </div>"
        echo "</body>"
        echo "</html>"
        ;;
    *)
        # 콘솔 출력
        echo -e "${YELLOW}🔍 Permission Analysis Summary${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "Total Users Analyzed: ${YELLOW}$TOTAL_USERS${NC}"
        echo -e "Security Issues Found: ${RED}$ISSUES_FOUND${NC}"
        echo -e "Risk Rate: $((ISSUES_FOUND * 100 / (TOTAL_USERS + 1)))%"
        echo ""
        
        if [ ${#PERMISSION_ISSUES[@]} -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Permission Issues (by risk level)${NC}"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            # 위험도별 정렬 및 출력
            for user_id in "${!PERMISSION_ISSUES[@]}"; do
                IFS='|' read -r username level risk issues <<< "${PERMISSION_ISSUES[$user_id]}"
                echo "$risk|$user_id|$username|$level|$issues"
            done | sort -rn | while IFS='|' read -r risk user_id username level issues; do
                # 위험도에 따른 색상
                local color=$CYAN
                [ "$risk" -ge 3 ] && color=$YELLOW
                [ "$risk" -ge 5 ] && color=$RED
                
                echo -e "${color}👤 $username${NC} (Risk: $risk/10)"
                echo -e "   Current: $(number_to_access_level $level)"
                echo -e "   Issues: ${issues%|}"
                
                # 최적화 제안
                IFS='|' read -r suggested_level reason <<< "$(suggest_optimization "$user_id" "$level")"
                if [ "$suggested_level" -ne "$level" ]; then
                    echo -e "   ${GREEN}➡️  Suggested: $(number_to_access_level $suggested_level) ($reason)${NC}"
                fi
                echo ""
            done
        fi
        
        # 통계
        echo -e "${YELLOW}📊 Permission Distribution${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 권한 레벨별 분포
        declare -A LEVEL_COUNT
        for user_id in "${!USER_PERMISSIONS[@]}"; do
            IFS='|' read -r _ level _ _ <<< "${USER_PERMISSIONS[$user_id]}"
            ((LEVEL_COUNT[$level]++))
        done
        
        for level in 10 20 30 40 50; do
            count=${LEVEL_COUNT[$level]:-0}
            [ "$count" -gt 0 ] && echo "   $(number_to_access_level $level): $count users"
        done
        echo ""
        
        # 최적화 가능성
        echo -e "${YELLOW}💡 Optimization Opportunities${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 비활성 사용자
        INACTIVE_COUNT=0
        REMOVABLE_COUNT=0
        for user_id in "${!USER_ACTIVITY[@]}"; do
            IFS='|' read -r username event_count rest <<< "${USER_ACTIVITY[$user_id]}"
            [ "$event_count" -eq 0 ] && ((REMOVABLE_COUNT++))
            [ "$event_count" -lt 5 ] && ((INACTIVE_COUNT++))
        done
        
        echo -e "   ${RED}$REMOVABLE_COUNT users${NC} can be removed (no activity)"
        echo -e "   ${YELLOW}$INACTIVE_COUNT users${NC} have minimal activity"
        
        # 권한 다운그레이드 가능
        DOWNGRADE_COUNT=0
        for user_id in "${!PERMISSION_ISSUES[@]}"; do
            IFS='|' read -r username level risk issues <<< "${PERMISSION_ISSUES[$user_id]}"
            [[ "$issues" == *"over-privileged"* ]] && ((DOWNGRADE_COUNT++))
        done
        
        echo -e "   ${GREEN}$DOWNGRADE_COUNT users${NC} can have reduced permissions"
        echo ""
        
        # 예상 절감액
        LICENSE_COST_PER_USER=15  # 월 $15 추정
        POTENTIAL_SAVINGS=$((REMOVABLE_COUNT * LICENSE_COST_PER_USER))
        echo -e "   💰 Potential monthly savings: ${GREEN}\$$POTENTIAL_SAVINGS${NC}"
        ;;
esac

# Auto-fix 실행
if [ "$AUTO_FIX" = true ] && [ "$DRY_RUN" = false ]; then
    echo ""
    echo -e "${YELLOW}🔧 Applying automatic fixes...${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    FIXED_COUNT=0
    
    for user_id in "${!PERMISSION_ISSUES[@]}"; do
        IFS='|' read -r username level risk issues <<< "${PERMISSION_ISSUES[$user_id]}"
        IFS='|' read -r _ _ _ group_id <<< "${USER_PERMISSIONS[$user_id]}"
        
        # 안전한 자동 수정만 적용
        if [ "$risk" -ge 5 ] && [[ "$issues" == *"Inactive user"* ]]; then
            echo -n "   Removing inactive user $username..."
            
            if [ -n "$group_id" ]; then
                response=$(gitlab_api "DELETE" "/groups/$group_id/members/$user_id")
                if [ $? -eq 204 ]; then
                    echo -e " ${GREEN}✓${NC}"
                    ((FIXED_COUNT++))
                else
                    echo -e " ${RED}✗${NC}"
                fi
            fi
        elif [ "$risk" -ge 3 ] && [[ "$issues" == *"over-privileged"* ]]; then
            IFS='|' read -r suggested_level reason <<< "$(suggest_optimization "$user_id" "$level")"
            
            if [ "$suggested_level" -lt "$level" ] && [ "$suggested_level" -gt 0 ]; then
                echo -n "   Downgrading $username to $(number_to_access_level $suggested_level)..."
                
                response=$(gitlab_api "PUT" "/groups/$group_id/members/$user_id" "{\"access_level\": $suggested_level}")
                if [ $? -eq 200 ]; then
                    echo -e " ${GREEN}✓${NC}"
                    ((FIXED_COUNT++))
                else
                    echo -e " ${RED}✗${NC}"
                fi
            fi
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ Fixed $FIXED_COUNT permission issues${NC}"
fi

# 감사 로그 생성
if [ "$DRY_RUN" = false ]; then
    AUDIT_FILE="$BASE_DIR/logs/permission_audit_$(date +%Y%m%d_%H%M%S).json"
    
    echo "{" > "$AUDIT_FILE"
    echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"," >> "$AUDIT_FILE"
    echo "  \"summary\": {" >> "$AUDIT_FILE"
    echo "    \"total_users\": $TOTAL_USERS," >> "$AUDIT_FILE"
    echo "    \"issues_found\": $ISSUES_FOUND," >> "$AUDIT_FILE"
    echo "    \"auto_fixed\": ${FIXED_COUNT:-0}" >> "$AUDIT_FILE"
    echo "  }," >> "$AUDIT_FILE"
    echo "  \"issues\": [" >> "$AUDIT_FILE"
    
    for user_id in "${!PERMISSION_ISSUES[@]}"; do
        IFS='|' read -r username level risk issues <<< "${PERMISSION_ISSUES[$user_id]}"
        echo "    {\"user\": \"$username\", \"level\": $level, \"risk\": $risk, \"issues\": \"$issues\"}," >> "$AUDIT_FILE"
    done | sed '$ s/,$//' >> "$AUDIT_FILE"
    
    echo "  ]" >> "$AUDIT_FILE"
    echo "}" >> "$AUDIT_FILE"
    
    log "INFO" "Audit log saved to $AUDIT_FILE"
fi

# 요약
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Smart Permissions Analysis Complete!${NC}"
echo -e "   🔐 Security Score: $((100 - ISSUES_FOUND * 100 / (TOTAL_USERS + 1)))/100"
echo -e "   💰 Potential savings: ${GREEN}\$$POTENTIAL_SAVINGS/month${NC}"
[ "$DRY_RUN" = true ] && echo -e "   ⚠️  Run without --dry-run to apply fixes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log "INFO" "Smart permissions analysis completed"