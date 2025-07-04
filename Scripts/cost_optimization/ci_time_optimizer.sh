#!/bin/bash

# GitLab CI Time Optimizer - CI/CD 파이프라인 최적화
# 빌드 시간을 단축하고 리소스 사용을 최적화

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
ANALYSIS_DAYS=30
PROJECT_ID=""
GROUP_ID=""
GENERATE_CONFIG=false
OUTPUT_FORMAT="console"
OPTIMIZATION_LEVEL="moderate"  # conservative, moderate, aggressive

show_help() {
    cat << EOF
GitLab CI Time Optimizer - Pipeline Performance Optimization

Usage: $(basename "$0") [OPTIONS]

Options:
    -p, --project ID       Analyze specific project
    -g, --group ID        Analyze all projects in group
    -d, --days DAYS       Analysis period in days (default: 30)
    -o, --optimize LEVEL  Optimization level: conservative/moderate/aggressive (default: moderate)
    -c, --config          Generate optimized .gitlab-ci.yml suggestions
    -f, --format FORMAT   Output format: console/json/yaml (default: console)
    -h, --help           Show this help message

Examples:
    # Analyze project CI performance
    $(basename "$0") --project 123 --days 7

    # Generate optimized CI config for group
    $(basename "$0") --group 45 --config --optimize aggressive

    # Export optimization report
    $(basename "$0") --project 123 --format json > ci_optimization.json

Description:
    Analyzes CI/CD pipeline performance and provides:
    - Bottleneck identification
    - Cache optimization suggestions
    - Parallel job recommendations
    - Resource allocation improvements
    - Cost reduction strategies
    
    Typical improvements: 30-60% build time reduction
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
        -g|--group)
            GROUP_ID="$2"
            validate_group_id "$GROUP_ID" || error_exit "Invalid group ID: $GROUP_ID" 1
            shift 2
            ;;
        -d|--days)
            ANALYSIS_DAYS="$2"
            shift 2
            ;;
        -o|--optimize)
            OPTIMIZATION_LEVEL="$2"
            shift 2
            ;;
        -c|--config)
            GENERATE_CONFIG=true
            shift
            ;;
        -f|--format)
            OUTPUT_FORMAT="$2"
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

# 파라미터 확인
[ -z "$PROJECT_ID" ] && [ -z "$GROUP_ID" ] && error_exit "Either project ID (-p) or group ID (-g) is required" 1

# 초기화
init_script
load_config "$BASE_DIR/config/gitlab.env"

# CI 분석 시작
log "INFO" "Starting CI/CD time optimization analysis..."

# 전역 변수
declare -A PIPELINE_STATS
declare -A JOB_STATS
declare -A STAGE_STATS
TOTAL_PIPELINES=0
TOTAL_TIME=0
FAILED_PIPELINES=0

