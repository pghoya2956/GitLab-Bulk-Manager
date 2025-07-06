# Features

## Dashboard
The main dashboard provides an overview of your GitLab instance:
- Total number of groups
- Total number of projects  
- Active users count
- Quick access to all major features
- Permission overview with PermissionTree component

## Group Management

### Hierarchical Tree View
- **Lazy Loading**: Groups and subgroups load on-demand for performance
- **Visual Indicators**: Icons show group/project types and visibility levels
- **Search**: Real-time filtering of groups and projects
- **Drag-and-Drop**: Reorganize group hierarchy visually

### Group Operations
- Create new groups and subgroups
- Update group settings (visibility, description)
- Delete groups with confirmation
- View group details and statistics

## Project Management

### Two-Pane Layout
- **Left Panel**: Tree navigation with all groups and projects
- **Right Panel**: Details and actions for selected item

### Project Features
- Create projects within groups
- Clone projects
- Update project settings
- Batch operations on multiple projects
- Quick access to project URLs

## Bulk Operations

### Context-Aware Interface
The bulk operations page uses a two-step process:
1. **Select Target Group**: Choose where operations will be performed
2. **Choose Operation**: Import groups, projects, or members

### Import Groups
Import multiple groups from a CSV file:
```csv
name|path|parent_id|description|visibility
Frontend Team|frontend||Frontend development team|private
Backend Team|backend||Backend development team|internal
```

**Features:**
- Shows selected parent group clearly
- Progress tracking for each import
- Success/failure status for each row
- Detailed error messages

### Import Projects
Batch create projects from CSV:
```csv
name|group_id|description|visibility|issues_enabled|wiki_enabled|default_branch
web-app|123|Main web application|private|true|true|main
api-service|123|API service|internal|true|false|main
```

**Features:**
- Automatic group assignment
- Project settings configuration
- Namespace validation

### Import Members
Add multiple members to groups:
```csv
email|group_path|access_level|expiry_date
user@example.com|dev-team|developer|2024-12-31
lead@example.com|dev-team|maintainer|
```

**Features:**
- User lookup by email
- Access level assignment (guest, reporter, developer, maintainer, owner)
- Optional expiry dates
- Bulk permission management

## Jobs Management

### Background Jobs
Track long-running operations:
- Real-time progress updates
- Job status (pending, running, completed, failed)
- Detailed logs for each job
- Ability to cancel running jobs

### Job Types
- Group structure imports
- Project batch creation
- Member synchronization
- Backup operations

## Permission Management

### Permission Tree View
The PermissionTree component provides a comprehensive view of user permissions:
- **Hierarchical Display**: Shows all groups and projects with your access levels
- **Access Level Badges**: Color-coded badges showing your role (Owner, Maintainer, Developer, Reporter, Guest)
- **Member Counts**: See how many members each group/project has
- **Visibility Indicators**: Icons showing if resources are public, internal, or private
- **Search and Filter**: Quickly find specific groups or projects
- **Auto-expansion**: Search results automatically expand parent groups

### Permission Overview Features
- View all your GitLab permissions in one place
- Understand your access levels across the organization
- Identify where you have elevated privileges
- Quick navigation to groups and projects
- Real-time permission data from GitLab API

## Search and Filter

### Global Search
- Search across groups and projects
- Filter by visibility level
- Filter by type (group/project)
- Real-time results

### Tree Search
- Inline search in tree views
- Highlights matching items
- Preserves tree structure

## User Interface Features

### Responsive Design
- Works on desktop and tablet devices
- Adaptive layouts for different screen sizes
- Touch-friendly for tablet use

### Dark Mode Support
- System preference detection
- Manual toggle option
- Consistent theming across components

### Accessibility
- Keyboard navigation support
- ARIA labels for screen readers
- High contrast mode support
- Focus indicators

## Performance Optimizations

### Lazy Loading
- Tree nodes load children on-demand
- Pagination for large result sets
- Virtual scrolling for long lists

### Caching
- API response caching
- Optimistic UI updates
- Background data refresh

### Code Splitting
- Route-based code splitting
- Lazy component loading
- Reduced initial bundle size