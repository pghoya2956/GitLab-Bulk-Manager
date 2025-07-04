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

계층적 조직 구조를 정의한 파일을 읽어 GitLab 그룹을 일괄 생성합니다.

Options:
    --from-file <FILE>     조직 구조 정의 파일 (필수)
    --parent-id <ID>       부모 그룹 ID (선택, 지정 시 해당 그룹 아래에 생성)
    --start-from <PATH>    특정 경로부터 시작 (선택)
    --skip-existing        이미 존재하는 그룹은 건너뛰기
    --dry-run              실제로 생성하지 않고 확인만
    -h, --help             이 도움말 표시

파일 형식 (organization.txt):
    # 들여쓰기(2칸)로 계층 표현
    개발본부|dev-division|private|설명
      프론트엔드팀|frontend|internal|설명
        웹개발파트|web|private|설명

Examples:
    # 최상위에 조직 구조 생성
    $0 --from-file organization.txt
    
    # 특정 그룹(ID: 100) 아래에 생성
    $0 --from-file organization.txt --parent-id 100
    
    # dry-run으로 확인
    $0 --from-file organization.txt --dry-run
EOF
    exit 0
}

# 파라미터 파싱
FROM_FILE=""
PARENT_ID=""
START_FROM=""
SKIP_EXISTING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --from-file)
            FROM_FILE="$2"
            shift 2
            ;;
        --parent-id)
            PARENT_ID="$2"
            shift 2
            ;;
        --start-from)
            START_FROM="$2"
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

# 그룹 ID 매핑을 저장할 연관 배열
declare -A group_id_map
declare -A group_path_map

# 부모 그룹 정보 처리
if [[ -n "$PARENT_ID" ]]; then
    # 부모 그룹 정보 조회
    log INFO "부모 그룹 정보 조회 중..."
    parent_info=$(gitlab_api "GET" "/groups/$PARENT_ID")
    http_code=$?
    
    if [[ $http_code -ne 200 ]]; then
        error_exit "부모 그룹을 찾을 수 없습니다: ID $PARENT_ID"
    fi
    
    PARENT_NAME=$(echo "$parent_info" | grep -o '"name":"[^"]*' | head -1 | cut -d'"' -f4)
    PARENT_PATH=$(echo "$parent_info" | grep -o '"full_path":"[^"]*' | head -1 | cut -d'"' -f4)
    
    log INFO "부모 그룹: $PARENT_NAME (ID: $PARENT_ID, 경로: $PARENT_PATH)"
    
    # 부모 그룹 정보를 매핑에 저장
    group_id_map[""]="$PARENT_ID"
    group_path_map[""]="$PARENT_PATH"
fi