# 날짜 계산
END_DATE=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
START_DATE=$(date -u -v-${ANALYSIS_DAYS}d '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d "${ANALYSIS_DAYS} days ago" '+%Y-%m-%dT%H:%M:%SZ')

# 파이프라인 분석
analyze_pipeline() {
    local pipeline=$1
    local project_id=$2
    
    local pipeline_id=$(echo "$pipeline" | jq -r '.id')
    local status=$(echo "$pipeline" | jq -r '.status')
    local duration=$(echo "$pipeline" | jq -r '.duration // 0')
    local created_at=$(echo "$pipeline" | jq -r '.created_at')
    local ref=$(echo "$pipeline" | jq -r '.ref')
    
    ((TOTAL_PIPELINES++))
    TOTAL_TIME=$((TOTAL_TIME + duration))
    
    [ "$status" = "failed" ] && ((FAILED_PIPELINES++))
    
    # 상세 작업 정보 가져오기
    local jobs=$(gitlab_api "GET" "/projects/$project_id/pipelines/$pipeline_id/jobs?per_page=100")
    if [ $? -eq 200 ]; then
        echo "$jobs" | jq -c '.[]' | while IFS= read -r job; do
            local job_name=$(echo "$job" | jq -r '.name')
            local job_stage=$(echo "$job" | jq -r '.stage')
            local job_duration=$(echo "$job" | jq -r '.duration // 0')
            local job_status=$(echo "$job" | jq -r '.status')
            
            # 작업별 통계
            local key="${job_stage}:${job_name}"
            if [ -n "${JOB_STATS[$key]}" ]; then
                IFS='|' read -r count total_duration failures <<< "${JOB_STATS[$key]}"
                ((count++))
                total_duration=$((total_duration + job_duration))
                [ "$job_status" = "failed" ] && ((failures++))
                JOB_STATS[$key]="$count|$total_duration|$failures"
            else
                [ "$job_status" = "failed" ] && failures=1 || failures=0
                JOB_STATS[$key]="1|$job_duration|$failures"
            fi
            
            # 스테이지별 통계
            if [ -n "${STAGE_STATS[$job_stage]}" ]; then
                IFS='|' read -r stage_count stage_duration <<< "${STAGE_STATS[$job_stage]}"
                ((stage_count++))
                stage_duration=$((stage_duration + job_duration))
                STAGE_STATS[$job_stage]="$stage_count|$stage_duration"
            else
                STAGE_STATS[$job_stage]="1|$job_duration"
            fi
        done
    fi
}

# 최적화 제안 생성
generate_optimizations() {
    local optimizations=()
    
    # 1. 캐시 최적화
    local cache_miss_rate=0
    for key in "${!JOB_STATS[@]}"; do
        if [[ "$key" == *"install"* ]] || [[ "$key" == *"dependencies"* ]]; then
            IFS='|' read -r count duration failures <<< "${JOB_STATS[$key]}"
            local avg_duration=$((duration / count))
            if [ "$avg_duration" -gt 120 ]; then
                optimizations+=("CACHE|Implement dependency caching for $key (saves ~$((avg_duration / 2))s per build)")
            fi
        fi
    done
    
    # 2. 병렬화 기회
    local sequential_stages=0
    local total_stage_time=0
    for stage in "${!STAGE_STATS[@]}"; do
        IFS='|' read -r count duration <<< "${STAGE_STATS[$stage]}"
        total_stage_time=$((total_stage_time + duration / count))
        ((sequential_stages++))
    done
    
    if [ "$sequential_stages" -gt 3 ] && [ "$total_stage_time" -gt 600 ]; then
        optimizations+=("PARALLEL|Parallelize independent stages (potential 40% time reduction)")
    fi
    
    # 3. 실패율 높은 작업
    for key in "${!JOB_STATS[@]}"; do
        IFS='|' read -r count duration failures <<< "${JOB_STATS[$key]}"
        local failure_rate=$((failures * 100 / count))
        if [ "$failure_rate" -gt 20 ]; then
            optimizations+=("RELIABILITY|Fix flaky job $key (${failure_rate}% failure rate)")
        fi
    done
    
    # 4. 리소스 최적화
    local avg_pipeline_time=$((TOTAL_TIME / TOTAL_PIPELINES))
    if [ "$avg_pipeline_time" -gt 1200 ]; then
        optimizations+=("RESOURCE|Consider using larger runners for compute-intensive jobs")
    fi
    
    # 5. 단계 최적화
    if [ "${#STAGE_STATS[@]}" -gt 5 ]; then
        optimizations+=("STAGES|Consolidate stages - too many stages (${#STAGE_STATS[@]}) cause overhead")
    fi
    
    printf '%s\n' "${optimizations[@]}"
}

# 최적화된 CI 설정 생성
generate_optimized_config() {
    cat << 'EOF'
# Optimized GitLab CI Configuration
# Generated by CI Time Optimizer

# Global optimization settings
variables:
  # Enable caching
  PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"
  NPM_CONFIG_CACHE: "$CI_PROJECT_DIR/.cache/npm"
  MAVEN_OPTS: "-Dmaven.repo.local=$CI_PROJECT_DIR/.m2/repository"
  
  # Parallel execution
  PARALLEL_JOBS: 4
  
  # Fail fast
  GIT_STRATEGY: fetch
  GIT_DEPTH: 1

# Optimized cache configuration
.cache_template: &cache_config
  cache:
    key:
      files:
        - package-lock.json
        - requirements.txt
        - pom.xml
        - go.mod
    paths:
      - .cache/
      - node_modules/
      - .m2/
      - vendor/
    policy: pull-push

# Optimized stages
stages:
  - prepare
  - build-test  # Combined stage
  - deploy

# Template for parallel jobs
.parallel_template: &parallel_config
  parallel:
    matrix:
      - TEST_SUITE: [unit, integration, e2e]
  script:
    - ./run-tests.sh $TEST_SUITE

# Jobs
prepare:dependencies:
  stage: prepare
  <<: *cache_config
  script:
    - echo "Installing dependencies..."
    - |
      if [ -f package.json ]; then
        npm ci --prefer-offline --no-audit
      elif [ -f requirements.txt ]; then
        pip install -r requirements.txt
      elif [ -f go.mod ]; then
        go mod download
      fi
  artifacts:
    expire_in: 1 hour
    paths:
      - node_modules/
      - .cache/

build:
  stage: build-test
  <<: *cache_config
  needs: ["prepare:dependencies"]
  script:
    - echo "Building application..."
    - make build
  artifacts:
    expire_in: 1 hour
    paths:
      - dist/
      - build/

test:
  stage: build-test
  <<: *cache_config
  <<: *parallel_config
  needs: ["prepare:dependencies"]
  coverage: '/TOTAL.*\s+(\d+%)$/'
  
lint:
  stage: build-test
  <<: *cache_config
  needs: ["prepare:dependencies"]
  script:
    - make lint
  allow_failure: true
  
# Conditional deployment
deploy:production:
  stage: deploy
  needs: ["build", "test"]
  script:
    - echo "Deploying to production..."
  only:
    - main
  when: manual
  environment:
    name: production
    url: https://example.com

# DAG optimization example
workflow:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
      variables:
        TEST_LEVEL: "quick"
    - if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
      variables:
        TEST_LEVEL: "full"
    - when: always

# Resource optimization
default:
  tags:
    - docker
  interruptible: true
  retry:
    max: 2
    when:
      - runner_system_failure
      - stuck_or_timeout_failure
EOF
}

# 메인 분석 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}              GitLab CI/CD Time Optimizer                     ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📅 Analysis Period: Last $ANALYSIS_DAYS days"
echo -e "🎯 Optimization Level: $OPTIMIZATION_LEVEL"
echo ""

# 프로젝트 수집
PROJECTS=()
if [ -n "$PROJECT_ID" ]; then
    PROJECTS+=("$PROJECT_ID")
    echo "📁 Analyzing project ID: $PROJECT_ID"
elif [ -n "$GROUP_ID" ]; then
    echo "📁 Analyzing group ID: $GROUP_ID"
    GROUP_PROJECTS=$(gitlab_api "GET" "/groups/$GROUP_ID/projects?include_subgroups=true&per_page=100")
    if [ $? -eq 200 ]; then
        while IFS= read -r proj_id; do
            PROJECTS+=("$proj_id")
        done < <(echo "$GROUP_PROJECTS" | jq -r '.[].id')
    fi
fi

echo "📊 Found ${#PROJECTS[@]} projects to analyze"
echo ""

# 각 프로젝트의 파이프라인 분석
CURRENT=0
for project_id in "${PROJECTS[@]}"; do
    ((CURRENT++))
    show_progress "$CURRENT" "${#PROJECTS[@]}" "Analyzing projects"
    
    # 파이프라인 가져오기
    PIPELINES=$(gitlab_api "GET" "/projects/$project_id/pipelines?updated_after=$START_DATE&per_page=100")
    if [ $? -eq 200 ]; then
        echo "$PIPELINES" | jq -c '.[]' | while IFS= read -r pipeline; do
            analyze_pipeline "$pipeline" "$project_id"
        done
    fi
done

echo ""
echo ""

# 결과 출력
case "$OUTPUT_FORMAT" in
    json)
        # JSON 출력
        echo "{"
        echo "  \"summary\": {"
        echo "    \"total_pipelines\": $TOTAL_PIPELINES,"
        echo "    \"total_time_seconds\": $TOTAL_TIME,"
        echo "    \"average_time_seconds\": $((TOTAL_TIME / (TOTAL_PIPELINES + 1))),"
        echo "    \"failure_rate\": $((FAILED_PIPELINES * 100 / (TOTAL_PIPELINES + 1)))"
        echo "  },"
        echo "  \"stages\": {"
        for stage in "${!STAGE_STATS[@]}"; do
            IFS='|' read -r count duration <<< "${STAGE_STATS[$stage]}"
            echo "    \"$stage\": {"
            echo "      \"count\": $count,"
            echo "      \"total_duration\": $duration,"
            echo "      \"average_duration\": $((duration / count))"
            echo "    },"
        done | sed '$ s/,$//'
        echo "  },"
        echo "  \"optimizations\": ["
        generate_optimizations | while IFS='|' read -r type suggestion; do
            echo "    {\"type\": \"$type\", \"suggestion\": \"$suggestion\"},"
        done | sed '$ s/,$//'
        echo "  ]"
        echo "}"
        ;;
    yaml)
        # YAML config 출력
        if [ "$GENERATE_CONFIG" = true ]; then
            generate_optimized_config
        else
            echo "# CI Performance Report"
            echo "summary:"
            echo "  total_pipelines: $TOTAL_PIPELINES"
            echo "  average_time: $((TOTAL_TIME / (TOTAL_PIPELINES + 1)))s"
            echo "  failure_rate: $((FAILED_PIPELINES * 100 / (TOTAL_PIPELINES + 1)))%"
        fi
        ;;
    *)
        # 콘솔 출력
        echo -e "${YELLOW}📊 CI/CD Performance Summary${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        AVG_TIME=$((TOTAL_TIME / (TOTAL_PIPELINES + 1)))
        echo -e "Total Pipelines: ${YELLOW}$TOTAL_PIPELINES${NC}"
        echo -e "Average Duration: ${YELLOW}$((AVG_TIME / 60))m $((AVG_TIME % 60))s${NC}"
        echo -e "Total CI Time: ${YELLOW}$((TOTAL_TIME / 3600))h${NC}"
        echo -e "Failure Rate: $([ "$((FAILED_PIPELINES * 100 / (TOTAL_PIPELINES + 1)))" -gt 10 ] && echo -e "${RED}" || echo -e "${GREEN}")$((FAILED_PIPELINES * 100 / (TOTAL_PIPELINES + 1)))%${NC}"
        echo ""
        
        # 스테이지 분석
        echo -e "${YELLOW}⏱️  Stage Performance${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # 스테이지별 시간 정렬
        for stage in "${!STAGE_STATS[@]}"; do
            IFS='|' read -r count duration <<< "${STAGE_STATS[$stage]}"
            avg_duration=$((duration / count))
            echo "$avg_duration|$stage|$count"
        done | sort -rn | while IFS='|' read -r avg_duration stage count; do
            printf "%-20s %5ds (avg) × %d runs = %s total\n" \
                "$stage:" \
                "$avg_duration" \
                "$count" \
                "$((avg_duration * count / 60))m"
        done
        echo ""
        
        # 가장 느린 작업
        echo -e "${YELLOW}🐌 Slowest Jobs (Top 10)${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        for key in "${!JOB_STATS[@]}"; do
            IFS='|' read -r count duration failures <<< "${JOB_STATS[$key]}"
            avg_duration=$((duration / count))
            echo "$avg_duration|$key|$count|$failures"
        done | sort -rn | head -10 | while IFS='|' read -r avg_duration key count failures; do
            IFS=':' read -r stage job <<< "$key"
            failure_rate=$((failures * 100 / count))
            
            printf "%-40s %5ds" "$job ($stage)" "$avg_duration"
            [ "$failure_rate" -gt 0 ] && printf " ${RED}[%d%% failures]${NC}" "$failure_rate"
            echo ""
        done
        echo ""
        
        # 최적화 제안
        echo -e "${YELLOW}💡 Optimization Recommendations${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        RECOMMENDATIONS=$(generate_optimizations)
        if [ -z "$RECOMMENDATIONS" ]; then
            echo -e "${GREEN}✅ Your CI/CD pipeline is well-optimized!${NC}"
        else
            local rec_count=1
            echo "$RECOMMENDATIONS" | while IFS='|' read -r type suggestion; do
                case "$type" in
                    CACHE)
                        echo -e "${rec_count}. ${CYAN}🗄️  Cache Optimization:${NC}"
                        ;;
                    PARALLEL)
                        echo -e "${rec_count}. ${MAGENTA}⚡ Parallelization:${NC}"
                        ;;
                    RELIABILITY)
                        echo -e "${rec_count}. ${RED}🔧 Reliability:${NC}"
                        ;;
                    RESOURCE)
                        echo -e "${rec_count}. ${YELLOW}💪 Resources:${NC}"
                        ;;
                    STAGES)
                        echo -e "${rec_count}. ${BLUE}📋 Stage Design:${NC}"
                        ;;
                esac
                echo "   $suggestion"
                echo ""
                ((rec_count++))
            done
        fi
        
        # 예상 개선 효과
        echo -e "${YELLOW}📈 Expected Improvements${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        case "$OPTIMIZATION_LEVEL" in
            conservative)
                IMPROVEMENT=20
                echo "With conservative optimizations:"
                ;;
            moderate)
                IMPROVEMENT=40
                echo "With moderate optimizations:"
                ;;
            aggressive)
                IMPROVEMENT=60
                echo "With aggressive optimizations:"
                ;;
        esac
        
        NEW_AVG_TIME=$((AVG_TIME * (100 - IMPROVEMENT) / 100))
        SAVED_TIME=$((AVG_TIME - NEW_AVG_TIME))
        MONTHLY_SAVINGS=$((SAVED_TIME * TOTAL_PIPELINES * 30 / ANALYSIS_DAYS / 60))
        
        echo -e "   • Build time: ${GREEN}$((NEW_AVG_TIME / 60))m${NC} (↓$((SAVED_TIME / 60))m per build)"
        echo -e "   • Monthly time saved: ${GREEN}$((MONTHLY_SAVINGS / 60))h${NC}"
        echo -e "   • Cost reduction: ${GREEN}~$((IMPROVEMENT / 2))%${NC}"
        
        # CI 비용 계산 (추정)
        CI_MINUTE_COST=0.008
        CURRENT_COST=$(echo "scale=2; $TOTAL_TIME * 30 / $ANALYSIS_DAYS / 60 * $CI_MINUTE_COST" | bc)
        SAVINGS=$(echo "scale=2; $CURRENT_COST * $IMPROVEMENT / 100" | bc)
        
        echo -e "   • Estimated monthly savings: ${GREEN}\$$SAVINGS${NC}"
        ;;
