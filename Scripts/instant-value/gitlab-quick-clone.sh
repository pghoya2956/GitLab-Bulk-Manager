#!/bin/bash

# GitLab Quick Clone - 스마트 선택적 프로젝트 클론
# 필요한 프로젝트만 빠르게 클론하는 도구

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../lib/common.sh"

# 기본값
CLONE_DIR="${HOME}/gitlab-clones"
SHALLOW_CLONE=false
FILTER=""
GROUP_FILTER=""
LANGUAGE_FILTER=""
SIZE_LIMIT=""
ACTIVITY_DAYS=30

# 도움말
show_help() {
    cat << EOF
GitLab Quick Clone - Smart Project Cloning Tool

Usage: $(basename "$0") [OPTIONS]

Options:
    -d, --dir PATH          Clone directory (default: ~/gitlab-clones)
    -s, --shallow           Shallow clone (faster, less history)
    -f, --filter PATTERN    Filter projects by name pattern
    -g, --group GROUP       Clone only from specific group
    -l, --language LANG     Clone only projects with specific language
    -z, --size-limit MB     Skip projects larger than SIZE MB
    -a, --active-days N     Clone only projects active in last N days
    -h, --help             Show this help message

Examples:
    # Clone all Python projects
    $(basename "$0") --language python

    # Clone recent active projects from specific group
    $(basename "$0") --group backend-team --active-days 7

    # Quick shallow clone of small projects
    $(basename "$0") --shallow --size-limit 100
EOF
}

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            CLONE_DIR="$2"
            shift 2
            ;;
        -s|--shallow)
            SHALLOW_CLONE=true
            shift
            ;;
        -f|--filter)
            FILTER="$2"
            shift 2
            ;;
        -g|--group)
            GROUP_FILTER="$2"
            shift 2
            ;;
        -l|--language)
            LANGUAGE_FILTER="$2"
            shift 2
            ;;
        -z|--size-limit)
            SIZE_LIMIT="$2"
            shift 2
            ;;
        -a|--active-days)
            ACTIVITY_DAYS="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# 클론 디렉토리 생성
mkdir -p "$CLONE_DIR"

echo "🔍 Fetching projects with filters..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# API 쿼리 구성
API_QUERY="${GITLAB_API_URL}/projects?per_page=100"

# 그룹 필터
if [ -n "$GROUP_FILTER" ]; then
    GROUP_ID=$(curl -s "${GITLAB_API_URL}/groups?search=${GROUP_FILTER}" -H "Private-Token: ${GITLAB_TOKEN}" | jq -r '.[0].id')
    if [ -n "$GROUP_ID" ] && [ "$GROUP_ID" != "null" ]; then
        API_QUERY="${GITLAB_API_URL}/groups/${GROUP_ID}/projects?per_page=100&include_subgroups=true"
        echo "📁 Filtering by group: $GROUP_FILTER (ID: $GROUP_ID)"
    fi
fi

