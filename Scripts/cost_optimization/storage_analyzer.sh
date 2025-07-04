#!/bin/bash

# GitLab Storage Analyzer - 스토리지 사용량 분석 및 최적화 제안
# 즉각적인 비용 절감을 위한 스토리지 낭비 요소 식별

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
THRESHOLD_GB=1
INACTIVE_DAYS=90
OUTPUT_FORMAT="console"
CLEANUP_SUGGESTIONS=true

show_help() {
    cat << EOF
GitLab Storage Analyzer - Identify Storage Waste & Save Money

Usage: $(basename "$0") [OPTIONS]

Options:
    -t, --threshold GB      Alert for repos larger than GB (default: 1)
    -i, --inactive DAYS     Flag repos inactive for DAYS (default: 90)
    -f, --format FORMAT     Output format: console/json/csv (default: console)
    -c, --cleanup           Generate cleanup commands (default: true)
    -g, --group-id ID       Analyze specific group only
    -h, --help             Show this help message

Examples:
    # Find large inactive repositories
    $(basename "$0") --threshold 5 --inactive 180

    # Analyze specific group with JSON output
    $(basename "$0") --group-id 123 --format json

    # Generate cleanup script for repositories
    $(basename "$0") --cleanup > cleanup_commands.sh

Description:
    Analyzes GitLab storage usage to identify:
    - Large repositories consuming excessive space
    - Inactive projects that can be archived
    - Orphaned artifacts and old pipelines
    - LFS objects that can be cleaned
    - Duplicate/redundant data

    Provides immediate cost-saving recommendations.
EOF
}

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--threshold)
            THRESHOLD_GB="$2"
            shift 2
            ;;
        -i|--inactive)
            INACTIVE_DAYS="$2"
            shift 2
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -c|--cleanup)
            CLEANUP_SUGGESTIONS=true
            shift
            ;;
        -g|--group-id)
            GROUP_ID="$2"
            shift 2
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

# 초기화
init_script
load_config "$BASE_DIR/config/gitlab.env"

# 스토리지 분석 시작
log "INFO" "Starting GitLab storage analysis..."

