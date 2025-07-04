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

그룹 ID 기반으로 프로젝트를 일괄 생성합니다.

Options:
    --from-file <FILE>     프로젝트 정의 파일 (필수)
    --skip-existing        이미 존재하는 프로젝트는 건너뛰기
    --dry-run              실제로 생성하지 않고 확인만
    -h, --help             이 도움말 표시

파일 형식 (projects-by-group.txt):
    # 프로젝트명|그룹ID|설명|가시성|이슈활성화|위키활성화|초기브랜치
    web-main|110|메인 웹사이트|private|true|true|main
    api-gateway|120|API 게이트웨이|internal|true|false|main

Examples:
    # 프로젝트 일괄 생성
    $0 --from-file projects-by-group.txt
    
    # 기존 프로젝트는 건너뛰고 새 프로젝트만 생성
    $0 --from-file projects-by-group.txt --skip-existing
    
    # dry-run으로 확인
    $0 --from-file projects-by-group.txt --dry-run
EOF
    exit 0
}

# 파라미터 파싱
FROM_FILE=""
SKIP_EXISTING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --from-file)
            FROM_FILE="$2"
            shift 2
            ;;
        --skip-existing)
            SKIP_EXISTING=true
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

# 필수 파라미터 확인
if [[ -z "$FROM_FILE" ]]; then
    log ERROR "--from-file은 필수 파라미터입니다"
    show_help
fi

if ! validate_file_path "$FROM_FILE"; then
    error_exit "파일을 찾을 수 없습니다: $FROM_FILE"
fi

