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

GitLab 그룹 또는 프로젝트에 멤버를 추가/관리합니다.

Options:
    --user-id <ID>          사용자 ID (필수, --email과 함께 사용 불가)
    --email <EMAIL>         사용자 이메일 (필수, --user-id와 함께 사용 불가)
    --group-id <ID>         그룹 ID (--project-id와 함께 사용 불가)
    --project-id <ID>       프로젝트 ID (--group-id와 함께 사용 불가)
    --access-level <LEVEL>  접근 권한 레벨 (필수)
                           숫자: 10(guest), 20(reporter), 30(developer), 40(maintainer), 50(owner)
                           또는: guest, reporter, developer, maintainer, owner
    --expires-at <DATE>     만료일 (선택, YYYY-MM-DD 형식)
    --from-file <FILE>      파일에서 멤버 목록 읽기
    --action <ACTION>       수행할 작업 (add, update, remove, list)
                           기본값: add
    --dry-run              실제로 수행하지 않고 확인만
    -h, --help             이 도움말 표시

Examples:
    # 이메일로 그룹에 멤버 추가
    $0 --email user@example.com --group-id 123 --access-level developer

    # 사용자 ID로 프로젝트에 멤버 추가 (만료일 포함)
    $0 --user-id 456 --project-id 789 --access-level maintainer --expires-at 2024-12-31

    # 파일에서 여러 멤버 추가
    $0 --from-file members.txt --action add

    # 그룹의 모든 멤버 목록 조회
    $0 --group-id 123 --action list

파일 형식 (members.txt):
    # email|group_path 또는 group_id|access_level|expires_at(선택)
    user1@example.com|dev-team|developer|
    user2@example.com|123|maintainer|2024-12-31
EOF
    exit 0
}

# 파라미터 초기화
USER_ID=""
EMAIL=""
GROUP_ID=""
PROJECT_ID=""
ACCESS_LEVEL=""
EXPIRES_AT=""
FROM_FILE=""
ACTION="add"
DRY_RUN=false

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --user-id)
            USER_ID="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --group-id)
            GROUP_ID="$2"
            shift 2
            ;;
        --project-id)
            PROJECT_ID="$2"
            shift 2
            ;;
        --access-level)
            ACCESS_LEVEL="$2"
            shift 2
            ;;
        --expires-at)
            EXPIRES_AT="$2"
            shift 2
            ;;
        --from-file)
            FROM_FILE="$2"
            shift 2
            ;;
        --action)
            ACTION="$2"
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
            error_exit "Unknown option: $1"
            ;;
    esac
done

# 스크립트 초기화
init_script
load_config "$BASE_DIR/config/gitlab.env"

# 사용자 ID를 이메일로 조회
get_user_id_by_email() {
    local email="$1"
    local response=$(gitlab_api "GET" "/users?search=$email")
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        # jq가 있으면 사용, 없으면 grep/sed 사용
        if command -v jq >/dev/null 2>&1; then
            echo "$response" | jq -r '.[] | select(.email == "'$email'") | .id' | head -1
        else
            echo "$response" | grep -o '"id":[0-9]*' | grep -A1 "\"email\":\"$email\"" | head -1 | sed 's/"id"://'
        fi
    else
        log "ERROR" "사용자 조회 실패: $email"
        return 1
    fi
}

