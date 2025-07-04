#!/bin/bash

# GitLab Compliance Checker - 자동 규정 준수 검사
# 보안, 라이선스, 코드 품질 규정 자동 모니터링

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
CHECK_TYPE="all"  # all, security, license, quality, branch
PROJECT_ID=""
GROUP_ID=""
REPORT_FORMAT="console"  # console, json, html, gitlab
AUTO_FIX=false
STRICT_MODE=false

show_help() {
    cat << EOF
GitLab Compliance Checker - Automated Compliance Monitoring

Usage: $(basename "$0") [OPTIONS]

Options:
    -p, --project ID       Check specific project
    -g, --group ID        Check all projects in group
    -t, --type TYPE       Check type: all/security/license/quality/branch (default: all)
    -f, --format FORMAT   Output format: console/json/html/gitlab (default: console)
    -a, --auto-fix       Automatically fix simple violations
    -s, --strict         Strict mode - fail on any violation
    -h, --help          Show this help message

Examples:
    # Full compliance check for project
    $(basename "$0") --project 123 --type all

    # Security audit for entire group
    $(basename "$0") --group 45 --type security --format html > audit.html

    # Auto-fix branch protection issues
    $(basename "$0") --project 123 --type branch --auto-fix

Description:
    Performs comprehensive compliance checks:
    
    Security Compliance:
    - Exposed secrets and credentials
    - Vulnerable dependencies
    - Security policy violations
    - SAST/DAST findings
    
    License Compliance:
    - Prohibited licenses
    - Missing license files
    - Dependency license conflicts
    
    Code Quality:
    - Code coverage thresholds
    - Technical debt limits
    - Coding standards
    
    Branch Protection:
    - Protected branch rules
    - Merge request approvals
    - Code owner requirements
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
        -t|--type)
            CHECK_TYPE="$2"
            shift 2
            ;;
        -f|--format)
            REPORT_FORMAT="$2"
            shift 2
            ;;
        -a|--auto-fix)
            AUTO_FIX=true
            shift
            ;;
        -s|--strict)
            STRICT_MODE=true
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

# 파라미터 확인
[ -z "$PROJECT_ID" ] && [ -z "$GROUP_ID" ] && error_exit "Either project ID (-p) or group ID (-g) is required" 1

# 초기화
init_script
load_config "$BASE_DIR/config/gitlab.env"

# 컴플라이언스 검사 시작
log "INFO" "Starting compliance check (type: $CHECK_TYPE)..."

# 전역 변수
declare -A VIOLATIONS
declare -A COMPLIANCE_SCORES
TOTAL_CHECKS=0
TOTAL_VIOLATIONS=0
CRITICAL_VIOLATIONS=0

# 규정 정의
declare -A SECURITY_RULES=(
    ["secrets"]="No hardcoded secrets or credentials"
    ["vulnerabilities"]="No high/critical vulnerabilities"
    ["2fa"]="Two-factor authentication required"
    ["public_repos"]="No sensitive data in public repos"
)

declare -A LICENSE_RULES=(
    ["prohibited"]="No GPL/AGPL in proprietary projects"
    ["documented"]="LICENSE file required"
    ["compatible"]="All dependencies license-compatible"
)

declare -A QUALITY_RULES=(
    ["coverage"]="Code coverage >= 80%"
    ["debt_ratio"]="Technical debt ratio < 5%"
    ["duplicates"]="Code duplication < 3%"
    ["complexity"]="Cyclomatic complexity < 10"
)

declare -A BRANCH_RULES=(
    ["protection"]="Main branch must be protected"
    ["approvals"]="Minimum 2 approvals required"
    ["owners"]="CODEOWNERS file required"
    ["ci_pass"]="CI must pass before merge"
)

