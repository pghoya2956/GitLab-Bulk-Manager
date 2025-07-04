#!/bin/bash

# GitLab Integration Hub - 외부 서비스 통합 허브
# Slack, Jira, Jenkins, AWS 등 다양한 서비스와의 통합 관리

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
SERVICE=""
ACTION=""
CONFIG_FILE=""
DRY_RUN=false
VERBOSE=false

show_help() {
    cat << EOF
GitLab Integration Hub - Unified External Service Integration

Usage: $(basename "$0") [OPTIONS] SERVICE ACTION

Services:
    slack         Slack notifications and commands
    jira          Jira issue synchronization
    jenkins       Jenkins job triggers
    aws           AWS service integration
    teams         Microsoft Teams integration
    webhook       Generic webhook management

Actions:
    setup         Configure new integration
    sync          Synchronize data
    notify        Send notifications
    trigger       Trigger external actions
    status        Check integration status
    test          Test connection

Options:
    -c, --config FILE    Configuration file
    -d, --dry-run       Preview actions without executing
    -v, --verbose       Verbose output
    -h, --help         Show this help message

Examples:
    # Setup Slack integration
    $(basename "$0") slack setup --config slack.conf

    # Sync Jira issues with GitLab
    $(basename "$0") jira sync

    # Trigger Jenkins build from GitLab
    $(basename "$0") jenkins trigger --project 123 --branch main

    # Send deployment notification
    $(basename "$0") slack notify --event deployment --status success

Description:
    Central hub for managing all GitLab external integrations:
    - Automated notifications
    - Issue tracking synchronization
    - CI/CD pipeline triggers
    - Cloud service automation
    - Custom webhook handlers
EOF
}

# 파라미터 파싱
SERVICE="$1"
ACTION="$2"
shift 2

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            EXTRA_ARGS+=("$1")
            shift
            ;;
    esac
done

# 서비스와 액션 확인
[ -z "$SERVICE" ] || [ -z "$ACTION" ] && { show_help; exit 1; }

# 초기화
init_script
load_config "$BASE_DIR/config/gitlab.env"

# 통합 설정 로드
INTEGRATIONS_CONFIG="$BASE_DIR/config/integrations.conf"
[ -n "$CONFIG_FILE" ] && INTEGRATIONS_CONFIG="$CONFIG_FILE"

# 전역 변수
declare -A INTEGRATION_STATUS
declare -A INTEGRATION_CONFIGS

# 설정 파일 로드
load_integration_config() {
    if [ -f "$INTEGRATIONS_CONFIG" ]; then
        source "$INTEGRATIONS_CONFIG"
        log "INFO" "Loaded integration config from $INTEGRATIONS_CONFIG"
    else
        log "WARN" "No integration config found at $INTEGRATIONS_CONFIG"
    fi
}

# Slack 통합
slack_integration() {
    local action=$1
    shift
    
    case "$action" in
        setup)
            echo -e "${CYAN}🔧 Setting up Slack integration...${NC}"
            
            read -p "Enter Slack Webhook URL: " SLACK_WEBHOOK_URL
            read -p "Enter default channel (e.g., #gitlab): " SLACK_CHANNEL
            read -p "Enter bot username (e.g., GitLab Bot): " SLACK_USERNAME
            
            # 설정 저장
            cat >> "$INTEGRATIONS_CONFIG" << EOF

