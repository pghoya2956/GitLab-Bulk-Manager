#!/bin/bash

# Create GitLab projects in bulk from YAML configuration
# Supports multiple groups, branch protection, and CI/CD variables

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Load common functions
source "$BASE_DIR/lib/common.sh"
source "$BASE_DIR/lib/validation.sh"
source "$BASE_DIR/lib/idempotent.sh"

# Script variables
CONFIG_FILE=""
DRY_RUN=false
SKIP_EXISTING=true
CONTINUE_ON_ERROR=true
API_DELAY=200  # milliseconds (higher for projects)
MAX_RETRIES=3
PARALLEL_WORKERS=5
YAML_PARSER=""
CREATED_PROJECTS=()

# Function to show usage
show_help() {
    cat << EOF
Usage: $(basename "$0") --config CONFIG_FILE [OPTIONS]

Create GitLab projects in bulk from a YAML configuration file.
Supports branch protection rules and CI/CD variables.

OPTIONS:
    --config FILE        YAML configuration file (required)
    --dry-run           Preview changes without creating projects
    --no-skip-existing  Don't skip existing projects (update them)
    --stop-on-error     Stop execution on first error
    --api-delay MS      Delay between API calls in milliseconds (default: 200)
    --max-retries N     Maximum retries for failed requests (default: 3)
    --parallel N        Number of parallel workers (default: 5)
    -h, --help          Show this help message

CONFIGURATION FILE FORMAT:
    See Scripts/config/projects-bulk.yaml.example for detailed format

EXAMPLES:
    # Create projects from configuration
    $(basename "$0") --config projects-bulk.yaml

    # Preview changes without creating
    $(basename "$0") --config projects-bulk.yaml --dry-run

    # Create with slower API calls
    $(basename "$0") --config projects-bulk.yaml --api-delay 500

EOF
}

# Function to check for YAML parser
check_yaml_parser() {
    if command -v yq &> /dev/null; then
        YAML_PARSER="yq"
        log "INFO" "Using yq for YAML parsing"
    elif command -v python3 &> /dev/null && python3 -c "import yaml" 2>/dev/null; then
        YAML_PARSER="python"
        log "INFO" "Using Python for YAML parsing"
    else
        error_exit "No YAML parser found. Please install yq or Python with PyYAML"
    fi
}

# Function to parse YAML using available parser
parse_yaml() {
    local file="$1"
    local query="$2"
    
    if [[ "$YAML_PARSER" == "yq" ]]; then
        yq eval "$query" "$file" 2>/dev/null || echo ""
    else
        python3 -c "
import yaml
import sys

with open('$file', 'r') as f:
    data = yaml.safe_load(f)

# Parse the query
query = '$query'
result = data

try:
    # Handle queries like '.defaults.visibility', '.projects[0].group_id', etc.
    parts = query.strip('.').replace('[', '.').replace(']', '').split('.')
    for part in parts:
        if part.isdigit():
            result = result[int(part)]
        elif part:
            result = result.get(part, '')
    
    if isinstance(result, (dict, list)):
        print('')
    else:
        print(result if result is not None else '')
except:
    print('')
"
    fi
}

# Function to count array elements in YAML
count_yaml_array() {
    local file="$1"
    local query="$2"
    
    if [[ "$YAML_PARSER" == "yq" ]]; then
        yq eval "$query | length" "$file" 2>/dev/null || echo "0"
    else
        python3 -c "
import yaml

with open('$file', 'r') as f:
    data = yaml.safe_load(f)

# Parse the query
query = '$query'
result = data

try:
    parts = query.strip('.').split('.')
    for part in parts:
        if part:
            result = result.get(part, [])
    
    print(len(result) if isinstance(result, list) else 0)
except:
    print(0)
"
    fi
}

