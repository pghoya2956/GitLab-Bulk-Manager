#!/bin/bash

# Idempotent functions for GitLab automation
# Ensures operations can be safely re-run without creating duplicates

# Check if a group exists by ID
# Usage: group_exists_by_id GROUP_ID
# Returns: 0 if exists, 1 if not
group_exists_by_id() {
    local group_id="$1"
    
    if [[ -z "$group_id" ]]; then
        return 1
    fi
    
    local response
    response=$(gitlab_api "GET" "/groups/$group_id" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        return 0
    else
        return 1
    fi
}

# Check if a group exists by path under a parent
# Usage: group_exists_by_path PARENT_ID GROUP_PATH
# Returns: 0 if exists, 1 if not
group_exists_by_path() {
    local parent_id="$1"
    local group_path="$2"
    
    if [[ -z "$group_path" ]]; then
        return 1
    fi
    
    # Search for subgroups under parent
    local endpoint="/groups"
    if [[ -n "$parent_id" ]]; then
        endpoint="/groups/$parent_id/subgroups"
    fi
    
    local response
    response=$(gitlab_api_paginated "GET" "$endpoint" 100 2>/dev/null)
    
    # Check if jq is available for JSON parsing
    if command -v jq &> /dev/null; then
        local exists
        exists=$(echo "$response" | jq -r --arg path "$group_path" '.[] | select(.path == $path) | .id' | head -1)
        if [[ -n "$exists" ]]; then
            echo "$exists"  # Return the group ID
            return 0
        fi
    else
        # Fallback to grep if jq not available
        if echo "$response" | grep -q "\"path\":\"$group_path\""; then
            # Extract ID using grep and sed
            local group_id
            group_id=$(echo "$response" | grep -B2 -A2 "\"path\":\"$group_path\"" | grep '"id":' | head -1 | sed 's/.*"id":\s*\([0-9]*\).*/\1/')
            if [[ -n "$group_id" ]]; then
                echo "$group_id"
                return 0
            fi
        fi
    fi
    
    return 1
}

# Check if a project exists by name in a group
# Usage: project_exists_in_group GROUP_ID PROJECT_NAME
# Returns: 0 if exists, 1 if not
project_exists_in_group() {
    local group_id="$1"
    local project_name="$2"
    
    if [[ -z "$group_id" ]] || [[ -z "$project_name" ]]; then
        return 1
    fi
    
    local response
    response=$(gitlab_api_paginated "GET" "/groups/$group_id/projects" 100 2>/dev/null)
    
    # Check if jq is available
    if command -v jq &> /dev/null; then
        local exists
        exists=$(echo "$response" | jq -r --arg name "$project_name" '.[] | select(.name == $name) | .id' | head -1)
        if [[ -n "$exists" ]]; then
            echo "$exists"  # Return the project ID
            return 0
        fi
    else
        # Fallback to grep
        if echo "$response" | grep -q "\"name\":\"$project_name\""; then
            # Extract ID
            local project_id
            project_id=$(echo "$response" | grep -B2 -A2 "\"name\":\"$project_name\"" | grep '"id":' | head -1 | sed 's/.*"id":\s*\([0-9]*\).*/\1/')
            if [[ -n "$project_id" ]]; then
                echo "$project_id"
                return 0
            fi
        fi
    fi
    
    return 1
}

# Check if a user exists and get their ID
# Usage: user_exists USERNAME_OR_EMAIL
# Returns: 0 if exists (echoes user ID), 1 if not
user_exists() {
    local username="$1"
    
    if [[ -z "$username" ]]; then
        return 1
    fi
    
    local response
    response=$(gitlab_api "GET" "/users?username=$username" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        # Check if jq is available
        if command -v jq &> /dev/null; then
            local user_id
            user_id=$(echo "$response" | jq -r '.[0].id' 2>/dev/null)
            if [[ -n "$user_id" ]] && [[ "$user_id" != "null" ]]; then
                echo "$user_id"
                return 0
            fi
        else
            # Fallback to grep
            local user_id
            user_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
            if [[ -n "$user_id" ]]; then
                echo "$user_id"
                return 0
            fi
        fi
    fi
    
    return 1
}

# Check if a user is already a member of a group
# Usage: is_group_member GROUP_ID USER_ID
# Returns: 0 if member, 1 if not
is_group_member() {
    local group_id="$1"
    local user_id="$2"
    
    if [[ -z "$group_id" ]] || [[ -z "$user_id" ]]; then
        return 1
    fi
    
    local response
    response=$(gitlab_api "GET" "/groups/$group_id/members/$user_id" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        return 0
    else
        return 1
    fi
}

# Check if a CI/CD variable exists in a group
# Usage: group_variable_exists GROUP_ID VARIABLE_KEY
# Returns: 0 if exists, 1 if not
group_variable_exists() {
    local group_id="$1"
    local key="$2"
    
    if [[ -z "$group_id" ]] || [[ -z "$key" ]]; then
        return 1
    fi
    
    local response
    response=$(gitlab_api "GET" "/groups/$group_id/variables/$key" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        return 0
    else
        return 1
    fi
}

# Check if a CI/CD variable exists in a project
# Usage: project_variable_exists PROJECT_ID VARIABLE_KEY
# Returns: 0 if exists, 1 if not
project_variable_exists() {
    local project_id="$1"
    local key="$2"
    
    if [[ -z "$project_id" ]] || [[ -z "$key" ]]; then
        return 1
    fi
    
    local response
    response=$(gitlab_api "GET" "/projects/$project_id/variables/$key" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        return 0
    else
        return 1
    fi
}

# Check if a branch protection rule exists
# Usage: branch_protection_exists PROJECT_ID BRANCH_NAME
# Returns: 0 if exists, 1 if not
branch_protection_exists() {
    local project_id="$1"
    local branch="$2"
    
    if [[ -z "$project_id" ]] || [[ -z "$branch" ]]; then
        return 1
    fi
    
    local response
    response=$(gitlab_api "GET" "/projects/$project_id/protected_branches/$branch" 2>/dev/null)
    local http_code=$?
    
    if [[ $http_code -eq 200 ]]; then
        return 0
    else
        return 1
    fi
}

# Safe group creation with idempotency
# Usage: create_group_idempotent NAME PATH PARENT_ID [ADDITIONAL_JSON]
# Returns: Group ID (either existing or newly created)
create_group_idempotent() {
    local name="$1"
    local path="$2"
    local parent_id="$3"
    local additional_json="${4:-}"
    
    # Check if group already exists
    local existing_id
    existing_id=$(group_exists_by_path "$parent_id" "$path")
    
    if [[ $? -eq 0 ]] && [[ -n "$existing_id" ]]; then
        log "INFO" "Group '$path' already exists with ID: $existing_id"
        echo "$existing_id"
        return 0
    fi
    
    # Create the group
    local data="{\"name\":\"$name\",\"path\":\"$path\""
    
    if [[ -n "$parent_id" ]]; then
        data+=",\"parent_id\":$parent_id"
    fi
    
    if [[ -n "$additional_json" ]]; then
        data+=",${additional_json}"
    fi
    
    data+="}"
    
    log "INFO" "Creating group: $name ($path)"
    
    local response
    response=$(gitlab_api "POST" "/groups" "$data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]]; then
        local group_id
        if command -v jq &> /dev/null; then
            group_id=$(echo "$response" | jq -r '.id')
        else
            group_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        fi
        
        log "SUCCESS" "Group created with ID: $group_id"
        echo "$group_id"
        return 0
    else
        log "ERROR" "Failed to create group: $response"
        return 1
    fi
}

# Safe project creation with idempotency
# Usage: create_project_idempotent NAME GROUP_ID [ADDITIONAL_JSON]
# Returns: Project ID (either existing or newly created)
create_project_idempotent() {
    local name="$1"
    local group_id="$2"
    local additional_json="${3:-}"
    
    # Check if project already exists
    local existing_id
    existing_id=$(project_exists_in_group "$group_id" "$name")
    
    if [[ $? -eq 0 ]] && [[ -n "$existing_id" ]]; then
        log "INFO" "Project '$name' already exists with ID: $existing_id"
        echo "$existing_id"
        return 0
    fi
    
    # Create the project
    local data="{\"name\":\"$name\",\"namespace_id\":$group_id"
    
    if [[ -n "$additional_json" ]]; then
        data+=",${additional_json}"
    fi
    
    data+="}"
    
    log "INFO" "Creating project: $name in group $group_id"
    
    local response
    response=$(gitlab_api "POST" "/projects" "$data")
    local http_code=$?
    
    if [[ $http_code -eq 201 ]]; then
        local project_id
        if command -v jq &> /dev/null; then
            project_id=$(echo "$response" | jq -r '.id')
        else
            project_id=$(echo "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
        fi
        
        log "SUCCESS" "Project created with ID: $project_id"
        echo "$project_id"
        return 0
    else
        log "ERROR" "Failed to create project: $response"
        return 1
    fi
}

# Export functions for use in other scripts
export -f group_exists_by_id
export -f group_exists_by_path
export -f project_exists_in_group
export -f user_exists
export -f is_group_member
export -f group_variable_exists
export -f project_variable_exists
export -f branch_protection_exists
export -f create_group_idempotent
export -f create_project_idempotent