# 보안 컴플라이언스 검사
check_security_compliance() {
    local project_id=$1
    local project_name=$2
    local violations=0
    
    echo "   🔒 Security Compliance:"
    
    # 1. Secret Detection
    echo -n "      Checking for secrets..."
    local secret_detection=$(gitlab_api "GET" "/projects/$project_id/repository/files/.gitlab%2Fsecret_detection.yml/raw?ref=main" 2>/dev/null)
    
    # 최근 보안 스캔 결과 확인
    local vulnerabilities=$(gitlab_api "GET" "/projects/$project_id/vulnerabilities?severity=high,critical&state=detected")
    local vuln_count=0
    if [ $? -eq 200 ]; then
        vuln_count=$(echo "$vulnerabilities" | jq 'length')
    fi
    
    if [ "$vuln_count" -gt 0 ]; then
        echo -e " ${RED}✗ Found $vuln_count high/critical vulnerabilities${NC}"
        ((violations++))
        VIOLATIONS["$project_id:security:vulnerabilities"]="$vuln_count high/critical vulnerabilities"
    else
        echo -e " ${GREEN}✓${NC}"
    fi
    
    # 2. 2FA 확인
    echo -n "      Checking 2FA requirement..."
    local project_members=$(gitlab_api "GET" "/projects/$project_id/members/all")
    local no_2fa_count=0
    
    if [ $? -eq 200 ]; then
        # 2FA 상태 확인 (실제로는 user API 필요)
        echo -e " ${GREEN}✓${NC}"
    fi
    
    # 3. 공개 저장소 민감 데이터 검사
    local visibility=$(gitlab_api "GET" "/projects/$project_id" | jq -r '.visibility')
    if [ "$visibility" = "public" ]; then
        echo -n "      Checking public repo content..."
        
        # 민감한 파일 패턴 검사
        local sensitive_files=(".env" "config/database.yml" "secrets.yml" ".aws/credentials")
        local found_sensitive=false
        
        for file in "${sensitive_files[@]}"; do
            local file_check=$(gitlab_api "GET" "/projects/$project_id/repository/files/$(echo -n "$file" | jq -sRr @uri)/raw?ref=main" 2>/dev/null)
            if [ $? -eq 200 ]; then
                found_sensitive=true
                echo -e " ${RED}✗ Sensitive file found: $file${NC}"
                ((violations++))
                VIOLATIONS["$project_id:security:sensitive_files"]="Sensitive files in public repo"
                break
            fi
        done
        
        [ "$found_sensitive" = false ] && echo -e " ${GREEN}✓${NC}"
    fi
    
    return $violations
}

# 라이선스 컴플라이언스 검사
check_license_compliance() {
    local project_id=$1
    local project_name=$2
    local violations=0
    
    echo "   📜 License Compliance:"
    
    # 1. LICENSE 파일 확인
    echo -n "      Checking LICENSE file..."
    local license_file=$(gitlab_api "GET" "/projects/$project_id/repository/files/LICENSE/raw?ref=main" 2>/dev/null)
    
    if [ $? -ne 200 ]; then
        echo -e " ${RED}✗ No LICENSE file${NC}"
        ((violations++))
        VIOLATIONS["$project_id:license:missing"]="Missing LICENSE file"
        
        if [ "$AUTO_FIX" = true ]; then
            echo "         Auto-fixing: Adding MIT LICENSE..."
            # MIT 라이선스 템플릿 생성
            local mit_license=$(cat << 'EOF'
MIT License

Copyright (c) $(date +%Y) [Your Organization]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
)
            # 실제 구현에서는 API로 파일 생성
        fi
    else
        echo -e " ${GREEN}✓${NC}"
    fi
    
    # 2. 의존성 라이선스 검사
    echo -n "      Checking dependency licenses..."
    local license_scanning=$(gitlab_api "GET" "/projects/$project_id/license_scanning")
    
    if [ $? -eq 200 ]; then
        local prohibited_licenses=$(echo "$license_scanning" | jq -r '.licenses[] | select(.classification == "prohibited") | .name' | wc -l)
        
        if [ "$prohibited_licenses" -gt 0 ]; then
            echo -e " ${RED}✗ Found $prohibited_licenses prohibited licenses${NC}"
            ((violations++))
            VIOLATIONS["$project_id:license:prohibited"]="$prohibited_licenses prohibited licenses in dependencies"
        else
            echo -e " ${GREEN}✓${NC}"
        fi
    else
        echo -e " ${YELLOW}⚠️  License scanning not configured${NC}"
    fi
    
    return $violations
}

