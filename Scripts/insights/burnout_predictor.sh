#!/bin/bash

# GitLab Burnout Predictor - 팀원 번아웃 조기 감지
# 활동 패턴 분석을 통한 번아웃 위험 예측 및 예방

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
ANALYSIS_DAYS=90
WARNING_THRESHOLD=70
CRITICAL_THRESHOLD=85
OUTPUT_FORMAT="console"
SEND_ALERTS=false
INCLUDE_RECOMMENDATIONS=true

show_help() {
    cat << EOF
GitLab Burnout Predictor - Team Wellbeing Analytics

Usage: $(basename "$0") [OPTIONS]

Options:
    -d, --days DAYS        Analysis period in days (default: 90)
    -w, --warning SCORE    Warning threshold 0-100 (default: 70)
    -c, --critical SCORE   Critical threshold 0-100 (default: 85)
    -f, --format FORMAT    Output format: console/json/report (default: console)
    -a, --alerts          Send alerts for high-risk cases
    -g, --group-id ID     Analyze specific group
    -h, --help           Show this help message

Examples:
    # Check team burnout risk
    $(basename "$0") --days 30 --group-id 123

    # Generate detailed report with alerts
    $(basename "$0") --format report --alerts

    # Quick check with custom thresholds
    $(basename "$0") --warning 60 --critical 80

Description:
    Analyzes developer activity patterns to identify:
    - Excessive working hours
    - Weekend/late-night commits
    - Declining code quality
    - Reduced collaboration
    - Stress indicators
    
    Provides early warning for burnout prevention.
EOF
}

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--days)
            ANALYSIS_DAYS="$2"
            shift 2
            ;;
        -w|--warning)
            WARNING_THRESHOLD="$2"
            shift 2
            ;;
        -c|--critical)
            CRITICAL_THRESHOLD="$2"
            shift 2
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -a|--alerts)
            SEND_ALERTS=true
            shift
            ;;
        -g|--group-id)
            GROUP_ID="$2"
            validate_group_id "$GROUP_ID" || error_exit "Invalid group ID: $GROUP_ID" 1
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

# 번아웃 분석 시작
log "INFO" "Starting burnout risk analysis..."

# 전역 변수
declare -A USER_BURNOUT_SCORES
declare -A USER_RISK_FACTORS
declare -A USER_PATTERNS
TOTAL_USERS=0
AT_RISK_USERS=0
CRITICAL_USERS=0