# Function to create a single project with retry logic
create_single_project() {
    local name="$1"
    local group_id="$2"
    local description="${3:-}"
    local visibility="${4:-private}"
    local additional_settings="${5:-}"
    
    local attempt=1
    local success=false
    
    while [[ $attempt -le $MAX_RETRIES ]] && [[ $success == false ]]; do
        if [[ $attempt -gt 1 ]]; then
            log "INFO" "Retry attempt $attempt/$MAX_RETRIES for project: $name"
            sleep $((attempt * 2))  # Exponential backoff
        fi
        
        # Build additional JSON from settings
        local additional_json=""
        if [[ -n "$description" ]]; then
            additional_json="\"description\":\"$description\""
        fi
        
        if [[ -n "$visibility" ]] && [[ "$visibility" != "private" ]]; then
            [[ -n "$additional_json" ]] && additional_json+=","
            additional_json+="\"visibility\":\"$visibility\""
        fi
        
        # Add default settings from config
        local default_branch=$(parse_yaml "$CONFIG_FILE" ".defaults.default_branch")
        if [[ -n "$default_branch" ]]; then
            [[ -n "$additional_json" ]] && additional_json+=","
            additional_json+="\"default_branch\":\"$default_branch\""
        fi
        
        local init_readme=$(parse_yaml "$CONFIG_FILE" ".defaults.initialize_with_readme")
        if [[ "$init_readme" == "true" ]]; then
            [[ -n "$additional_json" ]] && additional_json+=","
            additional_json+="\"initialize_with_readme\":true"
        fi
        
        if [[ -n "$additional_settings" ]]; then
            [[ -n "$additional_json" ]] && additional_json+=","
            additional_json+="$additional_settings"
        fi
        
        # Create project using idempotent function
        local project_id
        project_id=$(create_project_idempotent "$name" "$group_id" "$additional_json")
        
        if [[ $? -eq 0 ]] && [[ -n "$project_id" ]]; then
            success=true
            echo "$project_id"
            return 0
        fi
        
        ((attempt++))
    done
    
    if [[ $success == false ]]; then
        log "ERROR" "Failed to create project '$name' after $MAX_RETRIES attempts"
        return 1
    fi
}

