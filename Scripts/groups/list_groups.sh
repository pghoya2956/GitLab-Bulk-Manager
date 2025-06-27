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

GitLab 그룹 목록을 조회합니다.

Options:
    --search <QUERY>       그룹 이름이나 경로로 검색
    --parent-id <ID>       특정 그룹의 하위 그룹만 표시
    --owned                소유한 그룹만 표시
    --min-access <LEVEL>   최소 접근 레벨 (10=guest, 20=reporter, 30=developer, 40=maintainer, 50=owner)
    --sort <FIELD>         정렬 기준 (name, path, id, created_at, updated_at)
    --order <ORDER>        정렬 순서 (asc, desc)
    --format <FORMAT>      출력 형식 (table, json, csv, simple)
    --show-stats           프로젝트 수, 멤버 수 등 통계 표시
    --limit <N>            표시할 최대 그룹 수
    -h, --help             이 도움말 표시

Examples:
    # 모든 그룹 목록 표시
    $0
    
    # "dev"가 포함된 그룹 검색
    $0 --search dev
    
    # 특정 그룹의 하위 그룹만 표시
    $0 --parent-id 123
    
    # Maintainer 이상 권한이 있는 그룹만 표시 (통계 포함)
    $0 --min-access 40 --show-stats
    
    # CSV 형식으로 출력
    $0 --format csv > groups.csv
EOF
    exit 0
}

# 파라미터 파싱
SEARCH=""
PARENT_ID=""
OWNED=false
MIN_ACCESS=""
SORT="name"
ORDER="asc"
FORMAT="table"
SHOW_STATS=false
LIMIT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --search)
            SEARCH="$2"
            shift 2
            ;;
        --parent-id)
            PARENT_ID="$2"
            shift 2
            ;;
        --owned)
            OWNED=true
            shift
            ;;
        --min-access)
            MIN_ACCESS="$2"
            shift 2
            ;;
        --sort)
            SORT="$2"
            shift 2
            ;;
        --order)
            ORDER="$2"
            shift 2
            ;;
        --format)
            FORMAT="$2"
            shift 2
            ;;
        --show-stats)
            SHOW_STATS=true
            shift
            ;;
        --limit)
            LIMIT="$2"
            shift 2
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

# 그룹 통계 조회 함수
get_group_stats() {
    local group_id="$1"
    
    if [[ "$SHOW_STATS" != "true" ]]; then
        echo "0|0"
        return
    fi
    
    # 그룹 상세 정보 조회
    local response=$(gitlab_api "GET" "/groups/$group_id")
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        local project_count=$(echo "$response" | grep -o '"projects":\[[^]]*\]' | grep -o '{' | wc -l)
        local member_count=$(echo "$response" | grep -o '"members_count":[0-9]*' | cut -d: -f2)
        member_count=${member_count:-0}
        
        echo "$project_count|$member_count"
    else
        echo "0|0"
    fi
}

# 출력 함수들
print_table_header() {
    if [[ "$SHOW_STATS" == "true" ]]; then
        printf "%-6s %-30s %-30s %-10s %-10s %-8s %-8s\n" \
            "ID" "Name" "Path" "Visibility" "Access" "Projects" "Members"
        printf "%s\n" "$(printf '=%.0s' {1..110})"
    else
        printf "%-6s %-30s %-30s %-10s %-10s\n" \
            "ID" "Name" "Path" "Visibility" "Access"
        printf "%s\n" "$(printf '=%.0s' {1..90})"
    fi
}

print_table_row() {
    local group="$1"
    
    local id=$(echo "$group" | jq -r '.id')
    local name=$(echo "$group" | jq -r '.name')
    local path=$(echo "$group" | jq -r '.full_path')
    local visibility=$(echo "$group" | jq -r '.visibility')
    local access_level=$(echo "$group" | jq -r '.access_level // 0')
    local access_name=$(number_to_access_level "$access_level")
    
    if [[ "$SHOW_STATS" == "true" ]]; then
        local stats=$(get_group_stats "$id")
        local project_count=$(echo "$stats" | cut -d'|' -f1)
        local member_count=$(echo "$stats" | cut -d'|' -f2)
        
        printf "%-6s %-30s %-30s %-10s %-10s %-8s %-8s\n" \
            "$id" \
            "${name:0:30}" \
            "${path:0:30}" \
            "$visibility" \
            "$access_name" \
            "$project_count" \
            "$member_count"
    else
        printf "%-6s %-30s %-30s %-10s %-10s\n" \
            "$id" \
            "${name:0:30}" \
            "${path:0:30}" \
            "$visibility" \
            "$access_name"
    fi
}