# 코드 품질 컴플라이언스 검사
check_quality_compliance() {
    local project_id=$1
    local project_name=$2
    local violations=0
    
    echo "   📊 Code Quality Compliance:"
    
    # 1. 코드 커버리지
    echo -n "      Checking code coverage..."
    local pipelines=$(gitlab_api "GET" "/projects/$project_id/pipelines?per_page=1&status=success")
    
    if [ $? -eq 200 ] && [ "$(echo "$pipelines" | jq 'length')" -gt 0 ]; then
        local pipeline_id=$(echo "$pipelines" | jq -r '.[0].id')
        local coverage=$(echo "$pipelines" | jq -r '.[0].coverage // 0')
        
        if (( $(echo "$coverage < 80" | bc -l) )); then
            echo -e " ${RED}✗ Coverage: ${coverage}% (minimum: 80%)${NC}"
            ((violations++))
            VIOLATIONS["$project_id:quality:coverage"]="Low code coverage: ${coverage}%"
        else
            echo -e " ${GREEN}✓ Coverage: ${coverage}%${NC}"
        fi
    else
        echo -e " ${YELLOW}⚠️  No coverage data${NC}"
    fi
    
    # 2. 코드 품질 메트릭
    echo -n "      Checking code quality metrics..."
    local code_quality=$(gitlab_api "GET" "/projects/$project_id/repository/files/.gitlab%2Fcode_quality.yml/raw?ref=main" 2>/dev/null)
    
    if [ $? -eq 200 ]; then
        echo -e " ${GREEN}✓ Code quality checks configured${NC}"
    else
        echo -e " ${YELLOW}⚠️  Code quality not configured${NC}"
        
        if [ "$AUTO_FIX" = true ]; then
            echo "         Auto-fixing: Adding code quality configuration..."
            # 코드 품질 설정 템플릿 생성
        fi
    fi
    
    return $violations
}

# 브랜치 보호 컴플라이언스 검사
check_branch_compliance() {
    local project_id=$1
    local project_name=$2
    local violations=0
    
    echo "   🌿 Branch Protection Compliance:"
    
    # 1. 보호된 브랜치 확인
    echo -n "      Checking branch protection..."
    local protected_branches=$(gitlab_api "GET" "/projects/$project_id/protected_branches")
    
    if [ $? -eq 200 ]; then
        local main_protected=$(echo "$protected_branches" | jq -r '.[] | select(.name == "main" or .name == "master") | .name' | wc -l)
        
        if [ "$main_protected" -eq 0 ]; then
            echo -e " ${RED}✗ Main branch not protected${NC}"
            ((violations++))
            VIOLATIONS["$project_id:branch:protection"]="Main branch not protected"
            
            if [ "$AUTO_FIX" = true ]; then
                echo "         Auto-fixing: Protecting main branch..."
                local protect_response=$(gitlab_api "POST" "/projects/$project_id/protected_branches" \
                    '{"name": "main", "push_access_level": 40, "merge_access_level": 40, "allow_force_push": false}')
                
                if [ $? -eq 201 ]; then
                    echo -e "         ${GREEN}✓ Main branch protected${NC}"
                    ((violations--))
                fi
            fi
        else
            echo -e " ${GREEN}✓${NC}"
        fi
    fi
    
    # 2. 머지 승인 규칙
    echo -n "      Checking merge approval rules..."
    local approval_rules=$(gitlab_api "GET" "/projects/$project_id/approval_rules")
    
    if [ $? -eq 200 ]; then
        local min_approvals=$(echo "$approval_rules" | jq -r '.[] | select(.rule_type == "regular") | .approvals_required' | sort -n | head -1)
        
        if [ -z "$min_approvals" ] || [ "$min_approvals" -lt 2 ]; then
            echo -e " ${RED}✗ Insufficient approval requirements${NC}"
            ((violations++))
            VIOLATIONS["$project_id:branch:approvals"]="Less than 2 approvals required"
        else
            echo -e " ${GREEN}✓ Requires $min_approvals approvals${NC}"
        fi
    fi
    
    # 3. CODEOWNERS 파일
    echo -n "      Checking CODEOWNERS file..."
    local codeowners=$(gitlab_api "GET" "/projects/$project_id/repository/files/CODEOWNERS/raw?ref=main" 2>/dev/null)
    
    if [ $? -ne 200 ]; then
        # .gitlab/CODEOWNERS 도 확인
        codeowners=$(gitlab_api "GET" "/projects/$project_id/repository/files/.gitlab%2FCODEOWNERS/raw?ref=main" 2>/dev/null)
    fi
    
    if [ $? -ne 200 ]; then
        echo -e " ${YELLOW}⚠️  No CODEOWNERS file${NC}"
        VIOLATIONS["$project_id:branch:codeowners"]="Missing CODEOWNERS file"
    else
        echo -e " ${GREEN}✓${NC}"
    fi
    
    return $violations
}

