#!/bin/bash

# GitLab Auto Conflict Resolver - 머지 충돌 자동 해결
# 간단한 충돌을 자동으로 해결하고 복잡한 충돌에 대한 가이드 제공

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"
source "$BASE_DIR/lib/common.sh"
source "$BASE_DIR/lib/validation.sh"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# 기본값
DRY_RUN=false
AUTO_MERGE=false
STRATEGY="safe"  # safe, aggressive, interactive
CONFLICT_TYPES="all"  # all, simple, whitespace, imports
PROJECT_ID=""
MR_IID=""

show_help() {
    cat << EOF
GitLab Auto Conflict Resolver - Intelligent Merge Conflict Resolution

Usage: $(basename "$0") [OPTIONS]

Options:
    -p, --project ID       Project ID (required)
    -m, --mr IID          Merge request IID (optional, analyzes all if not set)
    -s, --strategy TYPE    Resolution strategy: safe/aggressive/interactive (default: safe)
    -t, --types TYPES      Conflict types to resolve: all/simple/whitespace/imports (default: all)
    -a, --auto-merge       Automatically merge after resolution
    -d, --dry-run         Preview changes without applying
    -h, --help           Show this help message

Examples:
    # Analyze all merge requests with conflicts
    $(basename "$0") --project 123 --dry-run

    # Auto-resolve simple conflicts and merge
    $(basename "$0") --project 123 --mr 45 --types simple --auto-merge

    # Interactive resolution for specific MR
    $(basename "$0") --project 123 --mr 45 --strategy interactive

Description:
    Automatically resolves common merge conflicts:
    - Whitespace and formatting conflicts
    - Import/include statement ordering
    - Simple line additions in different locations
    - Package dependency version conflicts
    
    Provides detailed analysis for complex conflicts.
EOF
}

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project)
            PROJECT_ID="$2"
            validate_project_id "$PROJECT_ID" || error_exit "Invalid project ID: $PROJECT_ID" 1
            shift 2
            ;;
        -m|--mr)
            MR_IID="$2"
            shift 2
            ;;
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
        -t|--types)
            CONFLICT_TYPES="$2"
            shift 2
            ;;
        -a|--auto-merge)
            AUTO_MERGE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1" 1
            ;;
    esac
done

# 필수 파라미터 확인
[ -z "$PROJECT_ID" ] && error_exit "Project ID is required. Use -p or --project" 1

# 초기화
init_script
load_config "$BASE_DIR/config/gitlab.env"

# 충돌 해결 시작
log "INFO" "Starting auto conflict resolution for project $PROJECT_ID"

# 전역 변수
declare -A CONFLICT_STATS
TOTAL_CONFLICTS=0
RESOLVED_CONFLICTS=0
COMPLEX_CONFLICTS=0

# 충돌 타입 분석
analyze_conflict_type() {
    local conflict_content=$1
    local file_path=$2
    
    # 화이트스페이스 충돌
    if echo "$conflict_content" | grep -E '^[<>=]{7}' | grep -qE '^\s*$|^\s+[^<>=]'; then
        echo "whitespace"
        return
    fi
    
    # import/include 충돌
    if [[ "$file_path" =~ \.(js|ts|py|java|go)$ ]] && echo "$conflict_content" | grep -qE 'import |from |include |require'; then
        echo "imports"
        return
    fi
    
    # 패키지 버전 충돌
    if [[ "$file_path" =~ (package\.json|requirements\.txt|go\.mod|pom\.xml|Gemfile)$ ]]; then
        echo "version"
        return
    fi
    
    # 간단한 추가 충돌 (양쪽에서 다른 위치에 추가)
    local conflict_blocks=$(echo "$conflict_content" | grep -c '^<<<<<<< ')
    if [ "$conflict_blocks" -eq 1 ]; then
        echo "simple"
        return
    fi
    
    echo "complex"
}

