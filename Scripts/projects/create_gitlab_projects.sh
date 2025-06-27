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
    echo "GitLab에 프로젝트를 생성합니다."
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
    echo "config/gitlab.env.example을 복사하여 config/gitlab.env를 생성하고 토큰을 설정하세요."
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

# 프로젝트 생성 함수
create_project() {
    local project_name=$1
    
    # JSON 데이터 생성
    json_data=$(cat <<EOF
{
    "name": "${project_name}",
    "path": "${project_name}",
    "namespace_id": ${GROUP_ID},
    "visibility": "private",
    "initialize_with_readme": false
}
EOF
)
    
    # GitLab API 호출
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "PRIVATE-TOKEN: ${GITLAB_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${json_data}" \
        "${GITLAB_URL}/api/v4/projects")
    
    # HTTP 상태 코드 추출
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "201" ]; then
        web_url=$(echo "$body" | grep -o '"web_url":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}✓ 프로젝트 생성 성공: ${project_name}${NC}"
        echo "  URL: $web_url"
        return 0
    else
        echo -e "${RED}✗ 프로젝트 생성 실패: ${project_name}${NC}"
        echo "  상태 코드: $http_code"
        echo "  응답: $body"
        return 1
    fi
}

# 메인 실행
echo "GitLab URL: $GITLAB_URL"
echo "부모 그룹 ID: $GROUP_ID"
echo "----------------------------------------"

# 프로젝트 목록 읽기 (주석과 빈 줄 제외)
projects=($(grep -v '^#' "$PROJECTS_FILE" | grep -v '^$'))
total_count=${#projects[@]}

echo "생성할 프로젝트 총 ${total_count}개"
echo "----------------------------------------"

# 카운터 초기화
success_count=0
failed_count=0

# 각 프로젝트 생성
for project in "${projects[@]}"; do
    if create_project "$project"; then
        ((success_count++))
    else
        ((failed_count++))
    fi
done

echo "----------------------------------------"
echo -e "총 ${total_count}개 중 ${GREEN}${success_count}개 성공${NC}, ${RED}${failed_count}개 실패${NC}"