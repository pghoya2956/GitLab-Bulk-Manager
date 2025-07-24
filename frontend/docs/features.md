# Features

## Overview

GitLab Bulk Manager provides a comprehensive suite of tools for efficient GitLab administration. This document details all available features and their capabilities.

## Dashboard
The main dashboard provides a real-time overview of your GitLab instance:
- **Resource Statistics**: Total groups, projects, and active users
- **Quick Actions**: Direct access to all major features
- **System Health**: At-a-glance system status
- **Permission Overview**: Summary of your access levels across the instance
- **Recent Activity**: Latest bulk operations and their status

## Group & Project Management

### Unified Tree View
The Groups & Projects page features an advanced tree interface:
- **Hierarchical Display**: Visual representation of your GitLab structure
- **Lazy Loading**: Groups and subgroups load on-demand for optimal performance
- **Visual Indicators**: 
  - Icons showing group/project types
  - Visibility levels (public, internal, private)
  - Member counts
  - Your access level badges
- **Real-time Search**: Filter groups and projects instantly
- **Drag-and-Drop**: Reorganize group hierarchy with visual feedback

### Integrated Permissions Display
- **Access Level Badges**: Color-coded indicators (Owner, Maintainer, Developer, Reporter, Guest)
- **Member Counts**: See total members for each group/project
- **Developer+ Filter**: Toggle to show only items where you have Developer access or higher
- **Permission Inheritance**: Visual indication of inherited permissions

### CRUD Operations

#### Group Operations
- **Create Groups**: Single or nested group creation with full configuration
- **Update Settings**: Batch update visibility, description, and other settings
- **Move Groups**: Drag-and-drop reorganization with validation
- **Delete Groups**: Safe deletion with dependency checking

#### Project Operations
- **Create Projects**: Within any group with template support
- **Clone Projects**: Duplicate project structure and settings
- **Batch Updates**: Modify multiple project settings simultaneously
- **Archive/Unarchive**: Bulk archive operations

## Bulk Operations

### Smart CSV Import Interface
The bulk operations page provides context-aware importing:

1. **Target Selection**: Choose destination group before importing
2. **Operation Types**: 
   - Import Groups
   - Import Projects
   - Import Members
   - Import Settings

### Import Groups
Create multiple groups from CSV with hierarchical support:
```csv
name|path|parent_id|description|visibility|lfs_enabled|request_access_enabled
Frontend Team|frontend||Frontend development team|private|true|false
React Components|react-components|frontend|React component library|internal|true|true
Vue Components|vue-components|frontend|Vue component library|internal|true|true
```

**Features:**
- Hierarchical structure support
- Visibility and feature configuration
- Progress tracking per row
- Detailed error reporting
- Rollback on failure option

### Import Projects
Batch create projects with full configuration:
```csv
name|path|description|visibility|issues_enabled|wiki_enabled|merge_requests_enabled|default_branch
web-app|web-app|Main web application|private|true|true|true|main
mobile-api|mobile-api|Mobile API service|internal|true|false|true|main
docs-site|docs-site|Documentation website|public|true|true|false|main
```

**Features:**
- Automatic namespace resolution
- Project feature toggles
- Branch configuration
- Template application
- Import with initial content

### Import Members
Add multiple members with role assignments:
```csv
username|email|access_level|expires_at|can_create_group|can_create_project
john.doe|john@example.com|developer|2024-12-31|false|true
jane.smith|jane@example.com|maintainer||true|true
bob.wilson|bob@example.com|guest|2024-06-30|false|false
```

**Supported Access Levels:**
- `guest` (10)
- `reporter` (20)
- `developer` (30)
- `maintainer` (40)
- `owner` (50)

**Features:**
- User lookup by username or email
- Expiration date support
- Custom permissions
- Notification settings
- Bulk role changes

### Import Settings
Apply settings to multiple groups/projects:
```csv
target_type|target_path|setting_type|setting_value
group|frontend|visibility|internal
project|frontend/web-app|issues_enabled|true
group|backend|lfs_enabled|false
```

## Real-time Job Management

### Job Tracking Dashboard
Monitor all background operations:
- **Live Progress**: Real-time updates via WebSocket
- **Job States**: Queued, Running, Completed, Failed, Cancelled
- **Detailed Logs**: Step-by-step execution logs
- **Performance Metrics**: Time taken, items processed
- **Error Details**: Comprehensive error messages with remediation hints

### Job Types
- **Bulk Imports**: Track CSV import progress
- **Hierarchy Changes**: Monitor group/project moves
- **Permission Updates**: Track access level changes
- **Deletion Operations**: Monitor bulk deletions