# Slack Integration
SLACK_WEBHOOK_URL="$SLACK_WEBHOOK_URL"
SLACK_CHANNEL="$SLACK_CHANNEL"
SLACK_USERNAME="${SLACK_USERNAME:-GitLab Bot}"
SLACK_ICON_EMOJI=":gitlab:"
EOF
            
            echo -e "${GREEN}✅ Slack integration configured${NC}"
            
            # 테스트 메시지
            slack_integration test
            ;;
        
        notify)
            local event_type="${EXTRA_ARGS[0]}"
            local status="${EXTRA_ARGS[1]}"
            local project="${EXTRA_ARGS[2]}"
            local message=""
            local color=""
            
            case "$event_type" in
                deployment)
                    [ "$status" = "success" ] && color="good" || color="danger"
                    message="Deployment to production ${status}"
                    ;;
                pipeline)
                    [ "$status" = "success" ] && color="good" || color="danger"
                    message="Pipeline ${status} for project ${project}"
                    ;;
                merge)
                    color="good"
                    message="Merge request merged in ${project}"
                    ;;
                alert)
                    color="warning"
                    message="⚠️ Alert: ${status}"
                    ;;
            esac
            
            # Slack 메시지 전송
            local payload=$(cat << EOF
{
    "channel": "${SLACK_CHANNEL}",
    "username": "${SLACK_USERNAME}",
    "icon_emoji": "${SLACK_ICON_EMOJI}",
    "attachments": [{
        "color": "$color",
        "title": "GitLab Event",
        "text": "$message",
        "footer": "GitLab Integration Hub",
        "ts": $(date +%s)
    }]
}
EOF
)
            
            if [ "$DRY_RUN" = true ]; then
                echo "[DRY RUN] Would send to Slack:"
                echo "$payload" | jq '.'
            else
                response=$(curl -s -X POST -H 'Content-type: application/json' \
                    --data "$payload" "$SLACK_WEBHOOK_URL")
                
                [ "$response" = "ok" ] && echo -e "${GREEN}✅ Notification sent to Slack${NC}" || \
                    echo -e "${RED}❌ Failed to send Slack notification${NC}"
            fi
            ;;
        
        test)
            echo "Testing Slack connection..."
            EXTRA_ARGS=("test" "Connection test successful" "test-project")
            slack_integration notify
            ;;
        
        *)
            echo "Unknown Slack action: $action"
            exit 1
            ;;
    esac
}

# Jira 통합
jira_integration() {
    local action=$1
    shift
    
    case "$action" in
        setup)
            echo -e "${CYAN}🔧 Setting up Jira integration...${NC}"
            
            read -p "Enter Jira URL: " JIRA_URL
            read -p "Enter Jira username/email: " JIRA_USER
            read -s -p "Enter Jira API token: " JIRA_TOKEN
            echo
            read -p "Enter default project key: " JIRA_PROJECT
            
            # 설정 저장
            cat >> "$INTEGRATIONS_CONFIG" << EOF

# Jira Integration
JIRA_URL="$JIRA_URL"
JIRA_USER="$JIRA_USER"
JIRA_TOKEN="$JIRA_TOKEN"
JIRA_PROJECT="$JIRA_PROJECT"
EOF
            
            echo -e "${GREEN}✅ Jira integration configured${NC}"
            
            # 연결 테스트
            jira_integration test
            ;;
        
        sync)
            echo -e "${CYAN}🔄 Syncing GitLab issues with Jira...${NC}"
            
            # GitLab 이슈 가져오기
            local gitlab_issues=$(gitlab_api "GET" "/issues?state=opened&per_page=100")
            if [ $? -ne 200 ]; then
                error_exit "Failed to fetch GitLab issues" 2
            fi
            
            local synced=0
            echo "$gitlab_issues" | jq -c '.[]' | while IFS= read -r issue; do
                local title=$(echo "$issue" | jq -r '.title')
                local description=$(echo "$issue" | jq -r '.description // ""')
                local gitlab_id=$(echo "$issue" | jq -r '.iid')
                local labels=$(echo "$issue" | jq -r '.labels | join(",")')
                
                # Jira 이슈 확인/생성
                local jira_search=$(curl -s -u "$JIRA_USER:$JIRA_TOKEN" \
                    -X GET -H "Content-Type: application/json" \
                    "$JIRA_URL/rest/api/2/search?jql=text~\"GITLAB-$gitlab_id\"")
                
                local jira_count=$(echo "$jira_search" | jq '.total // 0')
                
                if [ "$jira_count" -eq 0 ]; then
                    # 새 Jira 이슈 생성
                    local jira_payload=$(cat << EOF
{
    "fields": {
        "project": {"key": "$JIRA_PROJECT"},
        "summary": "[GITLAB-$gitlab_id] $title",
        "description": "$description\n\nSynced from GitLab Issue #$gitlab_id",
        "issuetype": {"name": "Task"}
    }
}
EOF
)
                    
                    if [ "$DRY_RUN" = true ]; then
                        echo "[DRY RUN] Would create Jira issue: $title"
                    else
                        response=$(curl -s -u "$JIRA_USER:$JIRA_TOKEN" \
                            -X POST -H "Content-Type: application/json" \
                            --data "$jira_payload" \
                            "$JIRA_URL/rest/api/2/issue")
                        
                        local jira_key=$(echo "$response" | jq -r '.key // ""')
                        [ -n "$jira_key" ] && echo -e "   ${GREEN}✓${NC} Created Jira issue: $jira_key" && ((synced++))
                    fi
                else
                    [ "$VERBOSE" = true ] && echo "   Issue GITLAB-$gitlab_id already exists in Jira"
                fi
            done
            
            echo -e "${GREEN}✅ Synced $synced new issues to Jira${NC}"
            ;;
        
        test)
            echo "Testing Jira connection..."
            response=$(curl -s -u "$JIRA_USER:$JIRA_TOKEN" \
                "$JIRA_URL/rest/api/2/myself")
            
            if echo "$response" | jq -r '.name' > /dev/null 2>&1; then
                local user_name=$(echo "$response" | jq -r '.displayName')
                echo -e "${GREEN}✅ Connected to Jira as: $user_name${NC}"
            else
                echo -e "${RED}❌ Failed to connect to Jira${NC}"
                exit 1
            fi
            ;;
        
        *)
            echo "Unknown Jira action: $action"
            exit 1
            ;;
    esac
}

