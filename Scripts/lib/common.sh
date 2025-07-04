#!/bin/bash

# 색상 정의
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# 로그 레벨
export LOG_LEVEL="${LOG_LEVEL:-INFO}"

# 로그 함수
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        ERROR)
            echo -e "${RED}[$timestamp] [ERROR] $message${NC}" >&2
            ;;
        WARN)
            echo -e "${YELLOW}[$timestamp] [WARN] $message${NC}" >&2
            ;;
        INFO)
            if [[ "$LOG_LEVEL" != "ERROR" && "$LOG_LEVEL" != "WARN" ]]; then
                echo -e "${GREEN}[$timestamp] [INFO] $message${NC}"
            fi
            ;;
        SUCCESS)
            if [[ "$LOG_LEVEL" != "ERROR" && "$LOG_LEVEL" != "WARN" ]]; then
                echo -e "${GREEN}[$timestamp] [SUCCESS] ✓ $message${NC}"
            fi
            ;;
        DRY-RUN)
            if [[ "$LOG_LEVEL" != "ERROR" && "$LOG_LEVEL" != "WARN" ]]; then
                echo -e "${BLUE}[$timestamp] [DRY-RUN] $message${NC}"
            fi
            ;;
        DEBUG)
            if [[ "$LOG_LEVEL" == "DEBUG" ]]; then
                echo -e "${BLUE}[$timestamp] [DEBUG] $message${NC}"
            fi
            ;;
    esac
    
    # 로그 파일에도 저장
    if [[ -n "$LOG_FILE" ]]; then
        echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    fi
}

# 에러 처리 함수
error_exit() {
    log ERROR "$1"
    exit "${2:-1}"
}

# 설정 파일 로드 함수
load_config() {
    local config_file="${1:-config/gitlab.env}"
    
    if [[ ! -f "$config_file" ]]; then
        error_exit "설정 파일을 찾을 수 없습니다: $config_file"
    fi
    
    source "$config_file"
    
    # 필수 환경 변수 확인
    if [[ -z "$GITLAB_URL" ]]; then
        error_exit "GITLAB_URL이 설정되지 않았습니다"
    fi
    
    if [[ -z "$GITLAB_TOKEN" ]]; then
        error_exit "GITLAB_TOKEN이 설정되지 않았습니다"
    fi
    
    log DEBUG "설정 파일 로드 완료: $config_file"
}

# Rate limiting variables
RATE_LIMIT_REMAINING=""
RATE_LIMIT_RESET=""
LAST_API_CALL=0
API_RETRY_COUNT=0
MAX_API_RETRIES=${MAX_API_RETRIES:-3}
API_RETRY_DELAY=${API_RETRY_DELAY:-2}

# GitLab API 호출 함수 (rate limiting 포함)
gitlab_api() {
    local method=$1
    local endpoint=$2
    local data=${3:-}
    
    local url="${GITLAB_URL}/api/v4${endpoint}"
    local curl_opts=(
        -s
        -w "\n%{http_code}"
        -X "$method"
        -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}"
        -D /tmp/gitlab_headers_$$
    )
    
    if [[ -n "$data" ]]; then
        curl_opts+=(-H "Content-Type: application/json" -d "$data")
    fi
    
    # Rate limiting delay
    local current_time=$(date +%s)
    local time_since_last=$((current_time - LAST_API_CALL))
    if [[ $time_since_last -lt 1 ]]; then
        sleep 0.5  # Minimum 500ms between calls
    fi
    
    log DEBUG "API 호출: $method $url"
    
    local attempt=1
    while [[ $attempt -le $MAX_API_RETRIES ]]; do
        local response=$(curl "${curl_opts[@]}" "$url" 2>/dev/null)
        local http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')
        
        # Parse rate limit headers
        if [[ -f /tmp/gitlab_headers_$$ ]]; then
            RATE_LIMIT_REMAINING=$(grep -i "^RateLimit-Remaining:" /tmp/gitlab_headers_$$ | awk '{print $2}' | tr -d '\r')
            RATE_LIMIT_RESET=$(grep -i "^RateLimit-Reset:" /tmp/gitlab_headers_$$ | awk '{print $2}' | tr -d '\r')
            rm -f /tmp/gitlab_headers_$$
        fi
        
        # Handle rate limiting (429) and server errors (5xx)
        if [[ $http_code -eq 429 ]]; then
            local wait_time=60  # Default wait time
            if [[ -n "$RATE_LIMIT_RESET" ]]; then
                wait_time=$((RATE_LIMIT_RESET - current_time + 1))
                if [[ $wait_time -lt 1 ]]; then
                    wait_time=60
                fi
            fi
            log WARN "Rate limit reached. Waiting ${wait_time}s..."
            sleep $wait_time
            ((attempt++))
            continue
        elif [[ $http_code -ge 500 ]] && [[ $http_code -lt 600 ]]; then
            if [[ $attempt -lt $MAX_API_RETRIES ]]; then
                local retry_wait=$((API_RETRY_DELAY * attempt))
                log WARN "Server error $http_code. Retrying in ${retry_wait}s... (attempt $attempt/$MAX_API_RETRIES)"
                sleep $retry_wait
                ((attempt++))
                continue
            fi
        fi
        
        # Success or client error - don't retry
        LAST_API_CALL=$(date +%s)
        
        # Log rate limit info if low
        if [[ -n "$RATE_LIMIT_REMAINING" ]] && [[ $RATE_LIMIT_REMAINING -lt 100 ]]; then
            log WARN "Rate limit remaining: $RATE_LIMIT_REMAINING"
        fi
        
        echo "$body"
        return $http_code
    done
    
    # All retries exhausted
    echo "$body"
    return $http_code
}