# 활동 날짜 계산
if [ "$ACTIVITY_DAYS" -lt 365 ]; then
    ACTIVITY_DATE=$(date -u -v-${ACTIVITY_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${ACTIVITY_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')
    API_QUERY="${API_QUERY}&last_activity_after=${ACTIVITY_DATE}"
    echo "📅 Including only projects active in last $ACTIVITY_DAYS days"
fi

# 프로젝트 가져오기
PROJECTS=$(curl -s "${API_QUERY}" -H "Private-Token: ${GITLAB_TOKEN}")
TOTAL_PROJECTS=$(echo "$PROJECTS" | jq 'length')

echo "📊 Found $TOTAL_PROJECTS projects to evaluate"
echo ""

# 클론 카운터
CLONED=0
SKIPPED=0
ERRORS=0

# 프로젝트 처리
echo "$PROJECTS" | jq -c '.[]' | while IFS= read -r project; do
    PROJECT_NAME=$(echo "$project" | jq -r '.name')
    PROJECT_PATH=$(echo "$project" | jq -r '.path_with_namespace')
    PROJECT_URL=$(echo "$project" | jq -r '.ssh_url_to_repo // .http_url_to_repo')
    PROJECT_SIZE=$(echo "$project" | jq -r '.statistics.repository_size // 0')
    PROJECT_LANG=$(echo "$project" | jq -r '.languages // {} | to_entries | max_by(.value) | .key // "unknown"' 2>/dev/null || echo "unknown")
    
    # 이름 필터
    if [ -n "$FILTER" ] && [[ ! "$PROJECT_NAME" =~ $FILTER ]]; then
        ((SKIPPED++))
        continue
    fi
    
    # 언어 필터
    if [ -n "$LANGUAGE_FILTER" ] && [ "$PROJECT_LANG" != "$LANGUAGE_FILTER" ]; then
        ((SKIPPED++))
        continue
    fi
    
    # 크기 필터 (MB 단위)
    if [ -n "$SIZE_LIMIT" ]; then
        SIZE_MB=$((PROJECT_SIZE / 1048576))
        if [ "$SIZE_MB" -gt "$SIZE_LIMIT" ]; then
            echo "⏭️  Skipping $PROJECT_NAME (${SIZE_MB}MB > ${SIZE_LIMIT}MB limit)"
            ((SKIPPED++))
            continue
        fi
    fi
    
    # 클론 경로 설정
    TARGET_DIR="${CLONE_DIR}/${PROJECT_PATH}"
    
    # 이미 존재하는지 확인
    if [ -d "$TARGET_DIR" ]; then
        echo "✅ Already cloned: $PROJECT_NAME"
        # Git pull로 업데이트
        (cd "$TARGET_DIR" && git pull --quiet 2>/dev/null) && echo "   ↻ Updated to latest" || echo "   ⚠️  Update failed"
        ((CLONED++))
        continue
    fi
    
    # 디렉토리 생성
    mkdir -p "$(dirname "$TARGET_DIR")"
    
    # 클론 실행
    echo -n "📥 Cloning $PROJECT_NAME"
    if [ "$PROJECT_SIZE" -gt 0 ]; then
        echo -n " ($(($PROJECT_SIZE / 1048576))MB)"
    fi
    echo -n "..."
    
    if [ "$SHALLOW_CLONE" = true ]; then
        git clone --depth 1 --quiet "$PROJECT_URL" "$TARGET_DIR" 2>/dev/null
    else
        git clone --quiet "$PROJECT_URL" "$TARGET_DIR" 2>/dev/null
    fi
    
    if [ $? -eq 0 ]; then
        echo " ✅"
        ((CLONED++))
        
        # 프로젝트 정보 저장
        cat > "$TARGET_DIR/.gitlab-info" << EOF
PROJECT_NAME=$PROJECT_NAME
PROJECT_PATH=$PROJECT_PATH
LANGUAGE=$PROJECT_LANG
SIZE_MB=$(($PROJECT_SIZE / 1048576))
CLONED_AT=$(date '+%Y-%m-%d %H:%M:%S')
EOF
    else
        echo " ❌"
        ((ERRORS++))
        rmdir "$TARGET_DIR" 2>/dev/null
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Clone Summary:"
echo "   ✅ Successfully cloned/updated: $CLONED"
echo "   ⏭️  Skipped (filters): $SKIPPED"
echo "   ❌ Errors: $ERRORS"
echo "   📁 Clone directory: $CLONE_DIR"
echo ""

# 클론된 프로젝트 통계
if [ "$CLONED" -gt 0 ]; then
    echo "📈 Repository Statistics:"
    echo -n "   💾 Total size: "
    du -sh "$CLONE_DIR" 2>/dev/null | awk '{print $1}'
    
    echo -n "   🗣️  Languages: "
    find "$CLONE_DIR" -name ".gitlab-info" -exec grep "LANGUAGE=" {} \; | cut -d= -f2 | sort | uniq -c | sort -rn | head -5 | awk '{printf "%s(%d) ", $2, $1}'
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"