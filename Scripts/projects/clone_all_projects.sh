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

GitLab 그룹의 모든 프로젝트를 클론합니다.

Options:
    --group-id <ID>        클론할 그룹 ID (필수)
    --output-dir <DIR>     클론할 디렉토리 (기본값: ./gitlab-clones/<group-name>)
    --clone-type <TYPE>    클론 방식 (ssh, http, https) (기본값: ssh)
    --include-archived     아카이브된 프로젝트도 포함
    --shallow              shallow clone 수행 (히스토리 제한)
    --branch <BRANCH>      특정 브랜치만 클론
    --parallel <N>         동시 클론 개수 (기본값: 5)
    --update-existing      이미 존재하는 저장소는 pull로 업데이트
    --dry-run              실제로 클론하지 않고 확인만
    -h, --help             이 도움말 표시

Examples:
    # 그룹의 모든 프로젝트를 SSH로 클론
    $0 --group-id 123
    
    # HTTPS로 특정 디렉토리에 클론
    $0 --group-id 123 --clone-type https --output-dir /backup/gitlab
    
    # main 브랜치만 shallow clone (10개씩 병렬)
    $0 --group-id 123 --branch main --shallow --parallel 10
    
    # 기존 저장소 업데이트
    $0 --group-id 123 --update-existing

디렉토리 구조:
    <output-dir>/
    ├── <group-name>/
    │   ├── <project-1>/
    │   ├── <project-2>/
    │   └── <subgroup>/
    │       └── <project-3>/
EOF
    exit 0
}

# 파라미터 파싱
GROUP_ID=""
OUTPUT_DIR=""
CLONE_TYPE="ssh"
INCLUDE_ARCHIVED=false
SHALLOW=false
BRANCH=""
PARALLEL=5
UPDATE_EXISTING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --group-id)
            GROUP_ID="$2"
            shift 2
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --clone-type)
            CLONE_TYPE="$2"
            shift 2
            ;;
        --include-archived)
            INCLUDE_ARCHIVED=true
            shift
            ;;
        --shallow)
            SHALLOW=true
            shift
            ;;
        --branch)
            BRANCH="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL="$2"
            shift 2
            ;;
        --update-existing)
            UPDATE_EXISTING=true
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
if [[ -z "$GROUP_ID" ]]; then
    log ERROR "--group-id는 필수 파라미터입니다"
    show_help
fi

if ! validate_group_id "$GROUP_ID"; then
    error_exit "유효하지 않은 그룹 ID: $GROUP_ID"
fi

# 클론 타입 검증
case "$CLONE_TYPE" in
    ssh|http|https)
        ;;
    *)
        error_exit "유효하지 않은 클론 타입: $CLONE_TYPE (ssh, http, https 중 선택)"
        ;;
esac

# 그룹 정보 조회
log INFO "그룹 정보 조회 중..."
group_info=$(gitlab_api "GET" "/groups/$GROUP_ID")
http_code=$?

if [[ $http_code -ne 200 ]]; then
    error_exit "그룹 정보를 조회할 수 없습니다"
fi

GROUP_NAME=$(echo "$group_info" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
GROUP_PATH=$(echo "$group_info" | grep -o '"full_path":"[^"]*' | head -1 | cut -d'"' -f4)

# 출력 디렉토리 설정
if [[ -z "$OUTPUT_DIR" ]]; then
    OUTPUT_DIR="./gitlab-clones/$GROUP_PATH"
fi

log INFO "그룹: $GROUP_NAME (경로: $GROUP_PATH)"
log INFO "출력 디렉토리: $OUTPUT_DIR"

# 프로젝트 목록 조회
log INFO "프로젝트 목록 조회 중..."
projects=$(gitlab_api_paginated "GET" "/groups/$GROUP_ID/projects?include_subgroups=true")
http_code=$?

if [[ $http_code -ne 0 ]]; then
    error_exit "프로젝트 목록을 조회할 수 없습니다"
fi

# 아카이브된 프로젝트 필터링
if [[ "$INCLUDE_ARCHIVED" != "true" ]]; then
    projects=$(echo "$projects" | jq '[.[] | select(.archived == false)]')
fi

project_count=$(echo "$projects" | jq '. | length')
log INFO "클론할 프로젝트 수: $project_count"

if [[ $project_count -eq 0 ]]; then
    log INFO "클론할 프로젝트가 없습니다"
    exit 0
fi

# 클론 URL 생성 함수
get_clone_url() {
    local project="$1"
    
    case "$CLONE_TYPE" in
        ssh)
            echo "$project" | jq -r '.ssh_url_to_repo'
            ;;
        http)
            echo "$project" | jq -r '.http_url_to_repo'
            ;;
        https)
            echo "$project" | jq -r '.http_url_to_repo' | sed 's/^http:/https:/'
            ;;
    esac
}

