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

GitLab에서 프로젝트를 삭제합니다.

Options:
    --id <ID>              삭제할 프로젝트 ID (--id 또는 --path 중 하나 필수)
    --path <PATH>          삭제할 프로젝트 경로 (--id 또는 --path 중 하나 필수)
    --group-id <ID>        그룹 내 모든 프로젝트 삭제
    --from-file <FILE>     파일에서 프로젝트 목록 읽기
    --force                확인 없이 즉시 삭제
    --dry-run              실제로 삭제하지 않고 확인만
    -h, --help             이 도움말 표시

Examples:
    # ID로 프로젝트 삭제 (확인 프롬프트 표시)
    $0 --id 456
    
    # 경로로 프로젝트 삭제
    $0 --path my-group/my-project
    
    # 그룹 내 모든 프로젝트 강제 삭제
    $0 --group-id 123 --force
    
    # 파일에서 여러 프로젝트 삭제
    $0 --from-file projects-to-delete.txt

파일 형식 (projects-to-delete.txt):
    # 프로젝트 ID 또는 경로 (한 줄에 하나씩)
    123
    456
    my-group/project-1
    my-group/project-2

주의: 프로젝트를 삭제하면 모든 코드, 이슈, MR 등이 영구적으로 삭제됩니다!
EOF
    exit 0
}

# 파라미터 파싱
PROJECT_ID=""
PROJECT_PATH=""
GROUP_ID=""
FROM_FILE=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --id)
            PROJECT_ID="$2"
            shift 2
            ;;
        --path)
            PROJECT_PATH="$2"
            shift 2
            ;;
        --group-id)
            GROUP_ID="$2"
            shift 2
            ;;
        --from-file)
            FROM_FILE="$2"
            shift 2
            ;;
        --force)
            FORCE=true
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

