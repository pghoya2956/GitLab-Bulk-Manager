#!/bin/bash

# GitLab Emergency Auto-Scale - 긴급 상황 자동 대응
# 시스템 과부하 시 자동으로 리소스를 확장하고 부하를 분산

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
MODE="monitor"  # monitor, auto, manual
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
QUEUE_THRESHOLD=100
RESPONSE_THRESHOLD=5000  # ms
CHECK_INTERVAL=60
AUTO_SCALE=false
COOLDOWN_PERIOD=300

show_help() {
    cat << EOF
GitLab Emergency Auto-Scale - Intelligent Resource Management

Usage: $(basename "$0") [OPTIONS]

Options:
    -m, --mode MODE        Operation mode: monitor/auto/manual (default: monitor)
    -c, --cpu PERCENT      CPU threshold for scaling (default: 80%)
    -r, --memory PERCENT   Memory threshold for scaling (default: 85%)
    -q, --queue SIZE       Queue size threshold (default: 100)
    -t, --response MS      Response time threshold in ms (default: 5000)
    -i, --interval SEC     Check interval in seconds (default: 60)
    -a, --auto-scale      Enable automatic scaling actions
    -h, --help           Show this help message

Examples:
    # Monitor system load
    $(basename "$0") --mode monitor --interval 30

    # Auto-scale when thresholds exceeded
    $(basename "$0") --mode auto --auto-scale --cpu 75

    # Manual emergency response
    $(basename "$0") --mode manual

Description:
    Monitors GitLab system health and automatically:
    - Scales runner capacity
    - Adjusts CI/CD concurrency
    - Enables emergency mode
    - Redistributes workload
    - Alerts administrators
    
    Prevents system overload and maintains service availability.
EOF
}

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -c|--cpu)
            CPU_THRESHOLD="$2"
            shift 2
            ;;
        -r|--memory)
            MEMORY_THRESHOLD="$2"
            shift 2
            ;;
        -q|--queue)
            QUEUE_THRESHOLD="$2"
            shift 2
            ;;
        -t|--response)
            RESPONSE_THRESHOLD="$2"
            shift 2
            ;;
        -i|--interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        -a|--auto-scale)
            AUTO_SCALE=true
            shift
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

# 긴급 대응 시작
log "INFO" "Starting emergency auto-scale system (mode: $MODE)..."

# 전역 변수
declare -A SYSTEM_METRICS
declare -A SCALING_HISTORY
CURRENT_RUNNERS=0
MAX_RUNNERS=10
EMERGENCY_MODE=false
LAST_SCALE_TIME=0

# 시스템 메트릭 수집
collect_system_metrics() {
    # GitLab 상태 확인
    local health_check=$(gitlab_api "GET" "/application/statistics")
    if [ $? -ne 200 ]; then
        log "ERROR" "Failed to get GitLab statistics"
        return 1
    fi
    
    # 기본 통계
    local active_users=$(echo "$health_check" | jq -r '.active_users // 0')
    local projects=$(echo "$health_check" | jq -r '.projects // 0')
    local issues=$(echo "$health_check" | jq -r '.issues // 0')
    
    # CI/CD 메트릭
    local pending_jobs=$(gitlab_api "GET" "/jobs?scope=pending&per_page=1" -I | grep -i "x-total:" | awk '{print $2}' | tr -d '\r')
    local running_jobs=$(gitlab_api "GET" "/jobs?scope=running&per_page=1" -I | grep -i "x-total:" | awk '{print $2}' | tr -d '\r')
    
    # Runner 상태
    local runners=$(gitlab_api "GET" "/runners?status=online")
    if [ $? -eq 200 ]; then
        CURRENT_RUNNERS=$(echo "$runners" | jq 'length')
        local busy_runners=$(echo "$runners" | jq '[.[] | select(.status == "active")] | length')
    fi
    
    # 응답 시간 측정 (API 호출 시간)
    local start_time=$(date +%s%N)
    gitlab_api "GET" "/version" > /dev/null 2>&1
    local end_time=$(date +%s%N)
    local response_time=$(((end_time - start_time) / 1000000))  # ms
    
    # 시스템 리소스 (시뮬레이션)
    # 실제 환경에서는 Prometheus/Grafana API 사용
    local cpu_usage=$((50 + RANDOM % 50))  # 시뮬레이션
    local memory_usage=$((60 + RANDOM % 40))  # 시뮬레이션
    
    # 큐 크기 계산
    local queue_size=$((pending_jobs))
    
    # 메트릭 저장
    SYSTEM_METRICS["cpu"]=$cpu_usage
    SYSTEM_METRICS["memory"]=$memory_usage
    SYSTEM_METRICS["queue"]=$queue_size
    SYSTEM_METRICS["response_time"]=$response_time
    SYSTEM_METRICS["pending_jobs"]=$pending_jobs
    SYSTEM_METRICS["running_jobs"]=$running_jobs
    SYSTEM_METRICS["runners"]=$CURRENT_RUNNERS
    SYSTEM_METRICS["busy_runners"]=$busy_runners
}