# 날짜 계산
END_DATE=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
START_DATE=$(date -u -v-${ANALYSIS_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${ANALYSIS_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')

# 작업 시간 패턴 분석
analyze_work_patterns() {
    local user_id=$1
    local username=$2
    
    # 이벤트 가져오기
    local events=$(gitlab_api "GET" "/users/$user_id/events?after=$START_DATE&per_page=1000")
    if [ $? -ne 200 ]; then
        log "WARN" "Failed to get events for user $username"
        return
    fi
    
    # 시간대별 활동 분석
    local total_events=$(echo "$events" | jq 'length')
    local weekend_events=0
    local late_night_events=0
    local early_morning_events=0
    local consecutive_days=0
    local max_consecutive_days=0
    local last_date=""
    
    # 각 이벤트의 시간 분석
    echo "$events" | jq -c '.[]' | while IFS= read -r event; do
        local created_at=$(echo "$event" | jq -r '.created_at')
        local event_date=$(date -d "$created_at" '+%Y-%m-%d' 2>/dev/null || date -r "$(date -j -f "%Y-%m-%dT%H:%M:%S" "$created_at" +%s)" '+%Y-%m-%d')
        local event_hour=$(date -d "$created_at" '+%H' 2>/dev/null || date -r "$(date -j -f "%Y-%m-%dT%H:%M:%S" "$created_at" +%s)" '+%H')
        local event_day=$(date -d "$created_at" '+%u' 2>/dev/null || date -r "$(date -j -f "%Y-%m-%dT%H:%M:%S" "$created_at" +%s)" '+%u')
        
        # 주말 작업
        if [ "$event_day" -ge 6 ]; then
            ((weekend_events++))
        fi
        
        # 늦은 밤 작업 (22시-02시)
        if [ "$event_hour" -ge 22 ] || [ "$event_hour" -le 2 ]; then
            ((late_night_events++))
        fi
        
        # 이른 아침 작업 (03시-06시)
        if [ "$event_hour" -ge 3 ] && [ "$event_hour" -le 6 ]; then
            ((early_morning_events++))
        fi
        
        # 연속 작업일 계산
        if [ "$last_date" != "$event_date" ]; then
            if [ -n "$last_date" ]; then
                local date_diff=$(($(date -d "$event_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$event_date" +%s) - $(date -d "$last_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$last_date" +%s)))
                if [ "$date_diff" -eq 86400 ]; then
                    ((consecutive_days++))
                    [ "$consecutive_days" -gt "$max_consecutive_days" ] && max_consecutive_days=$consecutive_days
                else
                    consecutive_days=1
                fi
            else
                consecutive_days=1
            fi
            last_date=$event_date
        fi
    done
    
    # 패턴 저장
    USER_PATTERNS["$user_id"]="$total_events|$weekend_events|$late_night_events|$early_morning_events|$max_consecutive_days"
}

# 코드 품질 및 협업 지표 분석
analyze_quality_indicators() {
    local user_id=$1
    local username=$2
    
    # MR 및 리뷰 활동
    local mrs=$(gitlab_api "GET" "/merge_requests?author_id=$user_id&created_after=$START_DATE&per_page=100")
    local reviews=$(gitlab_api "GET" "/merge_requests?reviewer_id=$user_id&created_after=$START_DATE&per_page=100")
    
    local mr_count=0
    local review_count=0
    local avg_mr_size=0
    local declined_mrs=0
    
    if [ $? -eq 200 ]; then
        mr_count=$(echo "$mrs" | jq 'length')
        
        # MR 크기 및 상태 분석
        echo "$mrs" | jq -c '.[]' | while IFS= read -r mr; do
            local changes=$(gitlab_api "GET" "/projects/$(echo "$mr" | jq -r '.project_id')/merge_requests/$(echo "$mr" | jq -r '.iid')/changes")
            if [ $? -eq 200 ]; then
                local additions=$(echo "$changes" | jq '[.changes[].diff | match("\\+[^+]"; "g")] | length' 2>/dev/null || echo "0")
                avg_mr_size=$((avg_mr_size + additions))
            fi
            
            local state=$(echo "$mr" | jq -r '.state')
            [ "$state" = "closed" ] && ((declined_mrs++))
        done
        
        [ "$mr_count" -gt 0 ] && avg_mr_size=$((avg_mr_size / mr_count))
    fi
    
    if [ $? -eq 200 ]; then
        review_count=$(echo "$reviews" | jq 'length')
    fi
    
    # 커밋 메시지 품질 (스트레스 지표)
    local stress_keywords=("fix" "bug" "urgent" "asap" "critical" "emergency" "hotfix" "broken")
    local stress_commits=0
    local total_commits=0
    
    local commits=$(gitlab_api "GET" "/users/$user_id/events?action=pushed&after=$START_DATE&per_page=200")
    if [ $? -eq 200 ]; then
        total_commits=$(echo "$commits" | jq '[.[] | .push_data.commit_count] | add')
        
        # 스트레스 키워드 검색
        for keyword in "${stress_keywords[@]}"; do
            local matches=$(echo "$commits" | jq -r '[.[] | .push_data.commit_title // ""] | join(" ")' | grep -io "$keyword" | wc -l)
            stress_commits=$((stress_commits + matches))
        done
    fi
    
    echo "$mr_count|$review_count|$avg_mr_size|$declined_mrs|$stress_commits|$total_commits"
}

# 번아웃 위험도 계산
calculate_burnout_score() {
    local user_id=$1
    local username=$2
    
    # 작업 패턴 데이터
    IFS='|' read -r total_events weekend_events late_night_events early_morning_events consecutive_days <<< "${USER_PATTERNS[$user_id]}"
    
    # 품질 지표 데이터
    local quality_data=$(analyze_quality_indicators "$user_id" "$username")
    IFS='|' read -r mr_count review_count avg_mr_size declined_mrs stress_commits total_commits <<< "$quality_data"
    
    # 위험 요소별 점수 계산
    local risk_factors=""
    local burnout_score=0
    
    # 1. 과도한 주말 작업 (20%)
    local weekend_ratio=$((weekend_events * 100 / (total_events + 1)))
    if [ "$weekend_ratio" -gt 20 ]; then
        burnout_score=$((burnout_score + 20))
        risk_factors="${risk_factors}High weekend work ($weekend_ratio%)|"
    elif [ "$weekend_ratio" -gt 10 ]; then
        burnout_score=$((burnout_score + 10))
        risk_factors="${risk_factors}Moderate weekend work ($weekend_ratio%)|"
    fi
    
    # 2. 늦은 밤/이른 아침 작업 (20%)
    local offhours_ratio=$(((late_night_events + early_morning_events) * 100 / (total_events + 1)))
    if [ "$offhours_ratio" -gt 25 ]; then
        burnout_score=$((burnout_score + 20))
        risk_factors="${risk_factors}Frequent off-hours work ($offhours_ratio%)|"
    elif [ "$offhours_ratio" -gt 15 ]; then
        burnout_score=$((burnout_score + 10))
        risk_factors="${risk_factors}Some off-hours work ($offhours_ratio%)|"
    fi
    
    # 3. 연속 작업일 (20%)
    if [ "$consecutive_days" -gt 14 ]; then
        burnout_score=$((burnout_score + 20))
        risk_factors="${risk_factors}Long work streaks (${consecutive_days}+ days)|"
    elif [ "$consecutive_days" -gt 7 ]; then
        burnout_score=$((burnout_score + 10))
        risk_factors="${risk_factors}Extended work periods ($consecutive_days days)|"
    fi
    
    # 4. 코드 품질 저하 (15%)
    if [ "$mr_count" -gt 0 ]; then
        local decline_ratio=$((declined_mrs * 100 / mr_count))
        if [ "$decline_ratio" -gt 30 ] || [ "$avg_mr_size" -gt 1000 ]; then
            burnout_score=$((burnout_score + 15))
            risk_factors="${risk_factors}Code quality issues|"
        fi
    fi
    
    # 5. 스트레스 지표 (15%)
    if [ "$total_commits" -gt 0 ]; then
        local stress_ratio=$((stress_commits * 100 / total_commits))
        if [ "$stress_ratio" -gt 40 ]; then
            burnout_score=$((burnout_score + 15))
            risk_factors="${risk_factors}High stress indicators ($stress_ratio%)|"
        elif [ "$stress_ratio" -gt 25 ]; then
            burnout_score=$((burnout_score + 8))
            risk_factors="${risk_factors}Elevated stress markers|"
        fi
    fi
    
    # 6. 협업 감소 (10%)
    if [ "$review_count" -lt 5 ] && [ "$mr_count" -gt 10 ]; then
        burnout_score=$((burnout_score + 10))
        risk_factors="${risk_factors}Reduced collaboration|"
    fi
    
    # 결과 저장
    USER_BURNOUT_SCORES["$user_id"]="$username|$burnout_score"
    USER_RISK_FACTORS["$user_id"]=$risk_factors
    
    ((TOTAL_USERS++))
    [ "$burnout_score" -ge "$WARNING_THRESHOLD" ] && ((AT_RISK_USERS++))
    [ "$burnout_score" -ge "$CRITICAL_THRESHOLD" ] && ((CRITICAL_USERS++))
}

# 개인별 권장사항 생성
generate_recommendations() {
    local user_id=$1
    local burnout_score=$2
    local risk_factors=$3
    
    local recommendations=""
    
    # 위험 요소별 권장사항
    if [[ "$risk_factors" == *"weekend work"* ]]; then
        recommendations="${recommendations}• Encourage taking full weekends off\n"
        recommendations="${recommendations}• Review workload distribution\n"
    fi
    
    if [[ "$risk_factors" == *"off-hours work"* ]]; then
        recommendations="${recommendations}• Promote healthy work-life boundaries\n"
        recommendations="${recommendations}• Check timezone considerations for remote work\n"
    fi
    
    if [[ "$risk_factors" == *"work streaks"* ]]; then
        recommendations="${recommendations}• Mandate regular breaks and time off\n"
        recommendations="${recommendations}• Consider enforcing vacation policies\n"
    fi
    
    if [[ "$risk_factors" == *"quality issues"* ]]; then
        recommendations="${recommendations}• Provide technical support or pair programming\n"
        recommendations="${recommendations}• Review current project complexity\n"
    fi
    
    if [[ "$risk_factors" == *"stress"* ]]; then
        recommendations="${recommendations}• One-on-one check-in recommended\n"
        recommendations="${recommendations}• Consider workload redistribution\n"
    fi
    
    if [[ "$risk_factors" == *"collaboration"* ]]; then
        recommendations="${recommendations}• Encourage team activities\n"
        recommendations="${recommendations}• Assign collaborative projects\n"
    fi
    
    echo -e "$recommendations"
}

# 팀 건강도 리포트 생성
generate_team_report() {
    cat << 'EOF'
# GitLab Team Wellbeing Report

## Executive Summary

**Report Date:** 
EOF
    echo "$(date '+%Y-%m-%d')"
    echo "**Analysis Period:** Last $ANALYSIS_DAYS days"
    echo "**Team Size:** $TOTAL_USERS members"
    echo ""
    
    # 위험도 요약
    echo "### Risk Overview"
    echo "- **Critical Risk:** $CRITICAL_USERS members ($(($CRITICAL_USERS * 100 / (TOTAL_USERS + 1)))%)"
    echo "- **At Risk:** $AT_RISK_USERS members ($(($AT_RISK_USERS * 100 / (TOTAL_USERS + 1)))%)"
    echo "- **Healthy:** $((TOTAL_USERS - AT_RISK_USERS)) members ($(((TOTAL_USERS - AT_RISK_USERS) * 100 / (TOTAL_USERS + 1)))%)"
    echo ""
    
    # 개인별 상세
    echo "## Individual Risk Assessment"
    echo ""
    
    # 위험도별 정렬
    for user_id in "${!USER_BURNOUT_SCORES[@]}"; do
        IFS='|' read -r username score <<< "${USER_BURNOUT_SCORES[$user_id]}"
        echo "$score|$user_id|$username"
    done | sort -rn | while IFS='|' read -r score user_id username; do
        local risk_level="Low"
        local emoji="✅"
        
        if [ "$score" -ge "$CRITICAL_THRESHOLD" ]; then
            risk_level="CRITICAL"
            emoji="🔴"
        elif [ "$score" -ge "$WARNING_THRESHOLD" ]; then
            risk_level="Warning"
            emoji="🟡"
        fi
        
        echo "### $emoji $username - Risk Level: $risk_level ($score/100)"
        echo ""
        echo "**Risk Factors:**"
        
        IFS='|' read -ra factors <<< "${USER_RISK_FACTORS[$user_id]}"
        for factor in "${factors[@]}"; do
            [ -n "$factor" ] && echo "- $factor"
        done
        
        if [ "$score" -ge "$WARNING_THRESHOLD" ]; then
            echo ""
            echo "**Recommendations:**"
            generate_recommendations "$user_id" "$score" "${USER_RISK_FACTORS[$user_id]}"
        fi
        echo ""
        echo "---"
        echo ""
    done
    
    # 팀 전체 권장사항
    echo "## Team-Wide Recommendations"
    echo ""
    
    if [ "$CRITICAL_USERS" -gt 0 ]; then
        echo "### 🚨 Immediate Actions Required"
        echo "- Schedule 1-on-1s with critical risk members"
        echo "- Review and redistribute workload immediately"
        echo "- Consider mandatory time off for affected members"
        echo ""
    fi
    
    if [ "$AT_RISK_USERS" -gt $((TOTAL_USERS / 3)) ]; then
        echo "### ⚠️ Systemic Issues Detected"
        echo "- Review team capacity and project deadlines"
        echo "- Implement flexible working hours"
        echo "- Establish 'no meeting' days"
        echo "- Create clear on-call rotation policies"
        echo ""
    fi
    
    echo "### 💡 Preventive Measures"
    echo "- Regular wellbeing check-ins"
    echo "- Promote use of vacation days"
    echo "- Establish clear work-hour expectations"
    echo "- Encourage open communication about workload"
    echo "- Implement pair programming for knowledge sharing"
    echo ""
    
    echo "---"
    echo "*This report is generated based on activity patterns and should be used as a guide for wellbeing discussions.*"
}

# 메인 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}             GitLab Burnout Risk Predictor                    ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Analysis Period: Last $ANALYSIS_DAYS days"
echo -e "⚠️  Warning Threshold: $WARNING_THRESHOLD/100"
echo -e "🚨 Critical Threshold: $CRITICAL_THRESHOLD/100"
echo ""

# 사용자 목록 가져오기
if [ -n "$GROUP_ID" ]; then
    echo "📁 Analyzing group ID: $GROUP_ID"
    MEMBERS=$(gitlab_api "GET" "/groups/$GROUP_ID/members/all?per_page=100")
else
    echo "🌐 Analyzing all active users"
    MEMBERS=$(gitlab_api "GET" "/users?active=true&per_page=100")
fi

if [ $? -ne 200 ]; then
    error_exit "Failed to fetch users" 2
fi

MEMBER_COUNT=$(echo "$MEMBERS" | jq 'length')
echo "👥 Analyzing $MEMBER_COUNT team members"
echo ""

# 각 사용자 분석
echo "🔍 Analyzing work patterns..."
CURRENT=0
echo "$MEMBERS" | jq -c '.[]' | while IFS= read -r member; do
    ((CURRENT++))
    show_progress "$CURRENT" "$MEMBER_COUNT" "Analyzing team members"
    
    user_id=$(echo "$member" | jq -r '.id')
    username=$(echo "$member" | jq -r '.username // .name')
    
    # 작업 패턴 분석
    analyze_work_patterns "$user_id" "$username"
    
    # 번아웃 점수 계산
    calculate_burnout_score "$user_id" "$username"
done

echo ""
echo ""

# 결과 출력
case "$OUTPUT_FORMAT" in
    json)
        # JSON 출력
        echo "{"
        echo "  \"summary\": {"
        echo "    \"total_users\": $TOTAL_USERS,"
        echo "    \"at_risk_users\": $AT_RISK_USERS,"
        echo "    \"critical_users\": $CRITICAL_USERS,"
        echo "    \"analysis_date\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
        echo "    \"analysis_days\": $ANALYSIS_DAYS"
        echo "  },"
        echo "  \"users\": ["
        
        for user_id in "${!USER_BURNOUT_SCORES[@]}"; do
            IFS='|' read -r username score <<< "${USER_BURNOUT_SCORES[$user_id]}"
            echo "    {"
            echo "      \"user_id\": $user_id,"
            echo "      \"username\": \"$username\","
            echo "      \"burnout_score\": $score,"
            echo "      \"risk_level\": \"$([ "$score" -ge "$CRITICAL_THRESHOLD" ] && echo "critical" || [ "$score" -ge "$WARNING_THRESHOLD" ] && echo "warning" || echo "low")\","
            echo "      \"risk_factors\": ["
            
            IFS='|' read -ra factors <<< "${USER_RISK_FACTORS[$user_id]}"
            for factor in "${factors[@]}"; do
                [ -n "$factor" ] && echo "        \"$factor\","
            done | sed '$ s/,$//'
            
            echo "      ]"
            echo "    },"
        done | sed '$ s/,$//'
        
        echo "  ]"
        echo "}"
        ;;
    
    report)
        # Markdown 리포트
        generate_team_report
        ;;
    
    *)
        # 콘솔 출력
        echo -e "${YELLOW}📊 Burnout Risk Analysis Summary${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 팀 건강도 개요
        local team_health_score=$((100 - (AT_RISK_USERS * 100 / (TOTAL_USERS + 1))))
        echo -e "Team Health Score: $(
            [ "$team_health_score" -ge 80 ] && echo -e "${GREEN}" ||
            [ "$team_health_score" -ge 60 ] && echo -e "${YELLOW}" ||
            echo -e "${RED}"
        )${team_health_score}/100${NC}"
        
        echo ""
        echo "Risk Distribution:"
        echo -e "   🔴 Critical Risk: ${RED}$CRITICAL_USERS${NC} members"
        echo -e "   🟡 At Risk: ${YELLOW}$((AT_RISK_USERS - CRITICAL_USERS))${NC} members"
        echo -e "   🟢 Healthy: ${GREEN}$((TOTAL_USERS - AT_RISK_USERS))${NC} members"
        echo ""
        
        # 고위험 사용자
        if [ "$CRITICAL_USERS" -gt 0 ]; then
            echo -e "${RED}🚨 Critical Risk Members${NC}"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            for user_id in "${!USER_BURNOUT_SCORES[@]}"; do
                IFS='|' read -r username score <<< "${USER_BURNOUT_SCORES[$user_id]}"
                [ "$score" -ge "$CRITICAL_THRESHOLD" ] || continue
                
                echo -e "${RED}👤 $username${NC} (Score: $score/100)"
                echo "   Risk Factors:"
                
                IFS='|' read -ra factors <<< "${USER_RISK_FACTORS[$user_id]}"
                for factor in "${factors[@]}"; do
                    [ -n "$factor" ] && echo "   • $factor"
                done
                
                echo "   Immediate Actions:"
                echo "   → Schedule 1-on-1 meeting"
                echo "   → Review current workload"
                echo "   → Consider immediate time off"
                echo ""
            done
        fi
        
        # 경고 수준 사용자
        local warning_users=$((AT_RISK_USERS - CRITICAL_USERS))
        if [ "$warning_users" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  Warning Level Members${NC}"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            for user_id in "${!USER_BURNOUT_SCORES[@]}"; do
                IFS='|' read -r username score <<< "${USER_BURNOUT_SCORES[$user_id]}"
                [ "$score" -ge "$WARNING_THRESHOLD" ] && [ "$score" -lt "$CRITICAL_THRESHOLD" ] || continue
                
                echo -e "${YELLOW}👤 $username${NC} (Score: $score/100)"
                
                # 주요 위험 요소만 표시
                IFS='|' read -ra factors <<< "${USER_RISK_FACTORS[$user_id]}"
                echo -n "   Main concerns: "
                local first=true
                for factor in "${factors[@]:0:2}"; do
                    if [ -n "$factor" ]; then
                        [ "$first" = false ] && echo -n ", "
                        echo -n "$factor"
                        first=false
                    fi
                done
                echo ""
            done
            echo ""
        fi
        
        # 팀 전체 패턴
        echo -e "${YELLOW}📈 Team-Wide Patterns${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 공통 위험 요소 분석
        declare -A COMMON_FACTORS
        for user_id in "${!USER_RISK_FACTORS[@]}"; do
            IFS='|' read -ra factors <<< "${USER_RISK_FACTORS[$user_id]}"
            for factor in "${factors[@]}"; do
                if [ -n "$factor" ]; then
                    factor_type=$(echo "$factor" | cut -d' ' -f1-2)
                    ((COMMON_FACTORS["$factor_type"]++))
                fi
            done
        done
        
        echo "Most Common Risk Factors:"
        for factor in "${!COMMON_FACTORS[@]}"; do
            count=${COMMON_FACTORS[$factor]}
            percentage=$((count * 100 / TOTAL_USERS))
            [ "$percentage" -gt 20 ] && echo "   • $factor: affecting $count members ($percentage%)"
        done
        echo ""
        
        # 권장사항
        echo -e "${YELLOW}💡 Team Wellbeing Recommendations${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        if [ "$CRITICAL_USERS" -gt 0 ]; then
            echo -e "${RED}Immediate Actions:${NC}"
            echo "• Schedule urgent 1-on-1s with critical risk members"
            echo "• Review and redistribute project assignments"
            echo "• Implement emergency workload reduction measures"
            echo ""
        fi
        
        if [ "$AT_RISK_USERS" -gt $((TOTAL_USERS / 4)) ]; then
            echo -e "${YELLOW}Systemic Improvements:${NC}"
            echo "• Review team capacity vs. commitments"
            echo "• Establish clear work-hour boundaries"
            echo "• Implement regular no-meeting days"
            echo "• Create sustainable on-call rotation"
            echo ""
        fi
        
        echo -e "${GREEN}Preventive Measures:${NC}"
        echo "• Monthly wellbeing check-ins"
        echo "• Encourage regular breaks and vacations"
        echo "• Promote flexible working arrangements"
        echo "• Foster open communication culture"
        echo "• Implement burnout prevention training"
        ;;
esac

# 알림 전송
if [ "$SEND_ALERTS" = true ] && [ "$CRITICAL_USERS" -gt 0 ]; then
    ALERT_FILE="$BASE_DIR/logs/burnout_alert_$(date +%Y%m%d_%H%M%S).txt"
    
    echo "URGENT: Burnout Risk Alert" > "$ALERT_FILE"
    echo "Date: $(date)" >> "$ALERT_FILE"
    echo "" >> "$ALERT_FILE"
    echo "$CRITICAL_USERS team members at critical burnout risk:" >> "$ALERT_FILE"
    
    for user_id in "${!USER_BURNOUT_SCORES[@]}"; do
        IFS='|' read -r username score <<< "${USER_BURNOUT_SCORES[$user_id]}"
        [ "$score" -ge "$CRITICAL_THRESHOLD" ] && echo "- $username (Score: $score/100)" >> "$ALERT_FILE"
    done
    
    echo "" >> "$ALERT_FILE"
    echo "Immediate intervention recommended." >> "$ALERT_FILE"
    
    log "WARN" "Critical burnout alerts saved to $ALERT_FILE"
    echo ""
    echo -e "${RED}⚠️  Alert file created: $ALERT_FILE${NC}"
fi

# 요약
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Burnout Risk Analysis Complete!${NC}"
echo -e "   🏥 Team Health: $([ "$team_health_score" -ge 80 ] && echo "Good" || [ "$team_health_score" -ge 60 ] && echo "Fair" || echo "Needs Attention")"
echo -e "   ⚠️  Action Required: $([ "$CRITICAL_USERS" -gt 0 ] && echo "Yes - $CRITICAL_USERS critical cases" || echo "Monitor $AT_RISK_USERS at-risk members")"
[ "$OUTPUT_FORMAT" = "report" ] || echo -e "   📄 Generate full report with: --format report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log "INFO" "Burnout risk analysis completed"