# 그룹 존재 여부 확인 함수
check_group_exists() {
    local group_path="$1"
    local encoded_path=$(echo "$group_path" | sed 's/\//%2F/g')
    
    local response=$(gitlab_api "GET" "/groups/$encoded_path" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        local group_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        echo "$group_id"
        return 0
    else
        return 1
    fi
}

# 그룹 생성 함수
create_group_with_parent() {
    local name="$1"
    local path="$2"
    local visibility="$3"
    local description="$4"
    local parent_path="$5"
    local parent_id=""
    
    # 부모 그룹 ID 찾기
    if [[ -n "$parent_path" ]]; then
        parent_id="${group_id_map[$parent_path]}"
        if [[ -z "$parent_id" ]]; then
            log ERROR "부모 그룹을 찾을 수 없습니다: $parent_path"
            return 1
        fi
    fi
    
    # 전체 경로 계산
    local full_path="$path"
    if [[ -n "$parent_path" ]]; then
        full_path="$parent_path/$path"
    elif [[ -n "${PARENT_PATH}" ]]; then
        # 최상위 부모 그룹이 지정된 경우
        full_path="${PARENT_PATH}/$path"
    fi
    
    # 이미 존재하는지 확인
    if [[ "$SKIP_EXISTING" == "true" ]]; then
        local existing_id=$(check_group_exists "$full_path")
        if [[ -n "$existing_id" ]]; then
            log WARN "그룹이 이미 존재합니다: $full_path (ID: $existing_id)"
            group_id_map["$full_path"]="$existing_id"
            group_path_map["$full_path"]="$full_path"
            return 0
        fi
    fi
    
    log INFO "그룹 생성 중: $name (경로: $full_path)"
    
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
        log INFO "[DRY-RUN] 생성할 그룹:"
        echo -e "$json_data" | jq . 2>/dev/null || echo -e "$json_data"
        # dry-run에서도 가상의 ID 할당 (음수로)
        group_id_map["$full_path"]="-$(echo "$full_path" | wc -c)"
        group_path_map["$full_path"]="$full_path"
        return 0
    fi
    
    # GitLab API 호출
    local response=$(gitlab_api "POST" "/groups" "$json_data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]]; then
        local group_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        local web_url=$(echo "$response" | grep -o '"web_url":"[^"]*' | cut -d'"' -f4)
        log INFO "✓ 그룹 생성 성공: $name (ID: $group_id)"
        log DEBUG "  URL: $web_url"
        
        # ID 매핑 저장
        group_id_map["$full_path"]="$group_id"
        group_path_map["$full_path"]="$full_path"
        
        return 0
    else
        log ERROR "✗ 그룹 생성 실패: $name"
        log ERROR "  상태 코드: $http_code"
        log ERROR "  응답: $response"
        return 1
    fi
}

# 조직 구조 파싱 및 생성
log INFO "조직 구조 파일 읽기: $FROM_FILE"

# 통계
total_count=0
success_count=0
failed_count=0
skipped_count=0

# 현재 처리 중인 경로 스택
declare -a path_stack=()
declare -a level_stack=()

# 시작 지점 찾기 플래그
start_found=false
if [[ -z "$START_FROM" ]]; then
    start_found=true
fi

# 파일 읽기
while IFS= read -r line || [[ -n "$line" ]]; do
    # 주석과 빈 줄 건너뛰기
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    
    # 들여쓰기 레벨 계산
    indent_level=0
    if [[ "$line" =~ ^[[:space:]]+ ]]; then
        # 앞의 공백 개수 세기
        spaces="${line%%[! ]*}"
        indent_level=$((${#spaces} / 2))
    fi
    
    # 공백 제거하고 파싱
    line=$(echo "$line" | xargs)
    IFS='|' read -r name path visibility description <<< "$line"
    
    # 필수 필드 확인
    if [[ -z "$name" || -z "$path" || -z "$visibility" ]]; then
        log WARN "잘못된 형식, 건너뛰기: $line"
        continue
    fi
    
    # 스택 업데이트 (현재 레벨에 맞게 조정)
    while [[ ${#path_stack[@]} -gt $indent_level ]]; do
        unset 'path_stack[-1]'
        unset 'level_stack[-1]'
    done
    
    # 부모 경로 계산
    parent_path=""
    if [[ ${#path_stack[@]} -gt 0 ]]; then
        parent_path=$(IFS='/'; echo "${path_stack[*]}")
    fi
    
    # 전체 경로
    if [[ -n "$parent_path" ]]; then
        full_path="$parent_path/$path"
    else
        full_path="$path"
    fi
    
    # 시작 지점 확인
    if [[ "$start_found" == "false" ]]; then
        if [[ "$full_path" == "$START_FROM"* ]]; then
            start_found=true
        else
            continue
        fi
    fi
    
    ((total_count++))
    
    # 그룹 생성
    if create_group_with_parent "$name" "$path" "$visibility" "$description" "$parent_path"; then
        ((success_count++))
        
        # 스택에 추가
        path_stack+=("$path")
        level_stack+=("$indent_level")
    else
        ((failed_count++))
    fi
    
    show_progress $((success_count + failed_count)) $total_count "조직 구조 생성"
done < "$FROM_FILE"

echo

# 결과 요약
log INFO "================================"
log INFO "조직 구조 생성 완료"
log INFO "================================"
log INFO "총 그룹 수: $total_count"
log INFO "생성 성공: $success_count"
log INFO "생성 실패: $failed_count"

if [[ $failed_count -gt 0 ]]; then
    log WARN "일부 그룹 생성에 실패했습니다. 로그를 확인하세요."
fi

# 생성된 그룹 ID 매핑 출력 (디버그용)
if [[ "$LOG_LEVEL" == "DEBUG" ]] && [[ ${#group_id_map[@]} -gt 0 ]]; then
    log DEBUG "생성된 그룹 ID 매핑:"
    for path in "${!group_id_map[@]}"; do
        log DEBUG "  $path => ID: ${group_id_map[$path]}"
    done
fi