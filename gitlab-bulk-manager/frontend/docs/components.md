# Components

## Core Components

### GitLabTree

A hierarchical tree view component for displaying GitLab groups and projects.

#### Props
```typescript
interface GitLabTreeProps {
  onSelect: (node: TreeNode) => void;
  onDragStart?: (node: TreeNode) => void;
  onDrop?: (targetNode: TreeNode, draggedNode: TreeNode) => void;
  selectedNodeId?: string;
}
```

#### Features
- Lazy loading of child nodes
- Drag and drop support
- Search functionality
- Visual feedback for operations

#### Usage
```tsx
<GitLabTree
  onSelect={handleNodeSelect}
  onDrop={handleDragDrop}
  selectedNodeId={selectedNode?.id}
/>
```

### Layout

The main application layout with navigation header.

#### Features
- Responsive navigation bar
- User menu with logout
- Active route highlighting
- Breadcrumb support

#### Structure
```tsx
<Layout>
  <AppBar />
  <Container>
    <Outlet /> {/* Page content */}
  </Container>
</Layout>
```

## Bulk Operation Components

### ImportGroups

Handles bulk import of groups from CSV files.

#### Props
```typescript
interface ImportGroupsProps {
  selectedGroup?: {
    id: number;
    name: string;
    full_path: string;
  };
}
```

#### CSV Format
```csv
name|path|parent_id|description|visibility
Frontend Team|frontend||Frontend development team|private
```

#### Features
- File upload with drag-and-drop
- Progress tracking
- Error handling per row
- Context-aware parent group selection

### ImportProjects

Bulk project creation from CSV files.

#### CSV Format
```csv
name|group_id|description|visibility|issues_enabled|wiki_enabled|default_branch
web-app|123|Main application|private|true|true|main
```

#### Features
- Automatic namespace assignment
- Project configuration options
- Batch processing with progress

### ImportMembers

Add multiple members to groups.

#### CSV Format
```csv
email|group_path|access_level|expiry_date
user@example.com|dev-team|developer|2024-12-31
```

#### Access Levels
- `guest` (10)
- `reporter` (20)
- `developer` (30)
- `maintainer` (40)
- `owner` (50)

## Common Components

### LoadingSpinner

Consistent loading indicator across the app.

```tsx
<LoadingSpinner size="large" message="Loading groups..." />
```

### ConfirmDialog

Reusable confirmation dialog for destructive actions.

```tsx
<ConfirmDialog
  open={open}
  title="Delete Group"
  message="Are you sure you want to delete this group?"
  onConfirm={handleDelete}
  onCancel={() => setOpen(false)}
/>
```

### ErrorAlert

Displays error messages with retry option.

```tsx
<ErrorAlert
  error="Failed to load data"
  onRetry={handleRetry}
  onDismiss={() => setError(null)}
/>
```

## Form Components

### GroupForm

Form for creating/editing groups.

#### Fields
- Name (required)
- Path (auto-generated from name)
- Description
- Visibility level
- Parent group (optional)

### ProjectForm

Form for project creation.

#### Fields
- Name (required)
- Namespace (group selection)
- Description
- Visibility
- Initialize with README
- Default branch

## Table Components

### GroupTable

Displays groups in a sortable, filterable table.

#### Features
- Column sorting
- Pagination
- Row selection
- Action buttons per row
- Bulk actions

### ProjectTable

Similar to GroupTable but for projects.

#### Additional Features
- Status indicators
- Quick links to GitLab
- Clone URL copy button

## Dialog Components

### CreateGroupDialog

Modal for creating new groups.

```tsx
<CreateGroupDialog
  open={open}
  parentGroup={selectedGroup}
  onClose={() => setOpen(false)}
  onSuccess={handleGroupCreated}
/>
```

### EditProjectDialog

Modal for editing project settings.

```tsx
<EditProjectDialog
  open={open}
  project={selectedProject}
  onClose={() => setOpen(false)}
  onSuccess={handleProjectUpdated}
/>
```

## Navigation Components

### Breadcrumbs

Shows current location in hierarchy.

```tsx
<Breadcrumbs>
  <Link to="/groups">Groups</Link>
  <Link to="/groups/123">Parent Group</Link>
  <Typography>Current Group</Typography>
</Breadcrumbs>
```

### TabNavigation

For switching between related views.

```tsx
<TabNavigation
  tabs={[
    { label: 'Groups', value: 'groups' },
    { label: 'Projects', value: 'projects' },
    { label: 'Members', value: 'members' }
  ]}
  value={activeTab}
  onChange={setActiveTab}
/>
```

## Utility Components

### CopyButton

Copy text to clipboard with feedback.

```tsx
<CopyButton text="https://gitlab.com/group/project.git" />
```

### StatusChip

Visual status indicators.

```tsx
<StatusChip status="success" label="Active" />
<StatusChip status="error" label="Failed" />
<StatusChip status="warning" label="Pending" />
```

### VisibilityIcon

Icons for GitLab visibility levels.

```tsx
<VisibilityIcon level="private" /> // Lock icon
<VisibilityIcon level="internal" /> // Shield icon
<VisibilityIcon level="public" /> // Globe icon
```

## Component Best Practices

### Props Interface
Always define TypeScript interfaces for props:
```typescript
interface ComponentProps {
  required: string;
  optional?: number;
  callback: (value: string) => void;
}
```

### Default Props
Use default parameters for optional props:
```typescript
const Component: React.FC<ComponentProps> = ({
  required,
  optional = 42,
  callback
}) => {
  // Component logic
};
```

### Memoization
Use React.memo for expensive components:
```typescript
export const ExpensiveComponent = React.memo(Component, (prev, next) => {
  return prev.data.id === next.data.id;
});
```

### Error Boundaries
Wrap feature components with error boundaries:
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <FeatureComponent />
</ErrorBoundary>
```