# Function to set project topics
set_project_topics() {
    local project_id="$1"
    local topics="$2"
    
    if [[ -z "$topics" ]] || [[ "$topics" == "[]" ]]; then
        return 0
    fi
    
    # Convert array string to comma-separated list
    local topics_list
    if [[ "$YAML_PARSER" == "yq" ]]; then
        topics_list=$(echo "$topics" | yq eval '.[] | @csv' - | tr -d '"' | paste -sd, -)
    else
        topics_list=$(python3 -c "
import yaml
topics = yaml.safe_load('$topics')
if isinstance(topics, list):
    print(','.join(topics))
")
    fi
    
    if [[ -n "$topics_list" ]]; then
        log "INFO" "Setting topics for project $project_id: $topics_list"
        
        local data="{\"topics\":[$(echo "$topics_list" | awk -F, '{for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i<NF?",":"")}')]}"
        
        local response
        response=$(gitlab_api "PUT" "/projects/$project_id" "$data")
        local http_code=$?
        
        if [[ $http_code -eq 200 ]]; then
            log "SUCCESS" "Topics set successfully"
        else
            log "WARN" "Failed to set topics: $response"
        fi
    fi
}

# Function to create branch protection
create_branch_protection() {
    local project_id="$1"
    local project_name="$2"
    
    # Check for default branch protection rules
    local default_branch=$(parse_yaml "$CONFIG_FILE" ".branch_protection.default.branch")
    if [[ -z "$default_branch" ]]; then
        return 0
    fi
    
    # Check if this project has specific overrides
    local use_override=false
    local override_count=$(count_yaml_array "$CONFIG_FILE" ".branch_protection.overrides")
    
    for ((i=0; i<override_count; i++)); do
        local override_name=$(parse_yaml "$CONFIG_FILE" ".branch_protection.overrides[$i].project_name")
        if [[ "$override_name" == "$project_name" ]]; then
            use_override=true
            # Use override settings
            default_branch=$(parse_yaml "$CONFIG_FILE" ".branch_protection.overrides[$i].branch")
            local push_level=$(parse_yaml "$CONFIG_FILE" ".branch_protection.overrides[$i].push_access_level")
            local merge_level=$(parse_yaml "$CONFIG_FILE" ".branch_protection.overrides[$i].merge_access_level")
            local required_approvals=$(parse_yaml "$CONFIG_FILE" ".branch_protection.overrides[$i].required_approvals")
            break
        fi
    done
    
    if [[ $use_override == false ]]; then
        # Use default settings
        local push_level=$(parse_yaml "$CONFIG_FILE" ".branch_protection.default.push_access_level")
        local merge_level=$(parse_yaml "$CONFIG_FILE" ".branch_protection.default.merge_access_level")
        local force_push=$(parse_yaml "$CONFIG_FILE" ".branch_protection.default.allow_force_push")
        local code_owner=$(parse_yaml "$CONFIG_FILE" ".branch_protection.default.code_owner_approval_required")
    fi
    
    # Check if branch protection already exists
    if branch_protection_exists "$project_id" "$default_branch"; then
        log "INFO" "Branch protection already exists for $default_branch"
        return 0
    fi
    
    log "INFO" "Creating branch protection for project $project_id branch $default_branch"
    
    # Build protection data
    local data="{\"name\":\"$default_branch\""
    
    if [[ -n "$push_level" ]]; then
        data+=",\"push_access_level\":\"$push_level\""
    fi
    
    if [[ -n "$merge_level" ]]; then
        data+=",\"merge_access_level\":\"$merge_level\""
    fi
    
    if [[ "$force_push" == "false" ]]; then
        data+=",\"allow_force_push\":false"
    fi
    
    if [[ "$code_owner" == "true" ]]; then
        data+=",\"code_owner_approval_required\":true"
    fi
    
    data+="}"
    
    local response
    response=$(gitlab_api "POST" "/projects/$project_id/protected_branches" "$data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]]; then
        log "SUCCESS" "Branch protection created"
    else
        log "WARN" "Failed to create branch protection: $response"
    fi
}

# Function to set CI/CD variables
set_project_variables() {
    local project_id="$1"
    local project_name="$2"
    
    # Set global variables
    local global_var_count=$(count_yaml_array "$CONFIG_FILE" ".ci_variables.global")
    
    for ((i=0; i<global_var_count; i++)); do
        local key=$(parse_yaml "$CONFIG_FILE" ".ci_variables.global[$i].key")
        local value=$(parse_yaml "$CONFIG_FILE" ".ci_variables.global[$i].value")
        local protected=$(parse_yaml "$CONFIG_FILE" ".ci_variables.global[$i].protected")
        local masked=$(parse_yaml "$CONFIG_FILE" ".ci_variables.global[$i].masked")
        
        if [[ -z "$key" ]]; then
            continue
        fi
        
        # Check if variable already exists
        if project_variable_exists "$project_id" "$key"; then
            log "INFO" "Variable $key already exists in project $project_id"
            continue
        fi
        
        log "INFO" "Setting CI/CD variable $key for project $project_id"
        
        local data="{\"key\":\"$key\",\"value\":\"$value\""
        
        if [[ "$protected" == "true" ]]; then
            data+=",\"protected\":true"
        fi
        
        if [[ "$masked" == "true" ]]; then
            data+=",\"masked\":true"
        fi
        
        data+="}"
        
        local response
        response=$(gitlab_api "POST" "/projects/$project_id/variables" "$data")
        local http_code=$?
        
        if [[ $http_code -eq 201 ]]; then
            log "SUCCESS" "Variable $key set successfully"
        else
            log "WARN" "Failed to set variable $key: $response"
        fi
    done
    
    # Set project-specific variables
    local specific_count=$(count_yaml_array "$CONFIG_FILE" ".ci_variables.project_specific")
    
    for ((i=0; i<specific_count; i++)); do
        local spec_project=$(parse_yaml "$CONFIG_FILE" ".ci_variables.project_specific[$i].project_name")
        
        if [[ "$spec_project" != "$project_name" ]]; then
            continue
        fi
        
        local var_count=$(count_yaml_array "$CONFIG_FILE" ".ci_variables.project_specific[$i].variables")
        
        for ((j=0; j<var_count; j++)); do
            local key=$(parse_yaml "$CONFIG_FILE" ".ci_variables.project_specific[$i].variables[$j].key")
            local value=$(parse_yaml "$CONFIG_FILE" ".ci_variables.project_specific[$i].variables[$j].value")
            local protected=$(parse_yaml "$CONFIG_FILE" ".ci_variables.project_specific[$i].variables[$j].protected")
            local masked=$(parse_yaml "$CONFIG_FILE" ".ci_variables.project_specific[$i].variables[$j].masked")
            
            if [[ -z "$key" ]]; then
                continue
            fi
            
            # Check if variable already exists
            if project_variable_exists "$project_id" "$key"; then
                log "INFO" "Variable $key already exists in project $project_id"
                continue
            fi
            
            log "INFO" "Setting project-specific CI/CD variable $key for project $project_id"
            
            local data="{\"key\":\"$key\",\"value\":\"$value\""
            
            if [[ "$protected" == "true" ]]; then
                data+=",\"protected\":true"
            fi
            
            if [[ "$masked" == "true" ]]; then
                data+=",\"masked\":true"
            fi
            
            data+="}"
            
            local response
            response=$(gitlab_api "POST" "/projects/$project_id/variables" "$data")
            local http_code=$?
            
            if [[ $http_code -eq 201 ]]; then
                log "SUCCESS" "Variable $key set successfully"
            else
                log "WARN" "Failed to set variable $key: $response"
            fi
        done
    done
}

# Function to process projects for a group
process_group_projects() {
    local group_id="$1"
    local projects_array="$2"
    
    local count=$(count_yaml_array "$CONFIG_FILE" "$projects_array")
    
    if [[ $count -eq 0 ]]; then
        return 0
    fi
    
    log "INFO" "Processing $count projects for group $group_id"
    
    for ((i=0; i<count; i++)); do
        local prefix="$projects_array[$i]"
        
        # Extract project information
        local name=$(parse_yaml "$CONFIG_FILE" "$prefix.name")
        local description=$(parse_yaml "$CONFIG_FILE" "$prefix.description")
        local visibility=$(parse_yaml "$CONFIG_FILE" "$prefix.visibility")
        local topics=$(parse_yaml "$CONFIG_FILE" "$prefix.topics")
        
        if [[ -z "$name" ]]; then
            log "WARN" "Skipping project at index $i - missing name"
            continue
        fi
        
        # Use defaults if not specified
        if [[ -z "$visibility" ]]; then
            visibility=$(parse_yaml "$CONFIG_FILE" ".defaults.visibility")
            visibility=${visibility:-"private"}
        fi
        
        log "INFO" "Creating project: $name in group $group_id"
        
        if [[ $DRY_RUN == true ]]; then
            log "DRY-RUN" "Would create: $name in group $group_id"
        else
            # Extract additional settings
            local settings_json=""
            local issues=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.issues_enabled")
            local wiki=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.wiki_enabled")
            local merge_requests=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.merge_requests_enabled")
            local container=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.container_registry_enabled")
            local packages=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.packages_enabled")
            local pages=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.pages_enabled")
            local lfs=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.lfs_enabled")
            local security=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.security_and_compliance_enabled")
            
            # Use defaults for unspecified settings
            if [[ -z "$issues" ]]; then
                issues=$(parse_yaml "$CONFIG_FILE" ".defaults.issues_enabled")
            fi
            if [[ -z "$wiki" ]]; then
                wiki=$(parse_yaml "$CONFIG_FILE" ".defaults.wiki_enabled")
            fi
            if [[ -z "$merge_requests" ]]; then
                merge_requests=$(parse_yaml "$CONFIG_FILE" ".defaults.merge_requests_enabled")
            fi
            
            # Build settings JSON
            if [[ "$issues" == "true" ]]; then
                settings_json+="\"issues_enabled\":true"
            elif [[ "$issues" == "false" ]]; then
                settings_json+="\"issues_enabled\":false"
            fi
            
            if [[ "$wiki" == "true" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"wiki_enabled\":true"
            elif [[ "$wiki" == "false" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"wiki_enabled\":false"
            fi
            
            if [[ "$merge_requests" == "true" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"merge_requests_enabled\":true"
            elif [[ "$merge_requests" == "false" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"merge_requests_enabled\":false"
            fi
            
            if [[ "$container" == "true" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"container_registry_enabled\":true"
            fi
            
            if [[ "$packages" == "true" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"packages_enabled\":true"
            fi
            
            if [[ "$pages" == "true" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"pages_access_level\":\"enabled\""
            fi
            
            if [[ "$lfs" == "true" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"lfs_enabled\":true"
            fi
            
            if [[ "$security" == "true" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"security_and_compliance_enabled\":true"
            fi
            
            # Create the project
            local project_id
            project_id=$(create_single_project "$name" "$group_id" "$description" "$visibility" "$settings_json")
            
            if [[ $? -eq 0 ]] && [[ -n "$project_id" ]]; then
                log "SUCCESS" "Created/Found project: $name (ID: $project_id)"
                CREATED_PROJECTS+=("$project_id:$name")
                
                # Set topics if specified
                if [[ -n "$topics" ]] && [[ "$topics" != "[]" ]]; then
                    set_project_topics "$project_id" "$topics"
                fi
                
                # Apply branch protection
                create_branch_protection "$project_id" "$name"
                
                # Set CI/CD variables
                set_project_variables "$project_id" "$name"
            else
                log "ERROR" "Failed to create project: $name"
                if [[ $CONTINUE_ON_ERROR == false ]]; then
                    error_exit "Stopping due to error (--stop-on-error specified)"
                fi
            fi
        fi
        
        # API rate limiting delay
        if [[ $i -lt $((count - 1)) ]] && [[ $DRY_RUN == false ]]; then
            sleep $(echo "scale=3; $API_DELAY/1000" | bc)
        fi
    done
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-skip-existing)
            SKIP_EXISTING=false
            shift
            ;;
        --stop-on-error)
            CONTINUE_ON_ERROR=false
            shift
            ;;
        --api-delay)
            API_DELAY="$2"
            shift 2
            ;;
        --max-retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL_WORKERS="$2"
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

# Validate required parameters
if [[ -z "$CONFIG_FILE" ]]; then
    echo "Error: Configuration file is required"
    show_help
    exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Initialize
init_script
log "INFO" "Starting bulk project creation"
log "INFO" "Configuration file: $CONFIG_FILE"

# Check for YAML parser
check_yaml_parser

# Load GitLab configuration
load_config "$BASE_DIR/config/gitlab.env"

# Check execution options from config
config_dry_run=$(parse_yaml "$CONFIG_FILE" ".options.dry_run")
if [[ "$config_dry_run" == "true" ]] && [[ $DRY_RUN == false ]]; then
    DRY_RUN=true
    log "INFO" "Dry run mode enabled from configuration"
fi

config_continue=$(parse_yaml "$CONFIG_FILE" ".options.continue_on_error")
if [[ "$config_continue" == "false" ]] && [[ $CONTINUE_ON_ERROR == true ]]; then
    CONTINUE_ON_ERROR=false
fi

config_skip=$(parse_yaml "$CONFIG_FILE" ".options.skip_existing")
if [[ "$config_skip" == "false" ]] && [[ $SKIP_EXISTING == true ]]; then
    SKIP_EXISTING=false
fi

config_delay=$(parse_yaml "$CONFIG_FILE" ".options.api_delay")
if [[ -n "$config_delay" ]] && [[ $API_DELAY -eq 200 ]]; then
    API_DELAY=$config_delay
fi

config_retries=$(parse_yaml "$CONFIG_FILE" ".options.max_retries")
if [[ -n "$config_retries" ]] && [[ $MAX_RETRIES -eq 3 ]]; then
    MAX_RETRIES=$config_retries
fi

config_parallel=$(parse_yaml "$CONFIG_FILE" ".options.parallel_workers")
if [[ -n "$config_parallel" ]] && [[ $PARALLEL_WORKERS -eq 5 ]]; then
    PARALLEL_WORKERS=$config_parallel
fi

if [[ $DRY_RUN == true ]]; then
    log "INFO" "DRY RUN MODE - No changes will be made"
fi

# Process project groups
log "INFO" "Processing project groups from configuration..."

group_count=$(count_yaml_array "$CONFIG_FILE" ".projects")

if [[ $group_count -eq 0 ]]; then
    log "WARN" "No project groups found in configuration"
    exit 0
fi

for ((g=0; g<group_count; g++)); do
    group_id=$(parse_yaml "$CONFIG_FILE" ".projects[$g].group_id")
    
    if [[ -z "$group_id" ]]; then
        log "WARN" "Skipping project group at index $g - missing group_id"
        continue
    fi
    
    # Validate group exists
    if ! group_exists_by_id "$group_id"; then
        log "ERROR" "Group with ID $group_id does not exist"
        if [[ $CONTINUE_ON_ERROR == false ]]; then
            error_exit "Stopping due to error (--stop-on-error specified)"
        fi
        continue
    fi
    
    # Get group details
    response=$(gitlab_api "GET" "/groups/$group_id")
    group_path=$(echo "$response" | grep -o '"full_path":"[^"]*' | cut -d'"' -f4)
    
    log "INFO" "Processing projects for group: $group_path (ID: $group_id)"
    
    # Process projects in this group
    process_group_projects "$group_id" ".projects[$g].projects"
done

# Summary
log "INFO" "==================== SUMMARY ===================="

if [[ $DRY_RUN == true ]]; then
    log "INFO" "DRY RUN COMPLETE - Review the output above for planned changes"
else
    log "SUCCESS" "Bulk project creation complete!"
    log "INFO" "Total projects created/found: ${#CREATED_PROJECTS[@]}"
    
    if [[ ${#CREATED_PROJECTS[@]} -gt 0 ]]; then
        log "INFO" "Projects:"
        for project in "${CREATED_PROJECTS[@]}"; do
            IFS=':' read -r id name <<< "$project"
            log "INFO" "  - $name (ID: $id)"
        done
    fi
fi

log "INFO" "Check the log file for details: $LOG_FILE"