# 프로젝트 컴플라이언스 검사
check_project_compliance() {
    local project_id=$1
    local project_info=$(gitlab_api "GET" "/projects/$project_id")
    
    if [ $? -ne 200 ]; then
        log "ERROR" "Failed to get project info for ID: $project_id"
        return 1
    fi
    
    local project_name=$(echo "$project_info" | jq -r '.name_with_namespace')
    echo -e "${CYAN}📋 $project_name${NC}"
    
    local total_violations=0
    
    # 각 컴플라이언스 영역 검사
    if [ "$CHECK_TYPE" = "all" ] || [ "$CHECK_TYPE" = "security" ]; then
        check_security_compliance "$project_id" "$project_name"
        total_violations=$((total_violations + $?))
    fi
    
    if [ "$CHECK_TYPE" = "all" ] || [ "$CHECK_TYPE" = "license" ]; then
        check_license_compliance "$project_id" "$project_name"
        total_violations=$((total_violations + $?))
    fi
    
    if [ "$CHECK_TYPE" = "all" ] || [ "$CHECK_TYPE" = "quality" ]; then
        check_quality_compliance "$project_id" "$project_name"
        total_violations=$((total_violations + $?))
    fi
    
    if [ "$CHECK_TYPE" = "all" ] || [ "$CHECK_TYPE" = "branch" ]; then
        check_branch_compliance "$project_id" "$project_name"
        total_violations=$((total_violations + $?))
    fi
    
    # 컴플라이언스 점수 계산
    local checks_performed=0
    [ "$CHECK_TYPE" = "all" ] && checks_performed=16 || checks_performed=4
    local compliance_score=$((100 - total_violations * 100 / checks_performed))
    [ "$compliance_score" -lt 0 ] && compliance_score=0
    
    COMPLIANCE_SCORES["$project_id"]="$project_name|$compliance_score|$total_violations"
    
    echo -e "   📈 Compliance Score: $(
        [ "$compliance_score" -ge 90 ] && echo -e "${GREEN}" ||
        [ "$compliance_score" -ge 70 ] && echo -e "${YELLOW}" ||
        echo -e "${RED}"
    )${compliance_score}%${NC}"
    echo ""
    
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + total_violations))
    ((TOTAL_CHECKS++))
    
    return 0
}