# Jenkins 통합
jenkins_integration() {
    local action=$1
    shift
    
    case "$action" in
        setup)
            echo -e "${CYAN}🔧 Setting up Jenkins integration...${NC}"
            
            read -p "Enter Jenkins URL: " JENKINS_URL
            read -p "Enter Jenkins username: " JENKINS_USER
            read -s -p "Enter Jenkins API token: " JENKINS_TOKEN
            echo
            
            # 설정 저장
            cat >> "$INTEGRATIONS_CONFIG" << EOF

# Jenkins Integration
JENKINS_URL="$JENKINS_URL"
JENKINS_USER="$JENKINS_USER"
JENKINS_TOKEN="$JENKINS_TOKEN"
EOF
            
            echo -e "${GREEN}✅ Jenkins integration configured${NC}"
            
            # 연결 테스트
            jenkins_integration test
            ;;
        
        trigger)
            local project_id="${EXTRA_ARGS[0]}"
            local branch="${EXTRA_ARGS[1]:-main}"
            local job_name="${EXTRA_ARGS[2]:-gitlab-build}"
            
            echo -e "${CYAN}🚀 Triggering Jenkins build...${NC}"
            echo "   Job: $job_name"
            echo "   Branch: $branch"
            
            # Jenkins 빌드 트리거
            local jenkins_params="token=gitlab&BRANCH=$branch&PROJECT_ID=$project_id"
            
            if [ "$DRY_RUN" = true ]; then
                echo "[DRY RUN] Would trigger Jenkins job: $job_name"
            else
                response=$(curl -s -w "\n%{http_code}" \
                    -u "$JENKINS_USER:$JENKINS_TOKEN" \
                    -X POST \
                    "$JENKINS_URL/job/$job_name/buildWithParameters?$jenkins_params")
                
                http_code=$(echo "$response" | tail -1)
                
                if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
                    echo -e "${GREEN}✅ Jenkins build triggered successfully${NC}"
                    
                    # 빌드 URL 가져오기
                    queue_url=$(echo "$response" | head -n -1 | grep -i "location:" | cut -d' ' -f2)
                    [ -n "$queue_url" ] && echo "   Queue URL: $queue_url"
                else
                    echo -e "${RED}❌ Failed to trigger Jenkins build (HTTP $http_code)${NC}"
                fi
            fi
            ;;
        
        status)
            local job_name="${EXTRA_ARGS[0]:-gitlab-build}"
            
            echo "Checking Jenkins job status: $job_name"
            
            response=$(curl -s -u "$JENKINS_USER:$JENKINS_TOKEN" \
                "$JENKINS_URL/job/$job_name/lastBuild/api/json")
            
            if [ $? -eq 0 ]; then
                local build_number=$(echo "$response" | jq -r '.number')
                local result=$(echo "$response" | jq -r '.result // "IN_PROGRESS"')
                local timestamp=$(echo "$response" | jq -r '.timestamp')
                local date=$(date -d "@$((timestamp/1000))" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r "$((timestamp/1000))" '+%Y-%m-%d %H:%M:%S')
                
                echo "Last Build: #$build_number"
                echo "Status: $result"
                echo "Date: $date"
            else
                echo -e "${RED}Failed to get Jenkins status${NC}"
            fi
            ;;
        
        test)
            echo "Testing Jenkins connection..."
            response=$(curl -s -u "$JENKINS_USER:$JENKINS_TOKEN" \
                "$JENKINS_URL/api/json" | jq -r '.mode' 2>/dev/null)
            
            if [ -n "$response" ]; then
                echo -e "${GREEN}✅ Connected to Jenkins${NC}"
            else
                echo -e "${RED}❌ Failed to connect to Jenkins${NC}"
                exit 1
            fi
            ;;
        
        *)
            echo "Unknown Jenkins action: $action"
            exit 1
            ;;
    esac
}