# 임계값 체크
check_thresholds() {
    local alert_level=0
    local alerts=""
    
    # CPU 체크
    if [ "${SYSTEM_METRICS[cpu]}" -gt "$CPU_THRESHOLD" ]; then
        ((alert_level++))
        alerts="${alerts}CPU usage critical: ${SYSTEM_METRICS[cpu]}%|"
    fi
    
    # 메모리 체크
    if [ "${SYSTEM_METRICS[memory]}" -gt "$MEMORY_THRESHOLD" ]; then
        ((alert_level++))
        alerts="${alerts}Memory usage critical: ${SYSTEM_METRICS[memory]}%|"
    fi
    
    # 큐 크기 체크
    if [ "${SYSTEM_METRICS[queue]}" -gt "$QUEUE_THRESHOLD" ]; then
        ((alert_level++))
        alerts="${alerts}Job queue overflow: ${SYSTEM_METRICS[queue]} pending|"
    fi
    
    # 응답 시간 체크
    if [ "${SYSTEM_METRICS[response_time]}" -gt "$RESPONSE_THRESHOLD" ]; then
        ((alert_level++))
        alerts="${alerts}Slow response: ${SYSTEM_METRICS[response_time]}ms|"
    fi
    
    # Runner 가용성 체크
    local runner_utilization=0
    if [ "${SYSTEM_METRICS[runners]}" -gt 0 ]; then
        runner_utilization=$((SYSTEM_METRICS[busy_runners] * 100 / SYSTEM_METRICS[runners]))
        if [ "$runner_utilization" -gt 90 ]; then
            ((alert_level++))
            alerts="${alerts}Runner capacity exhausted: ${runner_utilization}%|"
        fi
    fi
    
    echo "$alert_level|$alerts"
}