# 멤버 추가 함수
add_member() {
    local user_id="$1"
    local target_type="$2"  # groups 또는 projects
    local target_id="$3"
    local access_level="$4"
    local expires_at="$5"
    
    local data="{\"user_id\": $user_id, \"access_level\": $access_level"
    if [[ -n "$expires_at" ]]; then
        data+=", \"expires_at\": \"$expires_at\""
    fi
    data+="}"
    
    if [[ "$DRY_RUN" = true ]]; then
        log "INFO" "[DRY-RUN] 멤버 추가: User ID=$user_id, Target=$target_type/$target_id, Level=$access_level"
        return 0
    fi
    
    local response=$(gitlab_api "POST" "/$target_type/$target_id/members" "$data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]]; then
        log "SUCCESS" "멤버 추가 성공: User ID=$user_id to $target_type/$target_id"
    elif [[ $http_code -eq 409 ]]; then
        log "INFO" "멤버가 이미 존재합니다: User ID=$user_id in $target_type/$target_id"
    else
        log "ERROR" "멤버 추가 실패 (HTTP $http_code): $response"
        return 1
    fi
}

# 멤버 제거 함수
remove_member() {
    local user_id="$1"
    local target_type="$2"
    local target_id="$3"
    
    if [[ "$DRY_RUN" = true ]]; then
        log "INFO" "[DRY-RUN] 멤버 제거: User ID=$user_id from $target_type/$target_id"
        return 0
    fi
    
    local response=$(gitlab_api "DELETE" "/$target_type/$target_id/members/$user_id")
    local http_code=$?
    
    if [[ $http_code -eq 204 ]]; then
        log "SUCCESS" "멤버 제거 성공: User ID=$user_id from $target_type/$target_id"
    else
        log "ERROR" "멤버 제거 실패 (HTTP $http_code): $response"
        return 1
    fi
}

# 멤버 목록 조회 함수
list_members() {
    local target_type="$1"
    local target_id="$2"
    
    log "INFO" "$target_type/$target_id의 멤버 목록 조회 중..."
    
    local response=$(gitlab_api_paginated "GET" "/$target_type/$target_id/members/all")
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        if command -v jq >/dev/null 2>&1; then
            echo "$response" | jq -r '.[] | "\(.username) (\(.name)) - \(.access_level) - \(.email // "N/A")"'
        else
            echo "$response"
        fi
    else
        log "ERROR" "멤버 목록 조회 실패 (HTTP $http_code)"
        return 1
    fi
}

# 파일에서 멤버 처리
process_members_from_file() {
    [[ ! -f "$FROM_FILE" ]] && error_exit "파일을 찾을 수 없습니다: $FROM_FILE"
    
    local line_num=0
    local success_count=0
    local fail_count=0
    
    while IFS='|' read -r email target access_level expires_at || [ -n "$email" ]; do
        ((line_num++))
        
        # 빈 줄과 주석 건너뛰기
        [[ -z "$email" || "$email" =~ ^[[:space:]]*# ]] && continue
        
        # 공백 제거
        email=$(echo "$email" | xargs)
        target=$(echo "$target" | xargs)
        access_level=$(echo "$access_level" | xargs)
        expires_at=$(echo "$expires_at" | xargs)
        
        # 사용자 ID 조회
        local user_id=$(get_user_id_by_email "$email")
        if [[ -z "$user_id" ]]; then
            log "ERROR" "사용자를 찾을 수 없습니다: $email (줄 $line_num)"
            ((fail_count++))
            continue
        fi
        
        # 타겟 타입과 ID 결정
        local target_type=""
        local target_id=""
        
        if [[ "$target" =~ ^[0-9]+$ ]]; then
            # 숫자면 그룹 ID로 가정
            target_type="groups"
            target_id="$target"
        else
            # 경로면 그룹 조회
            local group_response=$(gitlab_api "GET" "/groups/$target")
            if [[ $? -eq 200 ]]; then
                target_type="groups"
                if command -v jq >/dev/null 2>&1; then
                    target_id=$(echo "$group_response" | jq -r '.id')
                else
                    target_id=$(echo "$group_response" | grep -o '"id":[0-9]*' | head -1 | sed 's/"id"://')
                fi
            else
                log "ERROR" "그룹을 찾을 수 없습니다: $target (줄 $line_num)"
                ((fail_count++))
                continue
            fi
        fi
        
        # 접근 레벨 변환
        local numeric_level=$(access_level_to_number "$access_level")
        
        # 멤버 추가
        if add_member "$user_id" "$target_type" "$target_id" "$numeric_level" "$expires_at"; then
            ((success_count++))
        else
            ((fail_count++))
        fi
        
        show_progress $line_num $(wc -l < "$FROM_FILE") "멤버 처리"
    done < "$FROM_FILE"
    
    echo
    log "INFO" "처리 완료: 성공=$success_count, 실패=$fail_count"
}

# 메인 로직
main() {
    # 액션별 처리
    case $ACTION in
        add|update)
            if [[ -n "$FROM_FILE" ]]; then
                process_members_from_file
            else
                # 파라미터 검증
                if [[ -z "$EMAIL" && -z "$USER_ID" ]]; then
                    error_exit "--email 또는 --user-id 중 하나는 필수입니다"
                fi
                
                if [[ -n "$EMAIL" && -n "$USER_ID" ]]; then
                    error_exit "--email과 --user-id는 동시에 사용할 수 없습니다"
                fi
                
                if [[ -z "$GROUP_ID" && -z "$PROJECT_ID" ]]; then
                    error_exit "--group-id 또는 --project-id 중 하나는 필수입니다"
                fi
                
                if [[ -n "$GROUP_ID" && -n "$PROJECT_ID" ]]; then
                    error_exit "--group-id와 --project-id는 동시에 사용할 수 없습니다"
                fi
                
                [[ -z "$ACCESS_LEVEL" ]] && error_exit "--access-level은 필수입니다"
                
                # 사용자 ID 결정
                local user_id="$USER_ID"
                if [[ -n "$EMAIL" ]]; then
                    user_id=$(get_user_id_by_email "$EMAIL")
                    [[ -z "$user_id" ]] && error_exit "사용자를 찾을 수 없습니다: $EMAIL"
                fi
                
                # 타겟 결정
                local target_type=""
                local target_id=""
                if [[ -n "$GROUP_ID" ]]; then
                    target_type="groups"
                    target_id="$GROUP_ID"
                else
                    target_type="projects"
                    target_id="$PROJECT_ID"
                fi
                
                # 접근 레벨 변환
                local numeric_level=$(access_level_to_number "$ACCESS_LEVEL")
                
                # 멤버 추가/업데이트
                add_member "$user_id" "$target_type" "$target_id" "$numeric_level" "$EXPIRES_AT"
            fi
            ;;
            
        remove)
            # 파라미터 검증
            if [[ -z "$EMAIL" && -z "$USER_ID" ]]; then
                error_exit "--email 또는 --user-id 중 하나는 필수입니다"
            fi
            
            if [[ -z "$GROUP_ID" && -z "$PROJECT_ID" ]]; then
                error_exit "--group-id 또는 --project-id 중 하나는 필수입니다"
            fi
            
            # 사용자 ID 결정
            local user_id="$USER_ID"
            if [[ -n "$EMAIL" ]]; then
                user_id=$(get_user_id_by_email "$EMAIL")
                [[ -z "$user_id" ]] && error_exit "사용자를 찾을 수 없습니다: $EMAIL"
            fi
            
            # 타겟 결정
            local target_type=""
            local target_id=""
            if [[ -n "$GROUP_ID" ]]; then
                target_type="groups"
                target_id="$GROUP_ID"
            else
                target_type="projects"
                target_id="$PROJECT_ID"
            fi
            
            # 멤버 제거
            remove_member "$user_id" "$target_type" "$target_id"
            ;;
            
        list)
            # 파라미터 검증
            if [[ -z "$GROUP_ID" && -z "$PROJECT_ID" ]]; then
                error_exit "--group-id 또는 --project-id 중 하나는 필수입니다"
            fi
            
            # 타겟 결정
            local target_type=""
            local target_id=""
            if [[ -n "$GROUP_ID" ]]; then
                target_type="groups"
                target_id="$GROUP_ID"
            else
                target_type="projects"
                target_id="$PROJECT_ID"
            fi
            
            # 멤버 목록 조회
            list_members "$target_type" "$target_id"
            ;;
            
        *)
            error_exit "알 수 없는 액션: $ACTION"
            ;;
    esac
}

# 스크립트 실행
main