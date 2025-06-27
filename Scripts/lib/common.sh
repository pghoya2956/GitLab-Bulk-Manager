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

# GitLab API 호출 함수
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
    )
    
    if [[ -n "$data" ]]; then
        curl_opts+=(-H "Content-Type: application/json" -d "$data")
    fi
    
    log DEBUG "API 호출: $method $url"
    
    local response=$(curl "${curl_opts[@]}" "$url")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
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