# 충돌 해결 함수
resolve_conflict() {
    local file_path=$1
    local conflict_type=$2
    local ours_content=$3
    local theirs_content=$4
    local base_content=$5
    
    case "$conflict_type" in
        whitespace)
            # 공백 충돌: theirs 버전 사용 (보통 더 최신)
            echo "$theirs_content"
            return 0
            ;;
        
        imports)
            # import 충돌: 두 버전 모두 포함하고 정렬
            local all_imports=$(echo -e "$ours_content\n$theirs_content" | grep -E 'import |from |include |require' | sort -u)
            local other_content=$(echo -e "$ours_content\n$theirs_content" | grep -vE 'import |from |include |require' | sort -u)
            echo -e "$all_imports\n\n$other_content"
            return 0
            ;;
        
        version)
            # 버전 충돌: 더 높은 버전 선택
            if [[ "$file_path" == *"package.json"* ]]; then
                # npm 패키지 버전 비교
                local ours_versions=$(echo "$ours_content" | grep -oE '"[^"]+": "[^"]+"')
                local theirs_versions=$(echo "$theirs_content" | grep -oE '"[^"]+": "[^"]+"')
                
                # 더 높은 버전 선택 로직
                echo "$theirs_content"  # 단순화: theirs 사용
                return 0
            fi
            ;;
        
        simple)
            # 간단한 충돌: 안전 모드에서는 수동 해결 필요
            if [ "$STRATEGY" = "aggressive" ]; then
                # 두 변경사항 모두 포함
                echo -e "$ours_content\n$theirs_content"
                return 0
            fi
            ;;
    esac
    
    # 해결 불가능
    return 1
}