# 페이지네이션 처리 함수
gitlab_api_paginated() {
    local method=$1
    local endpoint=$2
    local per_page=${3:-100}
    
    local page=1
    local all_results="[]"
    
    while true; do
        local separator="?"
        if [[ "$endpoint" == *"?"* ]]; then
            separator="&"
        fi
        
        local response=$(gitlab_api "$method" "${endpoint}${separator}per_page=${per_page}&page=${page}")
        local http_code=$?
        
        if [[ $http_code -ne 200 ]]; then
            echo "$response"
            return $http_code
        fi
        
        if [[ "$response" == "[]" ]]; then
            break
        fi
        
        # jq를 사용하여 결과 병합
        if command -v jq &> /dev/null; then
            all_results=$(echo "$all_results" "$response" | jq -s 'add')
        else
            # jq가 없으면 단순히 마지막 페이지 결과만 반환
            all_results="$response"
            log WARN "jq가 설치되어 있지 않아 페이지네이션이 제한됩니다"
            break
        fi
        
        ((page++))
        
        # 안전장치: 100페이지 이상 조회하지 않음
        if [[ $page -gt 100 ]]; then
            log WARN "페이지네이션 제한에 도달했습니다 (100페이지)"
            break
        fi
    done
    
    echo "$all_results"
    return 0
}

# 확인 프롬프트 함수
confirm() {
    local message="$1"
    local default="${2:-n}"
    
    local prompt="$message"
    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi
    
    read -p "$prompt" response
    response=${response:-$default}
    
    [[ "$response" =~ ^[Yy]$ ]]
}

# 진행률 표시 함수
show_progress() {
    local current=$1
    local total=$2
    local task=${3:-"Processing"}
    
    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    local empty=$((50 - filled))
    
    printf "\r%s: [%s%s] %d%% (%d/%d)" \
        "$task" \
        "$(printf '=%.0s' $(seq 1 $filled))" \
        "$(printf ' %.0s' $(seq 1 $empty))" \
        "$percent" \
        "$current" \
        "$total"
    
    if [[ $current -eq $total ]]; then
        echo
    fi
}

# dry-run 모드 확인
is_dry_run() {
    [[ "${DRY_RUN:-false}" == "true" ]]
}

# 스크립트 초기화 함수
init_script() {
    local script_name=$(basename "$0")
    local log_dir="${LOG_DIR:-Scripts/logs}"
    
    # 로그 디렉토리 생성
    mkdir -p "$log_dir"
    
    # 로그 파일 설정
    export LOG_FILE="$log_dir/${script_name%.sh}_$(date +%Y%m%d_%H%M%S).log"
    
    log INFO "스크립트 시작: $script_name"
    
    # dry-run 모드 확인
    if is_dry_run; then
        log WARN "DRY-RUN 모드가 활성화되었습니다. 실제 변경사항은 적용되지 않습니다."
    fi
}

# Exponential backoff 함수
exponential_backoff() {
    local attempt=$1
    local max_wait=${2:-300}  # Maximum wait time in seconds (default: 5 minutes)
    
    # Calculate wait time: 2^attempt seconds, capped at max_wait
    local wait_time=$((2 ** attempt))
    if [[ $wait_time -gt $max_wait ]]; then
        wait_time=$max_wait
    fi
    
    # Add jitter (0-25% of wait time)
    local jitter=$((RANDOM % (wait_time / 4 + 1)))
    wait_time=$((wait_time + jitter))
    
    echo $wait_time
}

# Batch operation helper
batch_operation() {
    local operation_name=$1
    local -n items=$2  # Name reference to array
    local batch_size=${3:-10}
    local operation_func=$4
    
    local total=${#items[@]}
    local processed=0
    
    log INFO "Starting batch operation: $operation_name (Total: $total, Batch size: $batch_size)"
    
    for ((i=0; i<total; i+=batch_size)); do
        local batch_end=$((i + batch_size))
        if [[ $batch_end -gt $total ]]; then
            batch_end=$total
        fi
        
        log INFO "Processing batch $((i/batch_size + 1)) (items $((i+1))-$batch_end of $total)"
        
        for ((j=i; j<batch_end; j++)); do
            $operation_func "${items[$j]}" || true
            ((processed++))
            show_progress $processed $total "$operation_name"
        done
        
        # Rate limit between batches
        if [[ $batch_end -lt $total ]]; then
            sleep 1
        fi
    done
    
    log SUCCESS "$operation_name completed: $processed items processed"
}