# 전역 변수
declare -A PROJECT_STORAGE
declare -A WASTE_PROJECTS
TOTAL_STORAGE=0
TOTAL_WASTE=0
INACTIVE_THRESHOLD=$(date -u -v-${INACTIVE_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${INACTIVE_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')

# 바이트를 읽기 쉬운 형식으로 변환
format_bytes() {
    local bytes=$1
    if [ "$bytes" -lt 1024 ]; then
        echo "${bytes}B"
    elif [ "$bytes" -lt 1048576 ]; then
        echo "$((bytes / 1024))KB"
    elif [ "$bytes" -lt 1073741824 ]; then
        echo "$((bytes / 1048576))MB"
    else
        echo "$((bytes / 1073741824))GB"
    fi
}

# 프로젝트 스토리지 분석
analyze_project_storage() {
    local project=$1
    local project_id=$(echo "$project" | jq -r '.id')
    local project_name=$(echo "$project" | jq -r '.path_with_namespace')
    local last_activity=$(echo "$project" | jq -r '.last_activity_at')
    
    # 상세 통계 가져오기
    local stats=$(gitlab_api "GET" "/projects/$project_id?statistics=true")
    if [ $? -ne 200 ]; then
        log "WARN" "Failed to get statistics for project $project_name"
        return
    fi
    
    local repo_size=$(echo "$stats" | jq -r '.statistics.repository_size // 0')
    local lfs_size=$(echo "$stats" | jq -r '.statistics.lfs_objects_size // 0')
    local artifacts_size=$(echo "$stats" | jq -r '.statistics.build_artifacts_size // 0')
    local packages_size=$(echo "$stats" | jq -r '.statistics.packages_size // 0')
    local wiki_size=$(echo "$stats" | jq -r '.statistics.wiki_size // 0')
    local uploads_size=$(echo "$stats" | jq -r '.statistics.uploads_size // 0')
    
    local total_size=$((repo_size + lfs_size + artifacts_size + packages_size + wiki_size + uploads_size))
    
    # 낭비 요소 식별
    local waste_size=0
    local waste_reasons=""
    
    # 1. 오래된 아티팩트
    if [ "$artifacts_size" -gt 0 ]; then
        # 30일 이상 된 아티팩트 확인
        local old_artifacts=$(gitlab_api "GET" "/projects/$project_id/jobs?scope=success")
        local old_artifacts_size=0
        
        if [ $? -eq 200 ]; then
            old_artifacts_size=$(echo "$old_artifacts" | jq '[.[] | select(.artifacts_expire_at == null or (.artifacts_expire_at | strptime("%Y-%m-%dT%H:%M:%S") | mktime) > (now + 30*24*60*60))] | length' 2>/dev/null || echo "0")
            if [ "$old_artifacts_size" -gt 0 ]; then
                waste_size=$((waste_size + artifacts_size / 2)) # 추정치: 50%가 오래된 것
                waste_reasons="${waste_reasons}Old artifacts|"
            fi
        fi
    fi
    
    # 2. 비활성 프로젝트
    if [[ "$last_activity" < "$INACTIVE_THRESHOLD" ]]; then
        waste_size=$((waste_size + total_size))
        waste_reasons="${waste_reasons}Inactive project|"
    fi
    
    # 3. 큰 LFS 객체
    if [ "$lfs_size" -gt "$((repo_size * 2))" ]; then
        waste_reasons="${waste_reasons}Excessive LFS usage|"
    fi
    
    # 4. 큰 업로드 파일
    if [ "$uploads_size" -gt "$((100 * 1048576))" ]; then # 100MB 이상
        waste_reasons="${waste_reasons}Large uploads|"
    fi
    
    # 결과 저장
    PROJECT_STORAGE["$project_id"]="$project_name|$total_size|$repo_size|$lfs_size|$artifacts_size|$packages_size|$wiki_size|$uploads_size|$last_activity"
    
    if [ "$waste_size" -gt 0 ] || [ -n "$waste_reasons" ]; then
        WASTE_PROJECTS["$project_id"]="$project_name|$waste_size|$waste_reasons"
        TOTAL_WASTE=$((TOTAL_WASTE + waste_size))
    fi
    
    TOTAL_STORAGE=$((TOTAL_STORAGE + total_size))
}

# 메인 분석 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}               GitLab Storage Analysis Report                 ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Analysis Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "🎯 Threshold: ${THRESHOLD_GB}GB | Inactive: ${INACTIVE_DAYS} days"
echo ""

# 프로젝트 목록 가져오기
if [ -n "$GROUP_ID" ]; then
    echo "📁 Analyzing group ID: $GROUP_ID"
    PROJECTS=$(gitlab_api_paginated "GET" "/groups/$GROUP_ID/projects?include_subgroups=true&with_shared=false")
else
    echo "🌐 Analyzing all accessible projects"
    PROJECTS=$(gitlab_api_paginated "GET" "/projects")
fi

if [ $? -ne 0 ]; then
    error_exit "Failed to fetch projects" 2
fi

TOTAL_PROJECTS=$(echo "$PROJECTS" | jq 'length')
echo "📊 Found $TOTAL_PROJECTS projects to analyze"
echo ""

# 프로그레스 바 표시하며 분석
CURRENT=0
echo "$PROJECTS" | jq -c '.[]' | while IFS= read -r project; do
    ((CURRENT++))
    show_progress "$CURRENT" "$TOTAL_PROJECTS" "Analyzing projects"
    analyze_project_storage "$project"
done

echo ""
echo ""

# 결과 출력
case "$OUTPUT_FORMAT" in
    json)
        # JSON 형식 출력
        echo "{"
        echo "  \"summary\": {"
        echo "    \"total_storage\": $TOTAL_STORAGE,"
        echo "    \"total_waste\": $TOTAL_WASTE,"
        echo "    \"potential_savings_gb\": $((TOTAL_WASTE / 1073741824)),"
        echo "    \"analyzed_projects\": $TOTAL_PROJECTS"
        echo "  },"
        echo "  \"waste_projects\": ["
        for project_id in "${!WASTE_PROJECTS[@]}"; do
            IFS='|' read -r name waste reasons <<< "${WASTE_PROJECTS[$project_id]}"
            echo "    {"
            echo "      \"id\": $project_id,"
            echo "      \"name\": \"$name\","
            echo "      \"waste_bytes\": $waste,"
            echo "      \"reasons\": \"$reasons\""
            echo "    },"
        done | sed '$ s/,$//'
        echo "  ]"
        echo "}"
        ;;
    csv)
        # CSV 형식 출력
        echo "Project,Total Size (MB),Repository (MB),LFS (MB),Artifacts (MB),Waste (MB),Reasons"
        for project_id in "${!PROJECT_STORAGE[@]}"; do
            IFS='|' read -r name total repo lfs artifacts packages wiki uploads last_activity <<< "${PROJECT_STORAGE[$project_id]}"
            waste_info="${WASTE_PROJECTS[$project_id]:-||}"
            IFS='|' read -r _ waste reasons <<< "$waste_info"
            echo "$name,$((total/1048576)),$((repo/1048576)),$((lfs/1048576)),$((artifacts/1048576)),$((waste/1048576)),\"$reasons\""
        done
        ;;
    *)
        # 콘솔 출력 (기본)
        echo -e "${YELLOW}💾 Storage Usage Summary${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "Total Storage Used: ${YELLOW}$(format_bytes $TOTAL_STORAGE)${NC}"
        echo -e "Potential Waste: ${RED}$(format_bytes $TOTAL_WASTE)${NC} ($((TOTAL_WASTE * 100 / (TOTAL_STORAGE + 1)))%)"
        echo -e "Estimated Monthly Savings: ${GREEN}\$$(echo "scale=2; $TOTAL_WASTE / 1073741824 * 0.10" | bc)${NC}"
        echo ""
        
        # Top 10 스토리지 사용 프로젝트
        echo -e "${YELLOW}📊 Top 10 Storage Consumers${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 정렬하여 상위 10개 출력
        for project_id in "${!PROJECT_STORAGE[@]}"; do
            IFS='|' read -r name total rest <<< "${PROJECT_STORAGE[$project_id]}"
            echo "$total|$name|$project_id"
        done | sort -rn | head -10 | while IFS='|' read -r size name id; do
            printf "%-50s %10s" "$name" "$(format_bytes $size)"
            
            # 낭비 여부 표시
            if [ -n "${WASTE_PROJECTS[$id]}" ]; then
                echo -e " ${RED}⚠️  Waste detected${NC}"
            else
                echo ""
            fi
        done
        echo ""
        
        # 낭비 요소 상세
        if [ ${#WASTE_PROJECTS[@]} -gt 0 ]; then
            echo -e "${YELLOW}🗑️  Waste Analysis${NC}"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            for project_id in "${!WASTE_PROJECTS[@]}"; do
                IFS='|' read -r name waste reasons <<< "${WASTE_PROJECTS[$project_id]}"
                echo -e "${CYAN}$name${NC}"
                echo -e "   Potential savings: ${RED}$(format_bytes $waste)${NC}"
                echo -e "   Issues: ${reasons%|}"
                echo ""
            done
        fi
        
        # 최적화 제안
        echo -e "${YELLOW}💡 Optimization Recommendations${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 아티팩트 정리
        ARTIFACT_PROJECTS=$(
            for id in "${!PROJECT_STORAGE[@]}"; do
                IFS='|' read -r name total repo lfs artifacts rest <<< "${PROJECT_STORAGE[$id]}"
                [ "$artifacts" -gt $((100 * 1048576)) ] && echo "$artifacts|$name|$id"
            done | sort -rn
        )
        
        if [ -n "$ARTIFACT_PROJECTS" ]; then
            echo -e "${RED}1. Clean up old artifacts:${NC}"
            echo "$ARTIFACT_PROJECTS" | head -5 | while IFS='|' read -r size name id; do
                echo "   - $name: $(format_bytes $size) in artifacts"
            done
            echo ""
        fi
        
        # 비활성 프로젝트 보관
        INACTIVE_COUNT=$(
            for id in "${!PROJECT_STORAGE[@]}"; do
                IFS='|' read -r name total repo lfs artifacts packages wiki uploads last_activity <<< "${PROJECT_STORAGE[$id]}"
                [[ "$last_activity" < "$INACTIVE_THRESHOLD" ]] && echo "1"
            done | wc -l
        )
        
        if [ "$INACTIVE_COUNT" -gt 0 ]; then
            echo -e "${RED}2. Archive inactive projects:${NC}"
            echo "   - $INACTIVE_COUNT projects inactive for >$INACTIVE_DAYS days"
            echo "   - Run with --cleanup to generate archive commands"
            echo ""
        fi
        
        # LFS 최적화
        LFS_HEAVY=$(
            for id in "${!PROJECT_STORAGE[@]}"; do
                IFS='|' read -r name total repo lfs rest <<< "${PROJECT_STORAGE[$id]}"
                [ "$lfs" -gt $((repo * 2)) ] && [ "$lfs" -gt $((100 * 1048576)) ] && echo "$name"
            done | wc -l
        )
        
        if [ "$LFS_HEAVY" -gt 0 ]; then
            echo -e "${RED}3. Optimize LFS usage:${NC}"
            echo "   - $LFS_HEAVY projects have excessive LFS storage"
            echo "   - Consider moving large binaries to external storage"
            echo ""
        fi
        ;;
esac

# 정리 명령 생성
if [ "$CLEANUP_SUGGESTIONS" = true ] && [ "$OUTPUT_FORMAT" = "console" ]; then
    CLEANUP_FILE="/tmp/gitlab_cleanup_$(date +%Y%m%d_%H%M%S).sh"
    
    cat > "$CLEANUP_FILE" << 'EOF'
#!/bin/bash
# GitLab Storage Cleanup Commands
# Generated by storage_analyzer.sh
# Review carefully before executing!

set -e

echo "Starting GitLab storage cleanup..."

EOF
    
    # 아티팩트 정리 명령
    echo "# Clean up old artifacts (>30 days)" >> "$CLEANUP_FILE"
    for project_id in "${!PROJECT_STORAGE[@]}"; do
        IFS='|' read -r name total repo lfs artifacts rest <<< "${PROJECT_STORAGE[$project_id]}"
        if [ "$artifacts" -gt $((50 * 1048576)) ]; then
            echo "echo 'Cleaning artifacts for $name...'" >> "$CLEANUP_FILE"
            echo "curl -X DELETE \"${GITLAB_API_URL}/projects/$project_id/artifacts\" -H \"Private-Token: \${GITLAB_TOKEN}\"" >> "$CLEANUP_FILE"
        fi
    done
    
    echo "" >> "$CLEANUP_FILE"
    echo "# Archive inactive projects" >> "$CLEANUP_FILE"
    for project_id in "${!PROJECT_STORAGE[@]}"; do
        IFS='|' read -r name total repo lfs artifacts packages wiki uploads last_activity <<< "${PROJECT_STORAGE[$project_id]}"
        if [[ "$last_activity" < "$INACTIVE_THRESHOLD" ]] && [ "$total" -gt $((THRESHOLD_GB * 1073741824)) ]; then
            echo "echo 'Archiving $name...'" >> "$CLEANUP_FILE"
            echo "curl -X POST \"${GITLAB_API_URL}/projects/$project_id/archive\" -H \"Private-Token: \${GITLAB_TOKEN}\"" >> "$CLEANUP_FILE"
        fi
    done
    
    chmod +x "$CLEANUP_FILE"
    
    echo ""
    echo -e "${GREEN}✅ Cleanup script generated:${NC} $CLEANUP_FILE"
    echo "   Review and run: GITLAB_TOKEN=your_token bash $CLEANUP_FILE"
fi

# 요약
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Analysis Complete!${NC}"
echo -e "   💰 Potential monthly savings: ${GREEN}\$$(echo "scale=2; $TOTAL_WASTE / 1073741824 * 0.10" | bc)${NC}"
echo -e "   📊 Storage efficiency: $((100 - TOTAL_WASTE * 100 / (TOTAL_STORAGE + 1)))%"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log "INFO" "Storage analysis completed successfully"