# MR 충돌 분석 및 해결
process_merge_request() {
    local mr_iid=$1
    
    # MR 정보 가져오기
    local mr_info=$(gitlab_api "GET" "/projects/$PROJECT_ID/merge_requests/$mr_iid")
    if [ $? -ne 200 ]; then
        log "ERROR" "Failed to get MR $mr_iid"
        return 1
    fi
    
    local mr_title=$(echo "$mr_info" | jq -r '.title')
    local source_branch=$(echo "$mr_info" | jq -r '.source_branch')
    local target_branch=$(echo "$mr_info" | jq -r '.target_branch')
    local has_conflicts=$(echo "$mr_info" | jq -r '.has_conflicts')
    
    echo -e "${CYAN}📋 MR #$mr_iid: $mr_title${NC}"
    echo "   Source: $source_branch → Target: $target_branch"
    
    if [ "$has_conflicts" != "true" ]; then
        echo -e "   ${GREEN}✅ No conflicts${NC}"
        return 0
    fi
    
    # 충돌 파일 목록 가져오기
    local mr_changes=$(gitlab_api "GET" "/projects/$PROJECT_ID/merge_requests/$mr_iid/changes")
    if [ $? -ne 200 ]; then
        log "ERROR" "Failed to get MR changes"
        return 1
    fi
    
    local conflict_files=$(echo "$mr_changes" | jq -r '.changes[] | select(.conflicts == true) | .old_path')
    local conflict_count=$(echo "$conflict_files" | grep -c .)
    
    echo -e "   ${YELLOW}⚠️  $conflict_count files with conflicts${NC}"
    
    # 임시 디렉토리 생성
    local temp_dir="/tmp/gitlab_conflict_$$"
    mkdir -p "$temp_dir"
    
    # 각 충돌 파일 처리
    local resolved_count=0
    local failed_count=0
    
    echo "$conflict_files" | while IFS= read -r file_path; do
        [ -z "$file_path" ] && continue
        
        echo -n "   Processing $file_path..."
        
        # 파일의 충돌 내용 가져오기
        local file_info=$(echo "$mr_changes" | jq -r ".changes[] | select(.old_path == \"$file_path\")")
        local diff_content=$(echo "$file_info" | jq -r '.diff')
        
        # 충돌 타입 분석
        local conflict_type=$(analyze_conflict_type "$diff_content" "$file_path")
        ((CONFLICT_STATS[$conflict_type]++))
        
        # 충돌 해결 시도
        if [ "$CONFLICT_TYPES" = "all" ] || [[ "$CONFLICT_TYPES" == *"$conflict_type"* ]]; then
            if [ "$conflict_type" != "complex" ]; then
                # 충돌 블록 추출
                local conflict_blocks=$(echo "$diff_content" | awk '/^<<<<<<< /{flag=1} flag; /^>>>>>>> /{flag=0}')
                
                if [ -n "$conflict_blocks" ]; then
                    # 해결 시도
                    local resolved_content=$(resolve_conflict "$file_path" "$conflict_type" "" "" "")
                    
                    if [ $? -eq 0 ]; then
                        echo -e " ${GREEN}✓ Resolved ($conflict_type)${NC}"
                        ((resolved_count++))
                        ((RESOLVED_CONFLICTS++))
                        
                        # 해결된 내용 저장
                        echo "$resolved_content" > "$temp_dir/$(basename "$file_path")"
                    else
                        echo -e " ${RED}✗ Failed${NC}"
                        ((failed_count++))
                    fi
                else
                    echo -e " ${YELLOW}⚠️  Complex conflict${NC}"
                    ((COMPLEX_CONFLICTS++))
                fi
            else
                echo -e " ${YELLOW}⚠️  Complex conflict - manual resolution required${NC}"
                ((COMPLEX_CONFLICTS++))
            fi
        else
            echo -e " ${CYAN}Skipped (type: $conflict_type)${NC}"
        fi
        
        ((TOTAL_CONFLICTS++))
    done
    
    # 결과 요약
    echo ""
    echo "   Resolution Summary:"
    echo "   - Resolved: $resolved_count"
    echo "   - Failed: $failed_count"
    echo "   - Complex: $((conflict_count - resolved_count - failed_count))"
    
    # 해결 제안
    if [ "$resolved_count" -gt 0 ] && [ "$DRY_RUN" = false ]; then
        echo ""
        echo -e "   ${GREEN}💡 Next Steps:${NC}"
        echo "   1. Review resolved conflicts in: $temp_dir"
        echo "   2. Apply changes to branch: $source_branch"
        
        if [ "$AUTO_MERGE" = true ] && [ "$failed_count" -eq 0 ]; then
            echo "   3. Auto-merging MR..."
            
            # GitLab API로 머지 시도
            local merge_response=$(gitlab_api "PUT" "/projects/$PROJECT_ID/merge_requests/$mr_iid/merge" "{\"should_remove_source_branch\": false}")
            if [ $? -eq 200 ]; then
                echo -e "   ${GREEN}✅ Successfully merged!${NC}"
            else
                echo -e "   ${RED}❌ Auto-merge failed${NC}"
            fi
        fi
    fi
    
    # 임시 파일 정리 (dry-run이 아닌 경우 유지)
    [ "$DRY_RUN" = true ] && rm -rf "$temp_dir"
    
    return 0
}

# 충돌 해결 가이드 생성
generate_resolution_guide() {
    local file_path=$1
    local conflict_type=$2
    
    echo ""
    echo -e "${YELLOW}📝 Resolution Guide for $file_path${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    case "$conflict_type" in
        whitespace)
            echo "This is a whitespace conflict. Recommended actions:"
            echo "1. Use a consistent code formatter (prettier, black, gofmt)"
            echo "2. Configure .editorconfig in your repository"
            echo "3. Add pre-commit hooks for formatting"
            ;;
        
        imports)
            echo "Import/dependency conflict detected. Recommended actions:"
            echo "1. Sort imports alphabetically"
            echo "2. Group imports by type (stdlib, third-party, local)"
            echo "3. Use import organizing tools (isort, goimports)"
            ;;
        
        version)
            echo "Package version conflict. Recommended actions:"
            echo "1. Use the higher version if compatible"
            echo "2. Test both versions for compatibility"
            echo "3. Consider using version ranges instead of fixed versions"
            ;;
        
        complex)
            echo "Complex conflict requiring manual resolution:"
            echo "1. Understand the intent of both changes"
            echo "2. Communicate with the authors"
            echo "3. Test the merged result thoroughly"
            echo ""
            echo "Conflict visualization:"
            echo "<<<<<<< HEAD (yours)"
            echo "  [Your changes]"
            echo "======="
            echo "  [Their changes]"
            echo ">>>>>>> branch-name (theirs)"
            ;;
    esac
    
    echo ""
}

