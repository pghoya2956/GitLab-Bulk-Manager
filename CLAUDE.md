# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a GitLab management automation repository containing bash scripts for managing GitLab groups, projects, and backups via the GitLab API. All scripts follow a consistent pattern using common libraries for logging, validation, and API interactions.

## Key Architecture Patterns

### Script Structure
All scripts follow this pattern:
1. Load common libraries (`source "$BASE_DIR/lib/common.sh"` and `validation.sh`)
2. Define help function with usage examples
3. Parse command-line arguments
4. Initialize script with `init_script` (sets up logging)
5. Load GitLab config with `load_config`
6. Execute main logic

### Common Functions (lib/common.sh)
- `log [LEVEL] [MESSAGE]`: Unified logging (ERROR, WARN, INFO, DEBUG)
- `error_exit [MESSAGE] [CODE]`: Exit with error
- `gitlab_api [METHOD] [ENDPOINT] [DATA]`: GitLab API wrapper
- `gitlab_api_paginated`: Handle paginated API responses
- `confirm [MESSAGE]`: User confirmation prompts
- `is_dry_run`: Check if running in dry-run mode
- `show_progress`: Display progress bars

### API Interaction Pattern
```bash
response=$(gitlab_api "GET" "/groups/$GROUP_ID")
http_code=$?
if [[ $http_code -eq 200 ]]; then
    # Process response
fi
```

## Essential Commands

### Initial Setup
```bash
# Copy and configure GitLab credentials
cp Scripts/config/gitlab.env.example Scripts/config/gitlab.env
# Edit gitlab.env with GITLAB_URL and GITLAB_TOKEN

# Make all scripts executable
find Scripts -name "*.sh" -type f -exec chmod +x {} \;
```

### Testing Changes
```bash
# Always test with dry-run first
./Scripts/groups/create_groups.sh --name "Test" --dry-run

# Check logs for debugging
tail -f Scripts/logs/[script_name]_*.log

# Enable debug logging
LOG_LEVEL=DEBUG ./Scripts/groups/list_groups.sh
```

### Common Development Tasks

When adding new scripts:
1. Place in appropriate directory (groups/, projects/, backups/, etc.)
2. Source common libraries at the top
3. Implement `--dry-run` support
4. Use `gitlab_api` functions for API calls
5. Add comprehensive `--help` documentation

When modifying API calls:
- Check GitLab API version compatibility
- Use `gitlab_api_paginated` for list endpoints
- Handle common HTTP codes (200, 201, 202, 204, 404, etc.)

## File Formats

### groups.txt (for batch group creation)
```
# Format: name|path|parent_id|description|visibility
Frontend Team|frontend||Frontend development team|private
Backend Team|backend||Backend development team|internal
```

### projects.txt (for batch project creation)
```
# Category name (comments)
project-name-1
project-name-2
```

## Critical Configuration

- **Scripts/config/gitlab.env**: Contains GITLAB_URL and GITLAB_TOKEN (never commit)
- **Scripts/config/projects.txt**: List of projects for batch operations
- All scripts respect `DRY_RUN=true` environment variable

## Dependencies

- bash 4.0+
- curl
- jq (for JSON parsing)
- git (for clone/backup operations)
- Standard Unix tools (sed, awk, grep)