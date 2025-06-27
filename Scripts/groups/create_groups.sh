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

GitLab에 그룹을 생성합니다.

Options:
    --name <NAME>           그룹 이름 (필수)
    --path <PATH>           그룹 경로 (선택, 기본값: name을 slug화)
    --parent_id <ID>        부모 그룹 ID (선택, 서브그룹 생성 시)
    --description <DESC>    그룹 설명 (선택)
    --visibility <LEVEL>    가시성 레벨 (선택, 기본값: private)
                           가능한 값: private, internal, public
    --from-file <FILE>      파일에서 그룹 목록 읽기
    --dry-run              실제로 생성하지 않고 확인만
    -h, --help             이 도움말 표시

Examples:
    # 단일 그룹 생성
    $0 --name "Development Team" --description "개발팀 그룹"
    
    # 서브그룹 생성
    $0 --name "Backend" --parent_id 123 --visibility internal
    
    # 파일에서 여러 그룹 생성
    $0 --from-file groups.txt

파일 형식 (groups.txt):
    # 그룹명|경로(선택)|부모ID(선택)|설명(선택)|가시성(선택)
    Frontend Team|frontend||프론트엔드 개발팀|private
    Backend Team|backend||백엔드 개발팀|internal
EOF
    exit 0
}

# 파라미터 파싱
GROUP_NAME=""
GROUP_PATH=""
PARENT_ID=""
DESCRIPTION=""
VISIBILITY="private"
FROM_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            GROUP_NAME="$2"
            shift 2
            ;;
        --path)
            GROUP_PATH="$2"
            shift 2
            ;;
        --parent_id)
            PARENT_ID="$2"
            shift 2
            ;;
        --description)
            DESCRIPTION="$2"
            shift 2
            ;;
        --visibility)
            VISIBILITY="$2"
            shift 2
            ;;
        --from-file)
            FROM_FILE="$2"
            shift 2
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

# 그룹 생성 함수
create_group() {
    local name="$1"
    local path="${2:-$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')}"
    local parent_id="$3"
    local description="$4"
    local visibility="${5:-private}"
    
    # 입력값 검증
    if [[ -z "$name" ]]; then
        log ERROR "그룹 이름이 필요합니다"
        return 1
    fi
    
    if ! validate_group_path "$path"; then
        return 1
    fi
    
    if [[ -n "$parent_id" ]] && ! validate_group_id "$parent_id"; then
        return 1
    fi
    
    if ! validate_visibility "$visibility"; then
        return 1
    fi
    
    log INFO "그룹 생성 중: $name (경로: $path)"
    
    # JSON 데이터 생성
    local json_data=$(cat <<EOF
{
    "name": "$name",
    "path": "$path",
    "visibility": "$visibility"
EOF
)
    
    if [[ -n "$description" ]]; then
        json_data+=",\n    \"description\": \"$description\""
    fi
    
    if [[ -n "$parent_id" ]]; then
        json_data+=",\n    \"parent_id\": $parent_id"
    fi
    
    json_data+="\n}"
    
    if is_dry_run; then
        log INFO "[DRY-RUN] 생성할 그룹 정보:"
        echo -e "$json_data" | jq . 2>/dev/null || echo -e "$json_data"
        return 0
    fi
    
    # GitLab API 호출
    local response=$(gitlab_api "POST" "/groups" "$json_data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]]; then
        local group_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        local web_url=$(echo "$response" | grep -o '"web_url":"[^"]*' | cut -d'"' -f4)
        log INFO "✓ 그룹 생성 성공: $name (ID: $group_id)"
        log INFO "  URL: $web_url"
        return 0
    else
        log ERROR "✗ 그룹 생성 실패: $name"
        log ERROR "  상태 코드: $http_code"
        log ERROR "  응답: $response"
        return 1
    fi
}

# 메인 실행
if [[ -n "$FROM_FILE" ]]; then
    # 파일에서 읽기
    if ! validate_file_path "$FROM_FILE"; then
        error_exit "파일을 찾을 수 없습니다: $FROM_FILE"
    fi
    
    log INFO "파일에서 그룹 목록 읽기: $FROM_FILE"
    
    total_count=0
    success_count=0
    failed_count=0
    
    while IFS='|' read -r name path parent_id description visibility || [[ -n "$name" ]]; do
        # 주석과 빈 줄 건너뛰기
        [[ -z "$name" || "$name" =~ ^[[:space:]]*# ]] && continue
        
        ((total_count++))
        
        # 공백 제거
        name=$(echo "$name" | xargs)
        path=$(echo "$path" | xargs)
        parent_id=$(echo "$parent_id" | xargs)
        description=$(echo "$description" | xargs)
        visibility=$(echo "$visibility" | xargs)
        
        if create_group "$name" "$path" "$parent_id" "$description" "$visibility"; then
            ((success_count++))
        else
            ((failed_count++))
        fi
        
        show_progress $total_count $total_count "그룹 생성"
    done < "$FROM_FILE"
    
    log INFO "완료: 총 ${total_count}개 중 ${success_count}개 성공, ${failed_count}개 실패"
    
else
    # 단일 그룹 생성
    if [[ -z "$GROUP_NAME" ]]; then
        log ERROR "--name 옵션은 필수입니다"
        show_help
    fi
    
    if create_group "$GROUP_NAME" "$GROUP_PATH" "$PARENT_ID" "$DESCRIPTION" "$VISIBILITY"; then
        log INFO "그룹 생성 완료"
    else
        error_exit "그룹 생성 실패"
    fi
fi