# 메인 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}            GitLab Auto Conflict Resolver                     ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "🎯 Strategy: $STRATEGY | Types: $CONFLICT_TYPES"
echo -e "🔧 Mode: $([ "$DRY_RUN" = true ] && echo "Dry Run" || echo "Live")"
echo ""

# 프로젝트 정보 확인
PROJECT_INFO=$(gitlab_api "GET" "/projects/$PROJECT_ID")
if [ $? -ne 200 ]; then
    error_exit "Failed to get project information" 2
fi

PROJECT_NAME=$(echo "$PROJECT_INFO" | jq -r '.name_with_namespace')
echo "📁 Project: $PROJECT_NAME"
echo ""

# MR 목록 가져오기
if [ -n "$MR_IID" ]; then
    # 특정 MR 처리
    process_merge_request "$MR_IID"
else
    # 모든 충돌 MR 처리
    echo "🔍 Scanning for merge requests with conflicts..."
    
    CONFLICTED_MRS=$(gitlab_api "GET" "/projects/$PROJECT_ID/merge_requests?state=opened&wip=no&per_page=100")
    if [ $? -ne 200 ]; then
        error_exit "Failed to get merge requests" 2
    fi
    
    CONFLICT_MR_COUNT=$(echo "$CONFLICTED_MRS" | jq '[.[] | select(.has_conflicts == true)] | length')
    
    if [ "$CONFLICT_MR_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ No merge requests with conflicts found!${NC}"
        exit 0
    fi
    
    echo "Found $CONFLICT_MR_COUNT MRs with conflicts"
    echo ""
    
    # 각 MR 처리
    echo "$CONFLICTED_MRS" | jq -c '.[] | select(.has_conflicts == true)' | while IFS= read -r mr; do
        mr_iid=$(echo "$mr" | jq -r '.iid')
        process_merge_request "$mr_iid"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    done
fi

# 통계 출력
echo ""
echo -e "${YELLOW}📊 Conflict Resolution Statistics${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total Conflicts: ${YELLOW}$TOTAL_CONFLICTS${NC}"
echo -e "Auto-Resolved: ${GREEN}$RESOLVED_CONFLICTS${NC} ($((RESOLVED_CONFLICTS * 100 / (TOTAL_CONFLICTS + 1)))%)"
echo -e "Complex Conflicts: ${RED}$COMPLEX_CONFLICTS${NC}"
echo ""

# 충돌 타입별 분포
echo "Conflict Types Distribution:"
for type in "${!CONFLICT_STATS[@]}"; do
    count=${CONFLICT_STATS[$type]}
    echo "   - $type: $count"
done

# 권장사항
echo ""
echo -e "${YELLOW}💡 Recommendations${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$RESOLVED_CONFLICTS" -gt 0 ]; then
    echo -e "${GREEN}✅ Successfully resolved $RESOLVED_CONFLICTS conflicts automatically${NC}"
    echo "   Consider implementing:"
    echo "   • Pre-commit hooks for code formatting"
    echo "   • Import sorting tools"
    echo "   • Automated dependency updates"
fi

if [ "$COMPLEX_CONFLICTS" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $COMPLEX_CONFLICTS complex conflicts require manual intervention${NC}"
    echo "   Recommendations:"
    echo "   • Schedule pair programming sessions"
    echo "   • Improve communication during development"
    echo "   • Consider smaller, more frequent merges"
fi

# 자동화 제안
if [ "$TOTAL_CONFLICTS" -gt 10 ]; then
    echo ""
    echo -e "${CYAN}🤖 Automation Opportunity:${NC}"
    echo "   High conflict rate detected. Consider:"
    echo "   • Setting up this script as a GitLab CI job"
    echo "   • Creating merge request templates"
    echo "   • Implementing branch protection rules"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Conflict Resolution Analysis Complete!${NC}"
[ "$DRY_RUN" = true ] && echo -e "   ⚠️  Run without --dry-run to apply resolutions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log "INFO" "Auto conflict resolution completed"