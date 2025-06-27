#!/bin/bash

# 스크립트 디렉토리 경로
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# 공통 함수 로드
source "$BASE_DIR/lib/common.sh"
source "$BASE_DIR/lib/validation.sh"

# 도움말 함수
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

GitLab에서 그룹을 삭제합니다.

Options:
    --id <ID>              삭제할 그룹 ID (--id 또는 --path 중 하나 필수)
    --path <PATH>          삭제할 그룹 경로 (--id 또는 --path 중 하나 필수)
    --force                확인 없이 즉시 삭제
    --include-subgroups    하위 그룹도 함께 삭제
    --dry-run              실제로 삭제하지 않고 확인만
    -h, --help             이 도움말 표시

Examples:
    # ID로 그룹 삭제 (확인 프롬프트 표시)
    $0 --id 123
    
    # 경로로 그룹 삭제
    $0 --path my-group/sub-group
    
    # 하위 그룹 포함하여 강제 삭제
    $0 --id 123 --include-subgroups --force

주의: 그룹을 삭제하면 모든 프로젝트와 데이터가 영구적으로 삭제됩니다!
EOF
    exit 0
}

# 파라미터 파싱
GROUP_ID=""
GROUP_PATH=""
FORCE=false
INCLUDE_SUBGROUPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --id)
            GROUP_ID="$2"
            shift 2
            ;;
        --path)
            GROUP_PATH="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --include-subgroups)
            INCLUDE_SUBGROUPS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            log ERROR "알 수 없는 옵션: $1"
            show_help
            ;;
    esac
done

# 스크립트 초기화
init_script

# 설정 파일 로드
load_config "$BASE_DIR/config/gitlab.env"

# 그룹 정보 조회 함수
get_group_info() {
    local identifier="$1"
    local by_path="$2"
    
    local endpoint
    if [[ "$by_path" == "true" ]]; then
        # URL 인코딩
        local encoded_path=$(echo "$identifier" | sed 's/\//%2F/g')
        endpoint="/groups/$encoded_path"
    else
        endpoint="/groups/$identifier"
    fi
    
    local response=$(gitlab_api "GET" "$endpoint")
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        echo "$response"
        return 0
    else
        return 1
    fi
}

# 하위 그룹 조회 함수
get_subgroups() {
    local group_id="$1"
    
    local response=$(gitlab_api_paginated "GET" "/groups/$group_id/subgroups")
    local http_code=$?
    
    if [[ $http_code -eq 0 ]]; then
        echo "$response"
        return 0
    else
        return 1
    fi
}

# 그룹의 프로젝트 수 조회
get_project_count() {
    local group_id="$1"
    
    local response=$(gitlab_api "GET" "/groups/$group_id")
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        local project_count=$(echo "$response" | grep -o '"projects":\[[^]]*\]' | grep -o '{' | wc -l)
        echo "$project_count"
        return 0
    else
        echo "0"
        return 1
    fi
}

# 그룹 삭제 함수
delete_group() {
    local group_id="$1"
    local group_name="$2"
    local group_path="$3"
    
    log INFO "그룹 삭제 중: $group_name (ID: $group_id, 경로: $group_path)"
    
    if is_dry_run; then
        log INFO "[DRY-RUN] 삭제될 그룹: $group_name (ID: $group_id)"
        return 0
    fi
    
    local response=$(gitlab_api "DELETE" "/groups/$group_id")
    local http_code=$?
    
    if [[ $http_code -eq 202 ]] || [[ $http_code -eq 204 ]]; then
        log INFO "✓ 그룹 삭제 성공: $group_name"
        return 0
    else
        log ERROR "✗ 그룹 삭제 실패: $group_name"
        log ERROR "  상태 코드: $http_code"
        log ERROR "  응답: $response"
        return 1
    fi
}

# 메인 실행
if [[ -z "$GROUP_ID" ]] && [[ -z "$GROUP_PATH" ]]; then
    log ERROR "--id 또는 --path 옵션 중 하나는 필수입니다"
    show_help
fi

# 그룹 정보 조회
if [[ -n "$GROUP_PATH" ]]; then
    log INFO "그룹 정보 조회 중: $GROUP_PATH"
    group_info=$(get_group_info "$GROUP_PATH" "true")
else
    log INFO "그룹 정보 조회 중: ID $GROUP_ID"
    group_info=$(get_group_info "$GROUP_ID" "false")
fi

if [[ $? -ne 0 ]]; then
    error_exit "그룹을 찾을 수 없습니다"
fi

# 그룹 정보 파싱
GROUP_ID=$(echo "$group_info" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
GROUP_NAME=$(echo "$group_info" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
GROUP_PATH=$(echo "$group_info" | grep -o '"full_path":"[^"]*' | head -1 | cut -d'"' -f4)

log INFO "찾은 그룹: $GROUP_NAME (ID: $GROUP_ID, 경로: $GROUP_PATH)"

# 프로젝트 수 확인
project_count=$(get_project_count "$GROUP_ID")
log INFO "그룹 내 프로젝트 수: $project_count"

# 하위 그룹 확인
if [[ "$INCLUDE_SUBGROUPS" == "true" ]]; then
    subgroups=$(get_subgroups "$GROUP_ID")
    subgroup_count=$(echo "$subgroups" | grep -o '"id"' | wc -l)
    log INFO "하위 그룹 수: $subgroup_count"
fi

# 삭제 확인
if [[ "$FORCE" != "true" ]] && ! is_dry_run; then
    log WARN "경고: 이 작업은 되돌릴 수 없습니다!"
    log WARN "삭제될 내용:"
    log WARN "  - 그룹: $GROUP_NAME"
    log WARN "  - 프로젝트 수: $project_count"
    
    if [[ "$INCLUDE_SUBGROUPS" == "true" ]] && [[ $subgroup_count -gt 0 ]]; then
        log WARN "  - 하위 그룹 수: $subgroup_count"
    fi
    
    if ! confirm "정말로 삭제하시겠습니까?"; then
        log INFO "삭제가 취소되었습니다"
        exit 0
    fi
fi

# 하위 그룹 먼저 삭제 (필요한 경우)
if [[ "$INCLUDE_SUBGROUPS" == "true" ]] && [[ $subgroup_count -gt 0 ]]; then
    log INFO "하위 그룹 삭제 중..."
    
    echo "$subgroups" | jq -r '.[] | "\(.id)|\(.name)|\(.full_path)"' | while IFS='|' read -r sub_id sub_name sub_path; do
        delete_group "$sub_id" "$sub_name" "$sub_path"
    done
fi

# 메인 그룹 삭제
if delete_group "$GROUP_ID" "$GROUP_NAME" "$GROUP_PATH"; then
    log INFO "그룹 삭제 완료"
else
    error_exit "그룹 삭제 실패"
fi