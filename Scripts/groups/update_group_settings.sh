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

GitLab 그룹의 설정을 업데이트합니다.

Options:
    --id <ID>                     그룹 ID (--id 또는 --path 중 하나 필수)
    --path <PATH>                 그룹 경로 (--id 또는 --path 중 하나 필수)
    --name <NAME>                 새로운 그룹 이름
    --description <DESC>          새로운 그룹 설명
    --visibility <LEVEL>          가시성 레벨 (private, internal, public)
    --request-access <BOOL>       액세스 요청 허용 여부 (true/false)
    --share-runners <BOOL>        공유 러너 활성화 (true/false)
    --lfs <BOOL>                  Git LFS 활성화 (true/false)
    --project-creation <LEVEL>    프로젝트 생성 권한 레벨
                                 (0=No one, 1=Maintainer, 2=Developer+Maintainer)
    --subgroup-creation <LEVEL>   서브그룹 생성 권한 레벨
                                 (0=Owner, 1=Maintainer)
    --dry-run                     실제로 변경하지 않고 확인만
    -h, --help                    이 도움말 표시

Examples:
    # 그룹 이름과 설명 변경
    $0 --id 123 --name "New Name" --description "Updated description"
    
    # 가시성을 internal로 변경하고 LFS 활성화
    $0 --path my-group --visibility internal --lfs true
    
    # 프로젝트 생성 권한을 Developer 이상으로 설정
    $0 --id 123 --project-creation 2
EOF
    exit 0
}

# 파라미터 파싱
GROUP_ID=""
GROUP_PATH=""
UPDATE_FIELDS=""

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
        --name)
            NAME="$2"
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
        --request-access)
            REQUEST_ACCESS="$2"
            shift 2
            ;;
        --share-runners)
            SHARE_RUNNERS="$2"
            shift 2
            ;;
        --lfs)
            LFS="$2"
            shift 2
            ;;
        --project-creation)
            PROJECT_CREATION="$2"
            shift 2
            ;;
        --subgroup-creation)
            SUBGROUP_CREATION="$2"
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

# 입력값 검증
if [[ -z "$GROUP_ID" ]] && [[ -z "$GROUP_PATH" ]]; then
    log ERROR "--id 또는 --path 옵션 중 하나는 필수입니다"
    show_help
fi

# 그룹 정보 조회
get_group_info() {
    local identifier="$1"
    local by_path="$2"
    
    local endpoint
    if [[ "$by_path" == "true" ]]; then
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

# JSON 데이터 생성
build_update_json() {
    local json="{"
    local first=true
    
    if [[ -n "$NAME" ]]; then
        json+='"name": "'"$NAME"'"'
        first=false
    fi
    
    if [[ -n "$DESCRIPTION" ]]; then
        [[ "$first" == "false" ]] && json+=", "
        json+='"description": "'"$DESCRIPTION"'"'
        first=false
    fi
    
    if [[ -n "$VISIBILITY" ]]; then
        if validate_visibility "$VISIBILITY"; then
            [[ "$first" == "false" ]] && json+=", "
            json+='"visibility": "'"$VISIBILITY"'"'
            first=false
        else
            return 1
        fi
    fi
    
    if [[ -n "$REQUEST_ACCESS" ]]; then
        [[ "$first" == "false" ]] && json+=", "
        json+='"request_access_enabled": '"$REQUEST_ACCESS"
        first=false
    fi
    
    if [[ -n "$SHARE_RUNNERS" ]]; then
        [[ "$first" == "false" ]] && json+=", "
        json+='"shared_runners_enabled": '"$SHARE_RUNNERS"
        first=false
    fi
    
    if [[ -n "$LFS" ]]; then
        [[ "$first" == "false" ]] && json+=", "
        json+='"lfs_enabled": '"$LFS"
        first=false
    fi
    
    if [[ -n "$PROJECT_CREATION" ]]; then
        [[ "$first" == "false" ]] && json+=", "
        json+='"project_creation_level": '"$PROJECT_CREATION"
        first=false
    fi
    
    if [[ -n "$SUBGROUP_CREATION" ]]; then
        [[ "$first" == "false" ]] && json+=", "
        json+='"subgroup_creation_level": '"$SUBGROUP_CREATION"
        first=false
    fi
    
    json+="}"
    
    if [[ "$json" == "{}" ]]; then
        return 1
    fi
    
    echo "$json"
    return 0
}

# 메인 실행
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
CURRENT_NAME=$(echo "$group_info" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
CURRENT_PATH=$(echo "$group_info" | grep -o '"full_path":"[^"]*' | head -1 | cut -d'"' -f4)

log INFO "현재 그룹: $CURRENT_NAME (ID: $GROUP_ID, 경로: $CURRENT_PATH)"

# 업데이트할 데이터 생성
update_json=$(build_update_json)
if [[ $? -ne 0 ]] || [[ -z "$update_json" ]]; then
    error_exit "업데이트할 필드가 없거나 유효하지 않습니다"
fi

log INFO "업데이트할 필드:"
echo "$update_json" | jq . 2>/dev/null || echo "$update_json"

if is_dry_run; then
    log INFO "[DRY-RUN] 실제 업데이트는 수행되지 않았습니다"
    exit 0
fi

# 그룹 설정 업데이트
log INFO "그룹 설정 업데이트 중..."
response=$(gitlab_api "PUT" "/groups/$GROUP_ID" "$update_json")
http_code=$?

if [[ $http_code -eq 200 ]]; then
    log INFO "✓ 그룹 설정 업데이트 성공"
    
    # 변경된 내용 표시
    if [[ -n "$NAME" ]]; then
        log INFO "  이름: $CURRENT_NAME → $NAME"
    fi
    if [[ -n "$VISIBILITY" ]]; then
        current_visibility=$(echo "$group_info" | grep -o '"visibility":"[^"]*' | head -1 | cut -d'"' -f4)
        log INFO "  가시성: $current_visibility → $VISIBILITY"
    fi
    
    # 업데이트된 그룹 URL 표시
    web_url=$(echo "$response" | grep -o '"web_url":"[^"]*' | cut -d'"' -f4)
    log INFO "  URL: $web_url"
else
    log ERROR "✗ 그룹 설정 업데이트 실패"
    log ERROR "  상태 코드: $http_code"
    log ERROR "  응답: $response"
    exit 1
fi