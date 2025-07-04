#!/bin/bash

# Create GitLab subgroups in bulk from YAML configuration
# Supports hierarchical structure with idempotent operations

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
API_DELAY=100  # milliseconds
MAX_RETRIES=3
YAML_PARSER=""

# Function to show usage
show_help() {
    cat << EOF
Usage: $(basename "$0") --config CONFIG_FILE [OPTIONS]

Create GitLab subgroups in bulk from a YAML configuration file.
Supports hierarchical structure and idempotent operations.

OPTIONS:
    --config FILE        YAML configuration file (required)
    --dry-run           Preview changes without creating groups
    --no-skip-existing  Don't skip existing groups (update them)
    --stop-on-error     Stop execution on first error
    --api-delay MS      Delay between API calls in milliseconds (default: 100)
    --max-retries N     Maximum retries for failed requests (default: 3)
    -h, --help          Show this help message

CONFIGURATION FILE FORMAT:
    See Scripts/config/subgroups.yaml.example for detailed format

EXAMPLES:
    # Create subgroups from configuration
    $(basename "$0") --config subgroups.yaml

    # Preview changes without creating
    $(basename "$0") --config subgroups.yaml --dry-run

    # Create with slower API calls
    $(basename "$0") --config subgroups.yaml --api-delay 500

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
    # Handle queries like '.parent_id', '.subgroups[0].name', etc.
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

# Function to create a single group with retry logic
create_single_group() {
    local name="$1"
    local path="$2"
    local parent_id="$3"
    local visibility="${4:-private}"
    local description="${5:-}"
    local additional_settings="${6:-}"
    
    local attempt=1
    local success=false
    
    while [[ $attempt -le $MAX_RETRIES ]] && [[ $success == false ]]; do
        if [[ $attempt -gt 1 ]]; then
            log "INFO" "Retry attempt $attempt/$MAX_RETRIES for group: $name"
            sleep $((attempt * 2))  # Exponential backoff
        fi
        
        # Build additional JSON from settings
        local additional_json=""
        if [[ -n "$description" ]]; then
            additional_json="\"description\":\"$description\""
        fi
        
        if [[ -n "$visibility" ]] && [[ "$visibility" != "private" ]]; then
            if [[ -n "$additional_json" ]]; then
                additional_json+=","
            fi
            additional_json+="\"visibility\":\"$visibility\""
        fi
        
        if [[ -n "$additional_settings" ]]; then
            if [[ -n "$additional_json" ]]; then
                additional_json+=","
            fi
            additional_json+="$additional_settings"
        fi
        
        # Create group using idempotent function
        local group_id
        group_id=$(create_group_idempotent "$name" "$path" "$parent_id" "$additional_json")
        
        if [[ $? -eq 0 ]] && [[ -n "$group_id" ]]; then
            success=true
            echo "$group_id"
            return 0
        fi
        
        ((attempt++))
    done
    
    if [[ $success == false ]]; then
        log "ERROR" "Failed to create group '$name' after $MAX_RETRIES attempts"
        return 1
    fi
}

# Function to process subgroups recursively
process_subgroups() {
    local parent_id="$1"
    local parent_path="$2"
    local subgroups_array="$3"
    local depth="${4:-0}"
    
    local count
    count=$(count_yaml_array "$CONFIG_FILE" "$subgroups_array")
    
    if [[ $count -eq 0 ]]; then
        return 0
    fi
    
    local indent=""
    for ((i=0; i<depth; i++)); do
        indent+="  "
    done
    
    log "INFO" "${indent}Processing $count subgroups under $parent_path"
    
    for ((i=0; i<count; i++)); do
        local prefix="$subgroups_array[$i]"
        
        # Extract group information
        local name=$(parse_yaml "$CONFIG_FILE" "$prefix.name")
        local path=$(parse_yaml "$CONFIG_FILE" "$prefix.path")
        local visibility=$(parse_yaml "$CONFIG_FILE" "$prefix.visibility")
        local description=$(parse_yaml "$CONFIG_FILE" "$prefix.description")
        
        if [[ -z "$name" ]] || [[ -z "$path" ]]; then
            log "WARN" "${indent}Skipping subgroup at index $i - missing name or path"
            continue
        fi
        
        # Default visibility
        if [[ -z "$visibility" ]]; then
            visibility=$(parse_yaml "$CONFIG_FILE" ".defaults.visibility")
            visibility=${visibility:-"private"}
        fi
        
        log "INFO" "${indent}Creating subgroup: $name ($path)"
        
        if [[ $DRY_RUN == true ]]; then
            log "DRY-RUN" "${indent}Would create: $name at $parent_path/$path"
        else
            # Extract additional settings
            local settings_json=""
            local lfs_enabled=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.lfs_enabled")
            local emails_disabled=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.emails_disabled")
            local auto_devops=$(parse_yaml "$CONFIG_FILE" "$prefix.settings.auto_devops_enabled")
            
            if [[ -n "$lfs_enabled" ]]; then
                settings_json+="\"lfs_enabled\":$lfs_enabled"
            fi
            
            if [[ -n "$emails_disabled" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"emails_disabled\":$emails_disabled"
            fi
            
            if [[ -n "$auto_devops" ]]; then
                [[ -n "$settings_json" ]] && settings_json+=","
                settings_json+="\"auto_devops_enabled\":$auto_devops"
            fi
            
            # Create the group
            local group_id
            group_id=$(create_single_group "$name" "$path" "$parent_id" "$visibility" "$description" "$settings_json")
            
            if [[ $? -eq 0 ]] && [[ -n "$group_id" ]]; then
                log "SUCCESS" "${indent}Created/Found group: $name (ID: $group_id)"
                
                # Process nested subgroups
                process_subgroups "$group_id" "$parent_path/$path" "$prefix.subgroups" $((depth + 1))
            else
                log "ERROR" "${indent}Failed to create group: $name"
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
log "INFO" "Starting bulk subgroup creation"
log "INFO" "Configuration file: $CONFIG_FILE"

# Check for YAML parser
check_yaml_parser

# Load GitLab configuration
load_config "$BASE_DIR/config/gitlab.env"

# Extract parent ID from config
PARENT_ID=$(parse_yaml "$CONFIG_FILE" ".parent_id")

if [[ -z "$PARENT_ID" ]]; then
    error_exit "Parent ID not specified in configuration file"
fi

# Validate parent group exists
if ! group_exists_by_id "$PARENT_ID"; then
    error_exit "Parent group with ID $PARENT_ID does not exist"
fi

# Get parent group details
response=$(gitlab_api "GET" "/groups/$PARENT_ID")
PARENT_PATH=$(echo "$response" | grep -o '"full_path":"[^"]*' | cut -d'"' -f4)

log "INFO" "Parent group: $PARENT_PATH (ID: $PARENT_ID)"

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
if [[ -n "$config_delay" ]] && [[ $API_DELAY -eq 100 ]]; then
    API_DELAY=$config_delay
fi

config_retries=$(parse_yaml "$CONFIG_FILE" ".options.max_retries")
if [[ -n "$config_retries" ]] && [[ $MAX_RETRIES -eq 3 ]]; then
    MAX_RETRIES=$config_retries
fi

if [[ $DRY_RUN == true ]]; then
    log "INFO" "DRY RUN MODE - No changes will be made"
fi

# Process subgroups
log "INFO" "Processing subgroups from configuration..."
process_subgroups "$PARENT_ID" "$PARENT_PATH" ".subgroups" 0

# Summary
if [[ $DRY_RUN == true ]]; then
    log "INFO" "DRY RUN COMPLETE - Review the output above for planned changes"
else
    log "SUCCESS" "Bulk subgroup creation complete!"
fi

log "INFO" "Check the log file for details: $LOG_FILE"