# 프로젝트 존재 여부 확인 함수
check_project_exists() {
    local project_path="$1"
    local encoded_path=$(echo "$project_path" | sed 's/\//%2F/g')
    
    local response=$(gitlab_api "GET" "/projects/$encoded_path" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        local project_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        echo "$project_id"
        return 0
    else
        return 1
    fi
}

# 프로젝트 생성 함수
create_project() {
    local project_name="$1"
    local group_id="$2"
    local description="$3"
    local visibility="$4"
    local issues_enabled="${5:-true}"
    local wiki_enabled="${6:-false}"
    local default_branch="${7:-main}"
    
    # 입력값 검증
    if ! validate_project_name "$project_name"; then
        return 1
    fi
    
    if ! validate_group_id "$group_id"; then
        return 1
    fi
    
    if ! validate_visibility "$visibility"; then
        return 1
    fi
    
    # 그룹 정보 조회 (경로 확인용)
    local group_info=$(gitlab_api "GET" "/groups/$group_id")
    local http_code=$?
    
    if [[ $http_code -ne 200 ]]; then
        log ERROR "그룹을 찾을 수 없습니다: ID $group_id"
        return 1
    fi
    
    local group_path=$(echo "$group_info" | grep -o '"full_path":"[^"]*' | cut -d'"' -f4)
    local full_project_path="$group_path/$project_name"
    
    # 이미 존재하는지 확인
    if [[ "$SKIP_EXISTING" == "true" ]]; then
        local existing_id=$(check_project_exists "$full_project_path")
        if [[ -n "$existing_id" ]]; then
            log WARN "프로젝트가 이미 존재합니다: $full_project_path (ID: $existing_id)"
            return 0
        fi
    fi
    
    log INFO "프로젝트 생성 중: $project_name (그룹 ID: $group_id)"
    
    # JSON 데이터 생성
    local json_data=$(cat <<EOF
{
    "name": "$project_name",
    "path": "$project_name",
    "namespace_id": $group_id,
    "visibility": "$visibility",
    "issues_enabled": $issues_enabled,
    "wiki_enabled": $wiki_enabled,
    "initialize_with_readme": false,
    "default_branch": "$default_branch"
EOF
)
    
    if [[ -n "$description" ]]; then
        json_data+=",\n    \"description\": \"$description\""
    fi
    
    json_data+="\n}"
    
    if is_dry_run; then
        log INFO "[DRY-RUN] 생성할 프로젝트:"
        echo -e "$json_data" | jq . 2>/dev/null || echo -e "$json_data"
        return 0
    fi
    
    # GitLab API 호출
    local response=$(gitlab_api "POST" "/projects" "$json_data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]]; then
        local project_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        local web_url=$(echo "$response" | grep -o '"web_url":"[^"]*' | cut -d'"' -f4)
        log INFO "✓ 프로젝트 생성 성공: $project_name (ID: $project_id)"
        log DEBUG "  URL: $web_url"
        
        # 브랜치 보호 규칙 설정 (main 브랜치)
        if [[ "$default_branch" == "main" ]] || [[ "$default_branch" == "master" ]]; then
            setup_branch_protection "$project_id" "$default_branch"
        fi
        
        return 0
    else
        log ERROR "✗ 프로젝트 생성 실패: $project_name"
        log ERROR "  상태 코드: $http_code"
        log ERROR "  응답: $response"
        return 1
    fi
}

# 브랜치 보호 규칙 설정 함수
setup_branch_protection() {
    local project_id="$1"
    local branch_name="$2"
    
    # 기존 보호 규칙 삭제 (있을 경우)
    gitlab_api "DELETE" "/projects/$project_id/protected_branches/$branch_name" > /dev/null 2>&1
    
    # 새로운 보호 규칙 생성
    local json_data=$(cat <<EOF
{
    "name": "$branch_name",
    "push_access_level": 40,
    "merge_access_level": 30,
    "allow_force_push": false,
    "code_owner_approval_required": false
}
EOF
)
    
    local response=$(gitlab_api "POST" "/projects/$project_id/protected_branches" "$json_data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]] || [[ $http_code -eq 409 ]]; then
        log DEBUG "  브랜치 보호 규칙 설정 완료: $branch_name"
        return 0
    else
        log WARN "  브랜치 보호 규칙 설정 실패: $branch_name"
        return 1
    fi
}

# 메인 실행
log INFO "프로젝트 정의 파일 읽기: $FROM_FILE"

# 통계
total_count=0
success_count=0
failed_count=0
skipped_count=0

# 그룹별 프로젝트 수 집계
declare -A group_project_count

# 파일 읽기
while IFS='|' read -r project_name group_id description visibility issues_enabled wiki_enabled default_branch || [[ -n "$project_name" ]]; do
    # 주석과 빈 줄 건너뛰기
    [[ -z "$project_name" || "$project_name" =~ ^[[:space:]]*# ]] && continue
    
    ((total_count++))
    
    # 공백 제거
    project_name=$(echo "$project_name" | xargs)
    group_id=$(echo "$group_id" | xargs)
    description=$(echo "$description" | xargs)
    visibility=$(echo "$visibility" | xargs)
    issues_enabled=$(echo "$issues_enabled" | xargs)
    wiki_enabled=$(echo "$wiki_enabled" | xargs)
    default_branch=$(echo "$default_branch" | xargs)
    
    # 기본값 설정
    visibility=${visibility:-private}
    issues_enabled=${issues_enabled:-true}
    wiki_enabled=${wiki_enabled:-false}
    default_branch=${default_branch:-main}
    
    # 그룹별 카운트
    group_project_count[$group_id]=$((${group_project_count[$group_id]:-0} + 1))
    
    # 프로젝트 생성
    if create_project "$project_name" "$group_id" "$description" "$visibility" "$issues_enabled" "$wiki_enabled" "$default_branch"; then
        ((success_count++))
    else
        ((failed_count++))
    fi
    
    show_progress $((success_count + failed_count)) $total_count "프로젝트 생성"
done < "$FROM_FILE"

echo

# 결과 요약
log INFO "================================"
log INFO "프로젝트 생성 완료"
log INFO "================================"
log INFO "총 프로젝트 수: $total_count"
log INFO "생성 성공: $success_count"
log INFO "생성 실패: $failed_count"

# 그룹별 통계
if [[ ${#group_project_count[@]} -gt 0 ]]; then
    log INFO ""
    log INFO "그룹별 프로젝트 수:"
    for group_id in "${!group_project_count[@]}"; do
        log INFO "  그룹 ID $group_id: ${group_project_count[$group_id]}개"
    done
fi

if [[ $failed_count -gt 0 ]]; then
    log WARN "일부 프로젝트 생성에 실패했습니다. 로그를 확인하세요."
fi