# 프로젝트 정보 조회 함수
get_project_info() {
    local identifier="$1"
    local by_path="$2"
    
    local endpoint
    if [[ "$by_path" == "true" ]]; then
        # URL 인코딩
        local encoded_path=$(echo "$identifier" | sed 's/\//%2F/g')
        endpoint="/projects/$encoded_path"
    else
        endpoint="/projects/$identifier"
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

# 그룹의 프로젝트 목록 조회
get_group_projects() {
    local group_id="$1"
    
    local response=$(gitlab_api_paginated "GET" "/groups/$group_id/projects")
    local http_code=$?
    
    if [[ $http_code -eq 0 ]]; then
        echo "$response"
        return 0
    else
        return 1
    fi
}

# 프로젝트 삭제 함수
delete_project() {
    local project_id="$1"
    local project_name="$2"
    local project_path="$3"
    
    log INFO "프로젝트 삭제 중: $project_name (ID: $project_id, 경로: $project_path)"
    
    if is_dry_run; then
        log INFO "[DRY-RUN] 삭제될 프로젝트: $project_name (ID: $project_id)"
        return 0
    fi
    
    local response=$(gitlab_api "DELETE" "/projects/$project_id")
    local http_code=$?
    
    if [[ $http_code -eq 202 ]] || [[ $http_code -eq 204 ]]; then
        log INFO "✓ 프로젝트 삭제 성공: $project_name"
        return 0
    else
        log ERROR "✗ 프로젝트 삭제 실패: $project_name"
        log ERROR "  상태 코드: $http_code"
        log ERROR "  응답: $response"
        return 1
    fi
}

# 프로젝트 삭제 처리 함수
process_project_deletion() {
    local identifier="$1"
    local by_path="$2"
    
    # 프로젝트 정보 조회
    local project_info
    if [[ "$by_path" == "true" ]]; then
        project_info=$(get_project_info "$identifier" "true")
    else
        project_info=$(get_project_info "$identifier" "false")
    fi
    
    if [[ $? -ne 0 ]]; then
        log ERROR "프로젝트를 찾을 수 없습니다: $identifier"
        return 1
    fi
    
    # 프로젝트 정보 파싱
    local id=$(echo "$project_info" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
    local name=$(echo "$project_info" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
    local path=$(echo "$project_info" | grep -o '"path_with_namespace":"[^"]*' | head -1 | cut -d'"' -f4)
    
    # 삭제 확인
    if [[ "$FORCE" != "true" ]] && ! is_dry_run; then
        log WARN "삭제될 프로젝트: $name (ID: $id, 경로: $path)"
        if ! confirm "정말로 삭제하시겠습니까?"; then
            log INFO "삭제가 취소되었습니다"
            return 0
        fi
    fi
    
    # 프로젝트 삭제
    delete_project "$id" "$name" "$path"
}

# 메인 실행
total_count=0
success_count=0
failed_count=0

if [[ -n "$FROM_FILE" ]]; then
    # 파일에서 읽기
    if ! validate_file_path "$FROM_FILE"; then
        error_exit "파일을 찾을 수 없습니다: $FROM_FILE"
    fi
    
    log INFO "파일에서 프로젝트 목록 읽기: $FROM_FILE"
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        # 주석과 빈 줄 건너뛰기
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        
        ((total_count++))
        
        # 숫자인 경우 ID로, 아니면 경로로 처리
        if is_number "$line"; then
            if process_project_deletion "$line" "false"; then
                ((success_count++))
            else
                ((failed_count++))
            fi
        else
            if process_project_deletion "$line" "true"; then
                ((success_count++))
            else
                ((failed_count++))
            fi
        fi
        
        show_progress $total_count $total_count "프로젝트 삭제"
    done < "$FROM_FILE"
    
elif [[ -n "$GROUP_ID" ]]; then
    # 그룹 내 모든 프로젝트 삭제
    log INFO "그룹 $GROUP_ID의 모든 프로젝트 조회 중..."
    
    projects=$(get_group_projects "$GROUP_ID")
    if [[ $? -ne 0 ]]; then
        error_exit "그룹의 프로젝트 목록을 조회할 수 없습니다"
    fi
    
    project_count=$(echo "$projects" | jq '. | length')
    log INFO "삭제할 프로젝트 수: $project_count"
    
    if [[ $project_count -eq 0 ]]; then
        log INFO "그룹에 프로젝트가 없습니다"
        exit 0
    fi
    
    # 삭제 확인
    if [[ "$FORCE" != "true" ]] && ! is_dry_run; then
        log WARN "경고: 그룹 $GROUP_ID의 모든 프로젝트($project_count개)가 삭제됩니다!"
        if ! confirm "정말로 삭제하시겠습니까?"; then
            log INFO "삭제가 취소되었습니다"
            exit 0
        fi
    fi
    
    # 각 프로젝트 삭제
    echo "$projects" | jq -r '.[] | "\(.id)|\(.name)|\(.path_with_namespace)"' | while IFS='|' read -r id name path; do
        ((total_count++))
        
        if delete_project "$id" "$name" "$path"; then
            ((success_count++))
        else
            ((failed_count++))
        fi
        
        show_progress $total_count $project_count "프로젝트 삭제"
    done
    
else
    # 단일 프로젝트 삭제
    if [[ -z "$PROJECT_ID" ]] && [[ -z "$PROJECT_PATH" ]]; then
        log ERROR "--id, --path, --group-id, --from-file 중 하나는 필수입니다"
        show_help
    fi
    
    if [[ -n "$PROJECT_PATH" ]]; then
        process_project_deletion "$PROJECT_PATH" "true"
    else
        process_project_deletion "$PROJECT_ID" "false"
    fi
    
    if [[ $? -eq 0 ]]; then
        ((success_count++))
    else
        ((failed_count++))
    fi
    
    total_count=1
fi

# 결과 요약
if [[ $total_count -gt 1 ]]; then
    log INFO "완료: 총 ${total_count}개 중 ${success_count}개 성공, ${failed_count}개 실패"
fi