# AWS 통합
aws_integration() {
    local action=$1
    shift
    
    case "$action" in
        setup)
            echo -e "${CYAN}🔧 Setting up AWS integration...${NC}"
            
            read -p "Enter AWS Access Key ID: " AWS_ACCESS_KEY_ID
            read -s -p "Enter AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
            echo
            read -p "Enter AWS Region: " AWS_REGION
            read -p "Enter S3 Bucket for artifacts: " AWS_S3_BUCKET
            
            # 설정 저장
            cat >> "$INTEGRATIONS_CONFIG" << EOF

# AWS Integration
AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
AWS_REGION="$AWS_REGION"
AWS_S3_BUCKET="$AWS_S3_BUCKET"
EOF
            
            echo -e "${GREEN}✅ AWS integration configured${NC}"
            
            # 연결 테스트
            aws_integration test
            ;;
        
        deploy)
            local artifact="${EXTRA_ARGS[0]}"
            local environment="${EXTRA_ARGS[1]:-staging}"
            
            echo -e "${CYAN}☁️  Deploying to AWS...${NC}"
            echo "   Artifact: $artifact"
            echo "   Environment: $environment"
            
            # S3 업로드
            if [ -f "$artifact" ]; then
                local s3_key="deployments/$environment/$(basename "$artifact")-$(date +%Y%m%d-%H%M%S)"
                
                if [ "$DRY_RUN" = true ]; then
                    echo "[DRY RUN] Would upload to s3://$AWS_S3_BUCKET/$s3_key"
                else
                    # AWS CLI 사용
                    AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
                    AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
                    aws s3 cp "$artifact" "s3://$AWS_S3_BUCKET/$s3_key" \
                        --region "$AWS_REGION"
                    
                    if [ $? -eq 0 ]; then
                        echo -e "${GREEN}✅ Deployed to AWS S3${NC}"
                        echo "   S3 URL: s3://$AWS_S3_BUCKET/$s3_key"
                        
                        # CloudFormation 또는 ECS 업데이트 트리거
                        # ...
                    else
                        echo -e "${RED}❌ Failed to deploy to AWS${NC}"
                    fi
                fi
            else
                echo -e "${RED}Artifact not found: $artifact${NC}"
                exit 1
            fi
            ;;
        
        test)
            echo "Testing AWS connection..."
            AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
            AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
            aws s3 ls "s3://$AWS_S3_BUCKET" --region "$AWS_REGION" > /dev/null 2>&1
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Connected to AWS S3${NC}"
            else
                echo -e "${RED}❌ Failed to connect to AWS${NC}"
                exit 1
            fi
            ;;
        
        *)
            echo "Unknown AWS action: $action"
            exit 1
            ;;
    esac
}

# Teams 통합
teams_integration() {
    local action=$1
    shift
    
    case "$action" in
        setup)
            echo -e "${CYAN}🔧 Setting up Microsoft Teams integration...${NC}"
            
            read -p "Enter Teams Webhook URL: " TEAMS_WEBHOOK_URL
            
            # 설정 저장
            cat >> "$INTEGRATIONS_CONFIG" << EOF