# 프로젝트 클론 함수
clone_project() {
    local project="$1"
    local index="$2"
    local total="$3"
    
    local project_id=$(echo "$project" | jq -r '.id')
    local project_name=$(echo "$project" | jq -r '.name')
    local project_path=$(echo "$project" | jq -r '.path_with_namespace')
    local clone_url=$(get_clone_url "$project")
    
    # 상대 경로 계산 (그룹 경로 제거)
    local relative_path=$(echo "$project_path" | sed "s|^$GROUP_PATH/||")
    local target_dir="$OUTPUT_DIR/$relative_path"
    
    log INFO "[$index/$total] 프로젝트: $project_name"
    log DEBUG "  클론 URL: $clone_url"
    log DEBUG "  대상 디렉토리: $target_dir"
    
    if is_dry_run; then
        log INFO "[DRY-RUN] 클론될 위치: $target_dir"
        return 0
    fi
    
    # 이미 존재하는 경우 처리
    if [[ -d "$target_dir/.git" ]]; then
        if [[ "$UPDATE_EXISTING" == "true" ]]; then
            log INFO "  기존 저장소 업데이트 중..."
            (
                cd "$target_dir"
                git fetch --all
                git pull origin $(git rev-parse --abbrev-ref HEAD)
            ) 2>&1 | while read line; do log DEBUG "  $line"; done
            return $?
        else
            log WARN "  이미 존재함, 건너뜀: $target_dir"
            return 0
        fi
    fi
    
    # 디렉토리 생성
    mkdir -p "$(dirname "$target_dir")"
    
    # 클론 옵션 설정
    local clone_opts=""
    if [[ "$SHALLOW" == "true" ]]; then
        clone_opts+=" --depth 1"
    fi
    if [[ -n "$BRANCH" ]]; then
        clone_opts+=" --branch $BRANCH --single-branch"
    fi
    
    # 클론 실행
    if git clone $clone_opts "$clone_url" "$target_dir" 2>&1 | while read line; do log DEBUG "  $line"; done; then
        log INFO "  ✓ 클론 성공"
        return 0
    else
        log ERROR "  ✗ 클론 실패"
        return 1
    fi
}

# 병렬 처리를 위한 작업 큐
export -f clone_project get_clone_url log log_level_to_number
export GITLAB_URL GITLAB_TOKEN OUTPUT_DIR GROUP_PATH CLONE_TYPE SHALLOW BRANCH UPDATE_EXISTING DRY_RUN LOG_FILE LOG_LEVEL

# 메인 실행
if ! is_dry_run; then
    mkdir -p "$OUTPUT_DIR"
fi

# 진행 상황 추적
success_count=0
failed_count=0
current=0

# 임시 파일에 프로젝트 정보 저장
temp_file=$(mktemp)
echo "$projects" | jq -c '.[]' > "$temp_file"

# 병렬 처리
log INFO "병렬 클론 시작 (동시 실행: $PARALLEL)..."

cat "$temp_file" | while read -r project; do
    ((current++))
    
    # 병렬 작업 수 제한
    while [[ $(jobs -r | wc -l) -ge $PARALLEL ]]; do
        sleep 0.1
    done
    
    # 백그라운드로 클론 실행
    {
        if clone_project "$project" "$current" "$project_count"; then
            echo "SUCCESS"
        else
            echo "FAILED"
        fi
    } &
done

# 모든 작업 완료 대기
wait

# 결과 집계
log INFO "클론 작업 완료"

# 임시 파일 삭제
rm -f "$temp_file"

# 결과 요약
if ! is_dry_run; then
    log INFO "출력 디렉토리: $OUTPUT_DIR"
    log INFO "디렉토리 구조:"
    tree -L 3 "$OUTPUT_DIR" 2>/dev/null || find "$OUTPUT_DIR" -type d -maxdepth 3 | sort
fi