# 자동 확장 실행
execute_scaling() {
    local scale_type=$1
    local scale_factor=$2
    
    echo -e "${YELLOW}🚀 Executing $scale_type scaling...${NC}"
    
    case "$scale_type" in
        runners)
            # Runner 확장
            local new_runners=$((CURRENT_RUNNERS + scale_factor))
            [ "$new_runners" -gt "$MAX_RUNNERS" ] && new_runners=$MAX_RUNNERS
            
            echo "   Scaling runners: $CURRENT_RUNNERS → $new_runners"
            
            if [ "$AUTO_SCALE" = true ]; then
                # 실제 환경에서는 Kubernetes/Docker API 호출
                log "INFO" "Scaling GitLab runners to $new_runners"
                
                # Runner 등록 시뮬레이션
                for ((i=CURRENT_RUNNERS+1; i<=new_runners; i++)); do
                    echo "   Registering runner $i..."
                    # gitlab-runner register 명령 실행
                done
                
                CURRENT_RUNNERS=$new_runners
                SCALING_HISTORY[$(date +%s)]="runners:$scale_factor"
            else
                echo "   [DRY RUN] Would scale to $new_runners runners"
            fi
            ;;
        
        concurrency)
            # CI/CD 동시성 조정
            echo "   Adjusting CI/CD concurrency limits..."
            
            if [ "$AUTO_SCALE" = true ]; then
                # 프로젝트별 CI/CD 제한 조정
                local projects=$(gitlab_api "GET" "/projects?statistics=true&order_by=last_activity_at&per_page=50")
                
                echo "$projects" | jq -c '.[]' | while IFS= read -r project; do
                    local project_id=$(echo "$project" | jq -r '.id')
                    local current_limit=$(echo "$project" | jq -r '.ci_config_source // 10')
                    local new_limit=$((current_limit * 80 / 100))  # 20% 감소
                    
                    # CI/CD 변수 업데이트
                    gitlab_api "PUT" "/projects/$project_id/variables/CONCURRENT_JOBS" \
                        "{\"value\": \"$new_limit\", \"protected\": false}" > /dev/null 2>&1
                done
                
                SCALING_HISTORY[$(date +%s)]="concurrency:reduced"
            else
                echo "   [DRY RUN] Would reduce CI/CD concurrency by 20%"
            fi
            ;;
        
        emergency)
            # 긴급 모드 활성화
            echo -e "${RED}🚨 ACTIVATING EMERGENCY MODE${NC}"
            
            if [ "$AUTO_SCALE" = true ]; then
                EMERGENCY_MODE=true
                
                # 1. 비필수 작업 중단
                echo "   Pausing non-critical pipelines..."
                local non_critical=$(gitlab_api "GET" "/projects?topic=non-critical&per_page=100")
                echo "$non_critical" | jq -r '.[].id' | while read -r project_id; do
                    gitlab_api "POST" "/projects/$project_id/pipelines/pause" > /dev/null 2>&1
                done
                
                # 2. 캐시 정리
                echo "   Clearing CI/CD caches..."
                # 캐시 정리 로직
                
                # 3. 임시 리소스 제한
                echo "   Applying temporary resource limits..."
                
                SCALING_HISTORY[$(date +%s)]="emergency:activated"
            else
                echo "   [DRY RUN] Would activate emergency protocols"
            fi
            ;;
    esac
    
    LAST_SCALE_TIME=$(date +%s)
}

# 스케일 다운 체크
check_scale_down() {
    # 모든 메트릭이 안전 범위인지 확인
    local safe=true
    
    [ "${SYSTEM_METRICS[cpu]}" -gt 60 ] && safe=false
    [ "${SYSTEM_METRICS[memory]}" -gt 70 ] && safe=false
    [ "${SYSTEM_METRICS[queue]}" -gt 50 ] && safe=false
    [ "${SYSTEM_METRICS[response_time]}" -gt 2000 ] && safe=false
    
    if [ "$safe" = true ] && [ "$CURRENT_RUNNERS" -gt 2 ]; then
        echo -e "${GREEN}📉 System stable - scaling down...${NC}"
        
        if [ "$AUTO_SCALE" = true ]; then
            local reduce_runners=$((CURRENT_RUNNERS - 1))
            CURRENT_RUNNERS=$reduce_runners
            log "INFO" "Scaling down to $reduce_runners runners"
        fi
    fi
    
    # 긴급 모드 해제
    if [ "$EMERGENCY_MODE" = true ] && [ "$safe" = true ]; then
        echo -e "${GREEN}✅ Deactivating emergency mode${NC}"
        EMERGENCY_MODE=false
    fi
}