esac

# 최적화된 설정 생성
if [ "$GENERATE_CONFIG" = true ] && [ "$OUTPUT_FORMAT" = "console" ]; then
    CONFIG_FILE="$BASE_DIR/logs/optimized_gitlab_ci_$(date +%Y%m%d_%H%M%S).yml"
    generate_optimized_config > "$CONFIG_FILE"
    
    echo ""
    echo -e "${GREEN}📄 Optimized CI configuration saved to:${NC}"
    echo "   $CONFIG_FILE"
    echo ""
    echo "To apply optimizations:"
    echo "1. Review the generated configuration"
    echo "2. Merge with your existing .gitlab-ci.yml"
    echo "3. Test in a feature branch first"
    echo "4. Monitor performance improvements"
fi

# 실시간 모니터링 제안
if [ "$TOTAL_PIPELINES" -gt 100 ]; then
    echo ""
    echo -e "${CYAN}🔍 Continuous Monitoring:${NC}"
    echo "   Consider setting up a CI performance dashboard:"
    echo "   • Track build time trends"
    echo "   • Monitor failure rates"
    echo "   • Alert on performance degradation"
    echo "   • Regular optimization reviews"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ CI Time Optimization Analysis Complete!${NC}"
echo -e "   🚀 Potential time savings: ${GREEN}$((IMPROVEMENT))%${NC}"
echo -e "   💰 ROI: Implement in <1 day, save $((MONTHLY_SAVINGS / 60))h/month"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log "INFO" "CI time optimization analysis completed"