# Microsoft Teams Integration
TEAMS_WEBHOOK_URL="$TEAMS_WEBHOOK_URL"
EOF
            
            echo -e "${GREEN}✅ Teams integration configured${NC}"
            
            # 테스트 메시지
            teams_integration test
            ;;
        
        notify)
            local event_type="${EXTRA_ARGS[0]}"
            local status="${EXTRA_ARGS[1]}"
            local project="${EXTRA_ARGS[2]}"
            local color=""
            local title=""
            local text=""
            
            case "$event_type" in
                deployment)
                    [ "$status" = "success" ] && color="28a745" || color="dc3545"
                    title="Deployment $status"
                    text="Project $project has been deployed to production"
                    ;;
                alert)
                    color="ffc107"
                    title="⚠️ GitLab Alert"
                    text="$status"
                    ;;
            esac
            
            # Teams 메시지 전송
            local payload=$(cat << EOF
{
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "themeColor": "$color",
    "summary": "$title",
    "sections": [{
        "activityTitle": "GitLab Integration Hub",
        "activitySubtitle": "$(date '+%Y-%m-%d %H:%M:%S')",
        "facts": [{
            "name": "Event",
            "value": "$event_type"
        }, {
            "name": "Status",
            "value": "$status"
        }, {
            "name": "Project",
            "value": "$project"
        }],
        "markdown": true
    }]
}
EOF
)
            
            if [ "$DRY_RUN" = true ]; then
                echo "[DRY RUN] Would send to Teams:"
                echo "$payload" | jq '.'
            else
                response=$(curl -s -X POST -H 'Content-type: application/json' \
                    --data "$payload" "$TEAMS_WEBHOOK_URL")
                
                [ "$response" = "1" ] && echo -e "${GREEN}✅ Notification sent to Teams${NC}" || \
                    echo -e "${RED}❌ Failed to send Teams notification${NC}"
            fi
            ;;
        
        test)
            echo "Testing Teams connection..."
            EXTRA_ARGS=("test" "Connection test successful" "test-project")
            teams_integration notify
            ;;
        
        *)
            echo "Unknown Teams action: $action"
            exit 1
            ;;
    esac
}

# Webhook 관리
webhook_integration() {
    local action=$1
    shift
    
    case "$action" in
        setup)
            echo -e "${CYAN}🔧 Setting up webhook integration...${NC}"
            
            read -p "Enter webhook name: " WEBHOOK_NAME
            read -p "Enter webhook URL: " WEBHOOK_URL
            read -p "Enter secret token (optional): " WEBHOOK_SECRET
            
            # GitLab 프로젝트에 webhook 추가
            read -p "Add to project ID (or 'all'): " PROJECT_SCOPE
            
            if [ "$PROJECT_SCOPE" = "all" ]; then
                # 시스템 훅 추가 (관리자 권한 필요)
                webhook_data=$(cat << EOF
{
    "url": "$WEBHOOK_URL",
    "token": "$WEBHOOK_SECRET",
    "push_events": true,
    "issues_events": true,
    "merge_requests_events": true,
    "wiki_page_events": true,
    "pipeline_events": true,
    "enable_ssl_verification": true
}
EOF
)
                
                if [ "$DRY_RUN" = true ]; then
                    echo "[DRY RUN] Would add system hook"
                else
                    response=$(gitlab_api "POST" "/hooks" "$webhook_data")
                    if [ $? -eq 201 ]; then
                        echo -e "${GREEN}✅ System webhook added${NC}"
                    else
                        echo -e "${RED}❌ Failed to add system webhook${NC}"
                    fi
                fi
            else
                # 프로젝트 webhook 추가
                if [ "$DRY_RUN" = true ]; then
                    echo "[DRY RUN] Would add webhook to project $PROJECT_SCOPE"
                else
                    response=$(gitlab_api "POST" "/projects/$PROJECT_SCOPE/hooks" "$webhook_data")
                    if [ $? -eq 201 ]; then
                        echo -e "${GREEN}✅ Project webhook added${NC}"
                    else
                        echo -e "${RED}❌ Failed to add project webhook${NC}"
                    fi
                fi
            fi
            ;;
        
        list)
            echo -e "${CYAN}📋 Listing webhooks...${NC}"
            
            # 시스템 hooks
            echo "System Hooks:"
            system_hooks=$(gitlab_api "GET" "/hooks")
            if [ $? -eq 200 ]; then
                echo "$system_hooks" | jq -r '.[] | "  - \(.url) (ID: \(.id))"'
            fi
            
            # 프로젝트 hooks (샘플)
            echo ""
            echo "Project Hooks (sample):"
            projects=$(gitlab_api "GET" "/projects?per_page=10")
            echo "$projects" | jq -r '.[].id' | while read -r project_id; do
                project_hooks=$(gitlab_api "GET" "/projects/$project_id/hooks")
                if [ $? -eq 200 ] && [ "$(echo "$project_hooks" | jq 'length')" -gt 0 ]; then
                    project_name=$(echo "$projects" | jq -r ".[] | select(.id == $project_id) | .name")
                    echo "  $project_name:"
                    echo "$project_hooks" | jq -r '.[] | "    - \(.url)"'
                fi
            done
            ;;
        
        test)
            local webhook_id="${EXTRA_ARGS[0]}"
            local project_id="${EXTRA_ARGS[1]}"
            
            echo "Testing webhook..."
            
            if [ -n "$project_id" ]; then
                # 프로젝트 webhook 테스트
                response=$(gitlab_api "GET" "/projects/$project_id/hooks/$webhook_id/test/push_events")
                [ $? -eq 200 ] && echo -e "${GREEN}✅ Webhook test successful${NC}" || \
                    echo -e "${RED}❌ Webhook test failed${NC}"
            else
                echo "Please specify project_id for webhook testing"
            fi
            ;;
        
        *)
            echo "Unknown webhook action: $action"
            exit 1
            ;;
    esac
}