### Job Management Features
- **Pause/Resume**: Pause long-running operations
- **Cancel**: Stop jobs with cleanup
- **Retry**: Re-run failed jobs
- **Export Results**: Download job results as CSV

## Permission Management

### Comprehensive Permission Overview
The permission system provides complete visibility:

#### Permission Tree Features
- **Hierarchical View**: See all groups and projects with your access levels
- **Access Level Display**:
  - **Owner** (Red): Full control
  - **Maintainer** (Orange): Management access
  - **Developer** (Blue): Development access
  - **Reporter** (Green): Read and create issues
  - **Guest** (Gray): Limited read access
- **Inherited Permissions**: Understand permission inheritance
- **Effective Permissions**: See calculated permissions

#### Permission Analysis
- **Access Audit**: Review who has access to what
- **Permission Changes**: Track permission modifications
- **Compliance Reports**: Generate access reports
- **Orphaned Resources**: Identify resources without proper ownership

## Search and Filter Capabilities

### Global Search
- **Multi-resource Search**: Search across groups, projects, and members
- **Advanced Filters**:
  - By visibility level
  - By access level
  - By resource type
  - By creation date
  - By last activity
- **Search Operators**: Support for wildcards and regex
- **Saved Searches**: Save frequently used search queries

### Tree Navigation
- **Quick Find**: Inline search within tree views
- **Auto-expansion**: Matching items expand automatically
- **Highlight Matches**: Visual highlighting of search results
- **Breadcrumb Navigation**: Quick navigation to parent groups

## User Interface Features

### Modern UI/UX
- **Responsive Design**: Optimized for desktop and tablet
- **Dark Mode**: System-aware theme switching
- **Accessibility**: 
  - Full keyboard navigation
  - Screen reader support
  - ARIA labels
  - High contrast mode

### Interactive Elements
- **Tooltips**: Contextual help throughout
- **Confirmation Dialogs**: Prevent accidental actions
- **Progress Indicators**: Visual feedback for all operations
- **Toast Notifications**: Non-intrusive status updates

## Performance Features

### Optimization Techniques
- **Virtual Scrolling**: Handle thousands of items smoothly
- **Lazy Loading**: Load data only when needed
- **Request Debouncing**: Optimize API calls
- **Caching Strategy**: 
  - 5-minute cache for resource data
  - Intelligent cache invalidation
  - Offline capability for read operations

### Bulk Operation Performance
- **Batch Processing**: Process items in configurable batches
- **Rate Limiting**: Respect GitLab API limits
- **Parallel Processing**: Multiple operations when possible
- **Progress Persistence**: Resume interrupted operations

## Integration Features

### GitLab API Integration
- **API Version Support**: Compatible with GitLab 13.0+
- **Authentication Methods**:
  - Personal Access Tokens
  - OAuth2 (coming soon)
- **Rate Limit Handling**: Automatic retry with backoff
- **Error Recovery**: Graceful handling of API errors

### Export/Import Capabilities
- **Export Formats**:
  - CSV for all data types
  - JSON for complex structures
  - YAML for GitLab CI/CD configs
- **Import Validation**: Pre-import validation and preview
- **Transformation Rules**: Data mapping and transformation

## Security Features

### Authentication & Authorization
- **Secure Session Management**: Backend-stored tokens
- **Session Timeout**: Configurable inactivity timeout
- **Multi-factor Authentication**: When enabled on GitLab
- **Permission Validation**: Double-check permissions before operations

### Data Protection
- **Encrypted Communication**: All API calls over HTTPS
- **Input Sanitization**: Prevent injection attacks
- **CSRF Protection**: Token validation for state changes
- **Audit Logging**: Track all administrative actions

## System Health Monitoring

### Health Dashboard
- **API Status**: Real-time GitLab API health
- **Performance Metrics**: Response times and throughput
- **Error Rates**: Track and analyze errors
- **Resource Usage**: Monitor API quota usage

### Diagnostics
- **Connection Test**: Verify GitLab connectivity
- **Permission Test**: Validate access token permissions
- **Performance Test**: Measure API response times
- **Diagnostic Export**: Generate support bundles

## Documentation

### Integrated Documentation
- **In-app Docs**: Context-sensitive help
- **API Reference**: Complete API documentation
- **Video Tutorials**: Embedded how-to videos
- **Keyboard Shortcuts**: Quick reference guide

### Multi-language Support
- **English**: Full documentation
- **Korean**: Complete Korean translation
- **Extensible**: Framework for additional languages

---

**Last Updated**: 2025-07-24