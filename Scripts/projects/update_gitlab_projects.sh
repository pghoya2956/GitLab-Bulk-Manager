#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 도움말 함수
show_help() {
    echo "Usage: $0 --group_id <GROUP_ID>"
    echo ""
    echo "GitLab 프로젝트의 description과 브랜치 보호 규칙을 업데이트합니다."
    echo ""
    echo "Options:"
    echo "  --group_id <ID>    부모 그룹 ID (필수)"
    echo "  -h, --help         이 도움말 표시"
    exit 1
}

# 파라미터 파싱
GROUP_ID=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --group_id)
            GROUP_ID="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${RED}Error: 알 수 없는 옵션: $1${NC}"
            show_help
            ;;
    esac
done

# 필수 파라미터 확인
if [ -z "$GROUP_ID" ]; then
    echo -e "${RED}Error: --group_id는 필수 파라미터입니다.${NC}"
    show_help
fi

# 설정 파일 확인
CONFIG_FILE="config/gitlab.env"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: $CONFIG_FILE 파일이 없습니다.${NC}"
    exit 1
fi

# 프로젝트 목록 파일 확인
PROJECTS_FILE="config/projects.txt"
if [ ! -f "$PROJECTS_FILE" ]; then
    echo -e "${RED}Error: $PROJECTS_FILE 파일이 없습니다.${NC}"
    exit 1
fi

# 환경 변수 로드
source "$CONFIG_FILE"

# 필수 환경 변수 확인
if [ -z "$GITLAB_URL" ] || [ -z "$GITLAB_TOKEN" ]; then
    echo -e "${RED}Error: GITLAB_URL 또는 GITLAB_TOKEN이 설정되지 않았습니다.${NC}"
    exit 1
fi

# 프로젝트 ID 조회 함수
get_project_id() {
    local project_name=$1
    
    # 그룹의 프로젝트 목록을 가져와서 이름으로 찾기
    page=1
    while true; do
        response=$(curl -s -X GET \
            -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
            "${GITLAB_URL}/api/v4/groups/${GROUP_ID}/projects?per_page=100&page=${page}")
        
        # 응답이 빈 배열이면 중단
        if [ "$response" = "[]" ]; then
            break
        fi
        
        # 프로젝트 이름으로 ID 찾기
        project_id=$(echo "$response" | python3 -c "
import sys, json
try:
    projects = json.load(sys.stdin)
    for p in projects:
        if p['path'] == '$project_name':
            print(p['id'])
            break
except:
    pass
")
        
        if [ -n "$project_id" ]; then
            echo "$project_id"
            return
        fi
        
        ((page++))
        
        # 안전장치: 10페이지 이상 조회하지 않음
        if [ $page -gt 10 ]; then
            break
        fi
    done
    
    echo ""
}

# 프로젝트 description 업데이트 함수
update_project_description() {
    local project_id=$1
    local description=$2
    
    json_data=$(cat <<EOF
{
    "description": "${description}"
}
EOF
)
    
    response=$(curl -s -w "\n%{http_code}" -X PUT \
        -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${json_data}" \
        "${GITLAB_URL}/api/v4/projects/${project_id}")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# 브랜치 보호 규칙 설정 함수
setup_branch_protection() {
    local project_id=$1
    
    # 먼저 기존 보호 규칙 삭제 (있을 경우)
    curl -s -X DELETE \
        -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
        "${GITLAB_URL}/api/v4/projects/${project_id}/protected_branches/main" > /dev/null 2>&1
    
    # 새로운 보호 규칙 생성
    json_data=$(cat <<EOF
{
    "name": "main",
    "push_access_level": 40,
    "merge_access_level": 0,
    "allow_force_push": true,
    "code_owner_approval_required": false
}
EOF
)
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${json_data}" \
        "${GITLAB_URL}/api/v4/projects/${project_id}/protected_branches")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "201" ] || [ "$http_code" = "409" ]; then
        return 0
    else
        return 1
    fi
}

# 메인 실행
echo "GitLab URL: $GITLAB_URL"
echo "부모 그룹 ID: $GROUP_ID"
echo "----------------------------------------"

# 임시 파일 생성
temp_file=$(mktemp)

# projects.txt 파일을 읽어서 카테고리 정보와 함께 저장
current_category=""
while IFS= read -r line; do
    # 주석 라인이면 카테고리로 인식
    if [[ $line =~ ^#[[:space:]](.+) ]]; then
        current_category="${BASH_REMATCH[1]}"
    # 빈 줄이 아니고 주석이 아니면 프로젝트
    elif [[ -n "$line" ]] && [[ ! "$line" =~ ^# ]]; then
        echo "${line}|${current_category}" >> "$temp_file"
    fi
done < "$PROJECTS_FILE"

# 카운터 초기화
total_count=0
success_count=0
failed_count=0

# 각 프로젝트 업데이트
while IFS='|' read -r project category; do
    ((total_count++))
    
    echo -e "\n${YELLOW}프로젝트: ${project}${NC}"
    echo "카테고리: ${category}"
    
    # 프로젝트 ID 조회
    project_id=$(get_project_id "$project")
    
    if [ -z "$project_id" ]; then
        echo -e "${RED}✗ 프로젝트를 찾을 수 없습니다: ${project}${NC}"
        ((failed_count++))
        continue
    fi
    
    echo "프로젝트 ID: ${project_id}"
    
    # Description 업데이트
    if update_project_description "$project_id" "$category"; then
        echo -e "${GREEN}✓ Description 업데이트 완료${NC}"
    else
        echo -e "${RED}✗ Description 업데이트 실패${NC}"
    fi
    
    # 브랜치 보호 규칙 설정
    if setup_branch_protection "$project_id"; then
        echo -e "${GREEN}✓ 브랜치 보호 규칙 설정 완료${NC}"
        ((success_count++))
    else
        echo -e "${RED}✗ 브랜치 보호 규칙 설정 실패${NC}"
        ((failed_count++))
    fi
done < "$temp_file"

# 임시 파일 삭제
rm -f "$temp_file"

echo -e "\n----------------------------------------"
echo -e "총 ${total_count}개 중 ${GREEN}${success_count}개 성공${NC}, ${RED}${failed_count}개 실패${NC}"