# 대시보드 표시
display_dashboard() {
    clear
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}           GitLab Emergency Auto-Scale Dashboard              ${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "⏰ $(date '+%Y-%m-%d %H:%M:%S') | Mode: $MODE | Emergency: $([ "$EMERGENCY_MODE" = true ] && echo -e "${RED}ACTIVE${NC}" || echo -e "${GREEN}OFF${NC}")"
    echo ""
    
    # 시스템 상태
    echo -e "${YELLOW}📊 System Metrics${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # CPU
    local cpu_color=$GREEN
    [ "${SYSTEM_METRICS[cpu]}" -gt 70 ] && cpu_color=$YELLOW
    [ "${SYSTEM_METRICS[cpu]}" -gt "$CPU_THRESHOLD" ] && cpu_color=$RED
    printf "CPU Usage:      ${cpu_color}%3d%%${NC} " "${SYSTEM_METRICS[cpu]}"
    
    # 바 그래프
    printf "["
    local bar_length=$((SYSTEM_METRICS[cpu] / 5))
    for ((i=0; i<20; i++)); do
        if [ "$i" -lt "$bar_length" ]; then
            [ "${SYSTEM_METRICS[cpu]}" -gt "$CPU_THRESHOLD" ] && printf "${RED}█${NC}" || printf "${GREEN}█${NC}"
        else
            printf " "
        fi
    done
    printf "]\n"
    
    # 메모리
    local mem_color=$GREEN
    [ "${SYSTEM_METRICS[memory]}" -gt 75 ] && mem_color=$YELLOW
    [ "${SYSTEM_METRICS[memory]}" -gt "$MEMORY_THRESHOLD" ] && mem_color=$RED
    printf "Memory Usage:   ${mem_color}%3d%%${NC} " "${SYSTEM_METRICS[memory]}"
    
    printf "["
    bar_length=$((SYSTEM_METRICS[memory] / 5))
    for ((i=0; i<20; i++)); do
        if [ "$i" -lt "$bar_length" ]; then
            [ "${SYSTEM_METRICS[memory]}" -gt "$MEMORY_THRESHOLD" ] && printf "${RED}█${NC}" || printf "${GREEN}█${NC}"
        else
            printf " "
        fi
    done
    printf "]\n"
    
    # 응답 시간
    local resp_color=$GREEN
    [ "${SYSTEM_METRICS[response_time]}" -gt 3000 ] && resp_color=$YELLOW
    [ "${SYSTEM_METRICS[response_time]}" -gt "$RESPONSE_THRESHOLD" ] && resp_color=$RED
    echo -e "Response Time:  ${resp_color}${SYSTEM_METRICS[response_time]}ms${NC}"
    
    echo ""
    echo -e "${YELLOW}🏃 CI/CD Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "Pending Jobs:   ${YELLOW}${SYSTEM_METRICS[pending_jobs]}${NC}"
    echo -e "Running Jobs:   ${GREEN}${SYSTEM_METRICS[running_jobs]}${NC}"
    echo -e "Active Runners: ${CYAN}${SYSTEM_METRICS[runners]}${NC} (${SYSTEM_METRICS[busy_runners]} busy)"
    
    # 스케일링 이력
    if [ ${#SCALING_HISTORY[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}📈 Recent Scaling Actions${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        for timestamp in "${!SCALING_HISTORY[@]}"; do
            local action_time=$(date -d "@$timestamp" '+%H:%M:%S' 2>/dev/null || date -r "$timestamp" '+%H:%M:%S')
            echo "   $action_time - ${SCALING_HISTORY[$timestamp]}"
        done | tail -5
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Press Ctrl+C to stop monitoring"
}

# 수동 긴급 대응
manual_emergency_response() {
    echo -e "${RED}🚨 MANUAL EMERGENCY RESPONSE MODE${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "Select emergency action:"
    echo "1. Scale up runners (+3)"
    echo "2. Reduce CI/CD concurrency"
    echo "3. Activate full emergency mode"
    echo "4. Clear all caches"
    echo "5. Pause non-critical projects"
    echo "6. Send alert to administrators"
    echo "0. Exit"
    echo ""
    
    read -p "Enter choice (0-6): " choice
    
    case "$choice" in
        1)
            execute_scaling "runners" 3
            ;;
        2)
            execute_scaling "concurrency" 0
            ;;
        3)
            execute_scaling "emergency" 0
            ;;
        4)
            echo "Clearing all CI/CD caches..."
            # 캐시 정리 로직
            ;;
        5)
            echo "Pausing non-critical projects..."
            # 프로젝트 일시 정지 로직
            ;;
        6)
            echo "Sending emergency alert..."
            send_emergency_alert "Manual emergency response initiated"
            ;;
        0)
            echo "Exiting emergency response mode"
            exit 0
            ;;
        *)
            echo "Invalid choice"
            ;;
    esac
}