# 통합 상태 확인
check_integration_status() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}              Integration Hub Status                          ${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # 각 통합 상태 확인
    echo -e "${YELLOW}🔌 Integration Status${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Slack
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        echo -n "Slack:    "
        echo -e "${GREEN}✓ Configured${NC}"
    else
        echo -n "Slack:    "
        echo -e "${RED}✗ Not configured${NC}"
    fi
    
    # Jira
    if [ -n "$JIRA_URL" ]; then
        echo -n "Jira:     "
        echo -e "${GREEN}✓ Configured${NC} ($JIRA_URL)"
    else
        echo -n "Jira:     "
        echo -e "${RED}✗ Not configured${NC}"
    fi
    
    # Jenkins
    if [ -n "$JENKINS_URL" ]; then
        echo -n "Jenkins:  "
        echo -e "${GREEN}✓ Configured${NC} ($JENKINS_URL)"
    else
        echo -n "Jenkins:  "
        echo -e "${RED}✗ Not configured${NC}"
    fi
    
    # AWS
    if [ -n "$AWS_ACCESS_KEY_ID" ]; then
        echo -n "AWS:      "
        echo -e "${GREEN}✓ Configured${NC} (Region: $AWS_REGION)"
    else
        echo -n "AWS:      "
        echo -e "${RED}✗ Not configured${NC}"
    fi
    
    # Teams
    if [ -n "$TEAMS_WEBHOOK_URL" ]; then
        echo -n "Teams:    "
        echo -e "${GREEN}✓ Configured${NC}"
    else
        echo -n "Teams:    "
        echo -e "${RED}✗ Not configured${NC}"
    fi
    
    echo ""
    
    # Webhook 통계
    echo -e "${YELLOW}📊 Webhook Statistics${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    system_hooks_count=$(gitlab_api "GET" "/hooks" | jq 'length' 2>/dev/null || echo "0")
    echo "System Hooks: $system_hooks_count"
    
    # 프로젝트 webhook 수 (샘플링)
    project_hooks_total=0
    projects=$(gitlab_api "GET" "/projects?per_page=20")
    if [ $? -eq 200 ]; then
        echo "$projects" | jq -r '.[].id' | while read -r project_id; do
            hooks_count=$(gitlab_api "GET" "/projects/$project_id/hooks" | jq 'length' 2>/dev/null || echo "0")
            project_hooks_total=$((project_hooks_total + hooks_count))
        done
    fi
    echo "Project Hooks (sample): ~$project_hooks_total"
}

# 메인 실행
load_integration_config

case "$SERVICE" in
    slack)
        slack_integration "$ACTION" "${EXTRA_ARGS[@]}"
        ;;
    jira)
        jira_integration "$ACTION" "${EXTRA_ARGS[@]}"
        ;;
    jenkins)
        jenkins_integration "$ACTION" "${EXTRA_ARGS[@]}"
        ;;
    aws)
        aws_integration "$ACTION" "${EXTRA_ARGS[@]}"
        ;;
    teams)
        teams_integration "$ACTION" "${EXTRA_ARGS[@]}"
        ;;
    webhook)
        webhook_integration "$ACTION" "${EXTRA_ARGS[@]}"
        ;;
    status)
        check_integration_status
        ;;
    *)
        echo "Unknown service: $SERVICE"
        show_help
        exit 1
        ;;
esac

# 로그 기록
log "INFO" "Integration hub: $SERVICE $ACTION completed"