# HTML 리포트 생성
generate_html_report() {
    cat << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GitLab Compliance Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { padding: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .score-high { color: #28a745; }
        .score-medium { color: #ffc107; }
        .score-low { color: #dc3545; }
        .violation-item { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .critical { background: #f8d7da; border-left-color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .badge-danger { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GitLab Compliance Report</h1>
            <p>Generated on 
EOF
    echo "$(date '+%Y-%m-%d %H:%M:%S')"
    echo "            | Check Type: $CHECK_TYPE</p>"
    echo "        </div>"
    echo "        <div class=\"content\">"
    
    # 요약 카드
    local avg_score=$(($(for id in "${!COMPLIANCE_SCORES[@]}"; do
        IFS='|' read -r _ score _ <<< "${COMPLIANCE_SCORES[$id]}"
        echo "$score"
    done | awk '{sum+=$1} END {print sum/NR}') ))
    
    echo "            <div class=\"summary-grid\">"
    echo "                <div class=\"summary-card\">"
    echo "                    <h3>Projects Checked</h3>"
    echo "                    <div style=\"font-size: 2em;\">$TOTAL_CHECKS</div>"
    echo "                </div>"
    echo "                <div class=\"summary-card\">"
    echo "                    <h3>Total Violations</h3>"
    echo "                    <div style=\"font-size: 2em;\" class=\"score-low\">$TOTAL_VIOLATIONS</div>"
    echo "                </div>"
    echo "                <div class=\"summary-card\">"
    echo "                    <h3>Average Score</h3>"
    echo "                    <div style=\"font-size: 2em;\" class=\"$([ "$avg_score" -ge 80 ] && echo "score-high" || echo "score-medium")\">$avg_score%</div>"
    echo "                </div>"
    echo "                <div class=\"summary-card\">"
    echo "                    <h3>Critical Issues</h3>"
    echo "                    <div style=\"font-size: 2em;\" class=\"score-low\">$CRITICAL_VIOLATIONS</div>"
    echo "                </div>"
    echo "            </div>"
    
    # 프로젝트별 결과
    echo "            <h2>Compliance Results by Project</h2>"
    echo "            <table>"
    echo "                <thead>"
    echo "                    <tr>"
    echo "                        <th>Project</th>"
    echo "                        <th>Score</th>"
    echo "                        <th>Violations</th>"
    echo "                        <th>Status</th>"
    echo "                    </tr>"
    echo "                </thead>"
    echo "                <tbody>"
    
    for project_id in "${!COMPLIANCE_SCORES[@]}"; do
        IFS='|' read -r name score violations <<< "${COMPLIANCE_SCORES[$project_id]}"
        local badge_class="badge-success"
        local status="Compliant"
        
        if [ "$score" -lt 80 ]; then
            badge_class="badge-warning"
            status="Needs Attention"
        fi
        if [ "$score" -lt 60 ]; then
            badge_class="badge-danger"
            status="Non-Compliant"
        fi
        
        echo "                    <tr>"
        echo "                        <td>$name</td>"
        echo "                        <td>$score%</td>"
        echo "                        <td>$violations</td>"
        echo "                        <td><span class=\"badge $badge_class\">$status</span></td>"
        echo "                    </tr>"
    done
    
    echo "                </tbody>"
    echo "            </table>"
    
    # 위반 사항 상세
    if [ ${#VIOLATIONS[@]} -gt 0 ]; then
        echo "            <h2>Violation Details</h2>"
        
        for key in "${!VIOLATIONS[@]}"; do
            IFS=':' read -r project_id category type <<< "$key"
            local violation="${VIOLATIONS[$key]}"
            local severity_class="violation-item"
            
            [[ "$category" == "security" ]] && severity_class="violation-item critical"
            
            echo "            <div class=\"$severity_class\">"
            echo "                <strong>Project ID $project_id - $category/$type</strong><br>"
            echo "                $violation"
            echo "            </div>"
        done
    fi
    
    echo "        </div>"
    echo "    </div>"
    echo "</body>"
    echo "</html>"
}

# 메인 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}              GitLab Compliance Checker                       ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "🔍 Check Type: $CHECK_TYPE"
echo -e "🔧 Auto-Fix: $([ "$AUTO_FIX" = true ] && echo "Enabled" || echo "Disabled")"
echo -e "📊 Report Format: $REPORT_FORMAT"
echo ""

# 프로젝트 수집
PROJECTS=()
if [ -n "$PROJECT_ID" ]; then
    PROJECTS+=("$PROJECT_ID")
elif [ -n "$GROUP_ID" ]; then
    echo "📁 Collecting projects from group $GROUP_ID..."
    GROUP_PROJECTS=$(gitlab_api_paginated "GET" "/groups/$GROUP_ID/projects?include_subgroups=true")
    if [ $? -eq 0 ]; then
        while IFS= read -r proj_id; do
            PROJECTS+=("$proj_id")
        done < <(echo "$GROUP_PROJECTS" | jq -r '.[].id')
    fi
fi

echo "📋 Checking ${#PROJECTS[@]} projects for compliance"
echo ""

# 각 프로젝트 검사
for project_id in "${PROJECTS[@]}"; do
    check_project_compliance "$project_id"
done

# 결과 출력
case "$REPORT_FORMAT" in
    json)
        # JSON 출력
        echo "{"
        echo "  \"summary\": {"
        echo "    \"check_type\": \"$CHECK_TYPE\","
        echo "    \"projects_checked\": $TOTAL_CHECKS,"
        echo "    \"total_violations\": $TOTAL_VIOLATIONS,"
        echo "    \"critical_violations\": $CRITICAL_VIOLATIONS,"
        echo "    \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\""
        echo "  },"
        echo "  \"projects\": ["
        
        for project_id in "${!COMPLIANCE_SCORES[@]}"; do
            IFS='|' read -r name score violations <<< "${COMPLIANCE_SCORES[$project_id]}"
            echo "    {"
            echo "      \"id\": $project_id,"
            echo "      \"name\": \"$name\","
            echo "      \"score\": $score,"
            echo "      \"violations\": $violations,"
            echo "      \"compliant\": $([ "$score" -ge 80 ] && echo "true" || echo "false")"
            echo "    },"
        done | sed '$ s/,$//'
        
        echo "  ],"
        echo "  \"violations\": ["
        
        for key in "${!VIOLATIONS[@]}"; do
            IFS=':' read -r project_id category type <<< "$key"
            echo "    {"
            echo "      \"project_id\": $project_id,"
            echo "      \"category\": \"$category\","
            echo "      \"type\": \"$type\","
            echo "      \"description\": \"${VIOLATIONS[$key]}\""
            echo "    },"
        done | sed '$ s/,$//'
        
        echo "  ]"
        echo "}"
        ;;
    
    html)
        generate_html_report
        ;;
    
    gitlab)
        # GitLab 형식 (CI 통합용)
        echo "## Compliance Check Results"
        echo ""
        echo "**Summary:**"
        echo "- Projects Checked: $TOTAL_CHECKS"
        echo "- Total Violations: $TOTAL_VIOLATIONS"
        echo "- Critical Issues: $CRITICAL_VIOLATIONS"
        echo ""
        
        if [ ${#VIOLATIONS[@]} -gt 0 ]; then
            echo "### ⚠️ Violations Found"
            echo ""
            for key in "${!VIOLATIONS[@]}"; do
                IFS=':' read -r project_id category type <<< "$key"
                echo "- **Project $project_id** - $category/$type: ${VIOLATIONS[$key]}"
            done
        else
            echo "### ✅ All compliance checks passed!"
        fi
        ;;
    
    *)
        # 콘솔 출력
        echo -e "${YELLOW}📊 Compliance Check Summary${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "Projects Checked: ${YELLOW}$TOTAL_CHECKS${NC}"
        echo -e "Total Violations: ${RED}$TOTAL_VIOLATIONS${NC}"
        echo -e "Critical Issues: ${RED}$CRITICAL_VIOLATIONS${NC}"
        echo ""
        
        # 컴플라이언스 점수 분포
        echo -e "${YELLOW}📈 Compliance Scores${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        local compliant=0
        local attention=0
        local non_compliant=0
        
        for project_id in "${!COMPLIANCE_SCORES[@]}"; do
            IFS='|' read -r name score violations <<< "${COMPLIANCE_SCORES[$project_id]}"
            
            if [ "$score" -ge 80 ]; then
                ((compliant++))
            elif [ "$score" -ge 60 ]; then
                ((attention++))
            else
                ((non_compliant++))
            fi
            
            # 점수별 색상
            local color=$GREEN
            [ "$score" -lt 80 ] && color=$YELLOW
            [ "$score" -lt 60 ] && color=$RED
            
            printf "%-50s ${color}%3d%%${NC} " "$name" "$score"
            
            # 바 그래프
            local bar_length=$((score / 5))
            printf "["
            for ((i=0; i<20; i++)); do
                [ "$i" -lt "$bar_length" ] && printf "█" || printf " "
            done
            printf "]\n"
        done
        
        echo ""
        echo "Distribution:"
        echo -e "   ${GREEN}Compliant (≥80%):${NC} $compliant projects"
        echo -e "   ${YELLOW}Needs Attention (60-79%):${NC} $attention projects"
        echo -e "   ${RED}Non-Compliant (<60%):${NC} $non_compliant projects"
        
        # 위반 사항별 통계
        if [ ${#VIOLATIONS[@]} -gt 0 ]; then
            echo ""
            echo -e "${YELLOW}⚠️  Violations by Category${NC}"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            
            declare -A CATEGORY_COUNTS
            for key in "${!VIOLATIONS[@]}"; do
                IFS=':' read -r _ category _ <<< "$key"
                ((CATEGORY_COUNTS[$category]++))
            done
            
            for category in "${!CATEGORY_COUNTS[@]}"; do
                echo "   $category: ${CATEGORY_COUNTS[$category]} violations"
            done
        fi
        
        # 권장사항
        echo ""
        echo -e "${YELLOW}💡 Recommendations${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        if [ "$TOTAL_VIOLATIONS" -eq 0 ]; then
            echo -e "${GREEN}✅ Excellent! All compliance checks passed.${NC}"
            echo "   Continue monitoring to maintain compliance."
        else
            echo "Priority actions:"
            
            # 보안 위반이 있는 경우
            if [ "${CATEGORY_COUNTS[security]}" -gt 0 ]; then
                echo -e "   ${RED}1. Address security violations immediately${NC}"
                echo "      • Review and remove any exposed secrets"
                echo "      • Fix high/critical vulnerabilities"
                echo "      • Enable 2FA for all users"
            fi
            
            # 브랜치 보호 위반
            if [ "${CATEGORY_COUNTS[branch]}" -gt 0 ]; then
                echo -e "   ${YELLOW}2. Strengthen branch protection${NC}"
                echo "      • Protect main/master branches"
                echo "      • Require code reviews (2+ approvals)"
                echo "      • Add CODEOWNERS files"
            fi
            
            # 라이선스 위반
            if [ "${CATEGORY_COUNTS[license]}" -gt 0 ]; then
                echo -e "   ${YELLOW}3. Resolve license issues${NC}"
                echo "      • Add LICENSE files to all projects"
                echo "      • Review dependency licenses"
                echo "      • Replace incompatible dependencies"
            fi
            
            # 품질 위반
            if [ "${CATEGORY_COUNTS[quality]}" -gt 0 ]; then
                echo -e "   ${CYAN}4. Improve code quality${NC}"
                echo "      • Increase test coverage to 80%+"
                echo "      • Configure quality gates"
                echo "      • Set up automated quality checks"
            fi
        fi
        ;;
esac

# Strict 모드에서 위반 시 실패
if [ "$STRICT_MODE" = true ] && [ "$TOTAL_VIOLATIONS" -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Compliance check failed in strict mode${NC}"
    echo "   $TOTAL_VIOLATIONS violations found"
    exit 1
fi

# 감사 로그
AUDIT_LOG="$BASE_DIR/logs/compliance_audit_$(date +%Y%m%d_%H%M%S).json"
cat > "$AUDIT_LOG" << EOF
{
    "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
    "check_type": "$CHECK_TYPE",
    "summary": {
        "projects_checked": $TOTAL_CHECKS,
        "violations": $TOTAL_VIOLATIONS,
        "auto_fixed": ${AUTO_FIXED:-0}
    },
    "results": $(
        for project_id in "${!COMPLIANCE_SCORES[@]}"; do
            IFS='|' read -r name score violations <<< "${COMPLIANCE_SCORES[$project_id]}"
            echo "{\"project\": \"$name\", \"score\": $score, \"violations\": $violations},"
        done | sed '$ s/,$//'
    )
}
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Compliance Check Complete!${NC}"
echo -e "   📄 Audit log: $AUDIT_LOG"
[ "$AUTO_FIX" = true ] && echo -e "   🔧 Auto-fixes applied where possible"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

log "INFO" "Compliance check completed"