print_csv_header() {
    if [[ "$SHOW_STATS" == "true" ]]; then
        echo "ID,Name,Path,Visibility,Access Level,Access Name,Projects,Members,Web URL"
    else
        echo "ID,Name,Path,Visibility,Access Level,Access Name,Web URL"
    fi
}

print_csv_row() {
    local group="$1"
    
    local id=$(echo "$group" | jq -r '.id')
    local name=$(echo "$group" | jq -r '.name' | sed 's/,/\\,/g')
    local path=$(echo "$group" | jq -r '.full_path')
    local visibility=$(echo "$group" | jq -r '.visibility')
    local access_level=$(echo "$group" | jq -r '.access_level // 0')
    local access_name=$(number_to_access_level "$access_level")
    local web_url=$(echo "$group" | jq -r '.web_url')
    
    if [[ "$SHOW_STATS" == "true" ]]; then
        local stats=$(get_group_stats "$id")
        local project_count=$(echo "$stats" | cut -d'|' -f1)
        local member_count=$(echo "$stats" | cut -d'|' -f2)
        
        echo "$id,$name,$path,$visibility,$access_level,$access_name,$project_count,$member_count,$web_url"
    else
        echo "$id,$name,$path,$visibility,$access_level,$access_name,$web_url"
    fi
}

print_simple_row() {
    local group="$1"
    
    local id=$(echo "$group" | jq -r '.id')
    local path=$(echo "$group" | jq -r '.full_path')
    
    echo "$id: $path"
}

# 메인 실행
# API 엔드포인트 구성
endpoint="/groups"
params=""

if [[ -n "$PARENT_ID" ]]; then
    endpoint="/groups/$PARENT_ID/subgroups"
fi

if [[ "$OWNED" == "true" ]]; then
    params+="owned=true&"
fi

if [[ -n "$SEARCH" ]]; then
    params+="search=$SEARCH&"
fi

if [[ -n "$MIN_ACCESS" ]]; then
    if validate_access_level "$MIN_ACCESS"; then
        min_access_num=$(access_level_to_number "$MIN_ACCESS")
        params+="min_access_level=$min_access_num&"
    else
        error_exit "유효하지 않은 접근 레벨: $MIN_ACCESS"
    fi
fi

params+="order_by=$SORT&sort=$ORDER"

# 그룹 목록 조회
log INFO "그룹 목록 조회 중..."
groups=$(gitlab_api_paginated "GET" "$endpoint?$params")
http_code=$?

if [[ $http_code -ne 0 ]]; then
    error_exit "그룹 목록 조회 실패"
fi

# 결과 개수 확인
total_count=$(echo "$groups" | jq '. | length')
log INFO "찾은 그룹 수: $total_count"

if [[ $total_count -eq 0 ]]; then
    log INFO "조건에 맞는 그룹이 없습니다"
    exit 0
fi

# LIMIT 적용
if [[ -n "$LIMIT" ]] && [[ $LIMIT -lt $total_count ]]; then
    groups=$(echo "$groups" | jq ".[:$LIMIT]")
    log INFO "표시 제한: $LIMIT개"
fi

# 출력 형식에 따라 처리
case "$FORMAT" in
    table)
        print_table_header
        echo "$groups" | jq -c '.[]' | while read -r group; do
            print_table_row "$group"
        done
        ;;
    json)
        echo "$groups" | jq .
        ;;
    csv)
        print_csv_header
        echo "$groups" | jq -c '.[]' | while read -r group; do
            print_csv_row "$group"
        done
        ;;
    simple)
        echo "$groups" | jq -c '.[]' | while read -r group; do
            print_simple_row "$group"
        done
        ;;
    *)
        error_exit "지원하지 않는 출력 형식: $FORMAT"
        ;;
esac