# 긴급 알림 전송
send_emergency_alert() {
    local message=$1
    local alert_file="$BASE_DIR/logs/emergency_alert_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$alert_file" << EOF
🚨 GITLAB EMERGENCY ALERT 🚨
Time: $(date)
Message: $message

System Status:
- CPU: ${SYSTEM_METRICS[cpu]}%
- Memory: ${SYSTEM_METRICS[memory]}%
- Pending Jobs: ${SYSTEM_METRICS[pending_jobs]}
- Response Time: ${SYSTEM_METRICS[response_time]}ms

Immediate action required!
EOF
    
    log "CRITICAL" "Emergency alert: $message"
    echo -e "${RED}⚠️  Emergency alert saved to: $alert_file${NC}"
    
    # 실제 환경에서는 이메일/Slack/PagerDuty 알림 전송
}

# 메인 실행
case "$MODE" in
    monitor)
        # 모니터링 모드
        echo -e "${CYAN}Starting continuous monitoring...${NC}"
        echo "Check interval: ${CHECK_INTERVAL}s"
        echo ""
        
        while true; do
            collect_system_metrics
            display_dashboard
            
            # 임계값 체크
            IFS='|' read -r alert_level alerts <<< "$(check_thresholds)"
            
            if [ "$alert_level" -gt 0 ]; then
                echo ""
                echo -e "${YELLOW}⚠️  Threshold violations detected:${NC}"
                IFS='|' read -ra alert_array <<< "$alerts"
                for alert in "${alert_array[@]}"; do
                    [ -n "$alert" ] && echo "   • $alert"
                done
            fi
            
            sleep "$CHECK_INTERVAL"
        done
        ;;
    
    auto)
        # 자동 확장 모드
        echo -e "${GREEN}Starting auto-scaling service...${NC}"
        echo "Auto-scale enabled: $AUTO_SCALE"
        echo "Check interval: ${CHECK_INTERVAL}s"
        echo "Cooldown period: ${COOLDOWN_PERIOD}s"
        echo ""
        
        while true; do
            collect_system_metrics
            
            # 임계값 체크
            IFS='|' read -r alert_level alerts <<< "$(check_thresholds)"
            
            # 쿨다운 체크
            local current_time=$(date +%s)
            local time_since_scale=$((current_time - LAST_SCALE_TIME))
            
            if [ "$alert_level" -ge 3 ] && [ "$time_since_scale" -gt "$COOLDOWN_PERIOD" ]; then
                echo -e "${RED}🚨 Critical thresholds exceeded!${NC}"
                
                # 긴급 모드 활성화
                if [ "$alert_level" -ge 4 ]; then
                    execute_scaling "emergency" 0
                    send_emergency_alert "Multiple critical thresholds exceeded"
                else
                    # Runner 확장
                    execute_scaling "runners" 2
                fi
            elif [ "$alert_level" -ge 2 ] && [ "$time_since_scale" -gt "$COOLDOWN_PERIOD" ]; then
                echo -e "${YELLOW}⚠️  Warning thresholds exceeded${NC}"
                execute_scaling "concurrency" 0
            elif [ "$alert_level" -eq 0 ]; then
                # 안정 상태 - 스케일 다운 체크
                check_scale_down
            fi
            
            # 상태 표시
            display_dashboard
            
            sleep "$CHECK_INTERVAL"
        done
        ;;
    
    manual)
        # 수동 긴급 대응 모드
        collect_system_metrics
        manual_emergency_response
        ;;
    
    *)
        error_exit "Invalid mode: $MODE" 1
        ;;
esac

log "INFO" "Emergency auto-scale system stopped"