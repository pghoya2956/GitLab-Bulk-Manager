# Permission Tree Component

## Overview

The PermissionTree component provides a visual hierarchical representation of a user's GitLab permissions across all groups and projects. It displays access levels, member counts, and visibility settings in an intuitive tree structure.

## Features

- **Hierarchical Display**: Shows groups, subgroups, and projects in a tree structure
- **Access Level Visualization**: Color-coded badges for different permission levels
- **Search Functionality**: Filter groups and projects by name
- **Auto-expansion**: Automatically expands nodes when searching
- **Member Count**: Shows the number of members in each group/project
- **Visibility Indicators**: Icons showing public, internal, or private visibility

## Component Usage

```tsx
import { PermissionTree } from '../components/PermissionTree';

// Basic usage
<PermissionTree />
```

The component is self-contained and doesn't require any props. It automatically fetches permission data from the API.

## API Endpoint

The component fetches data from:
```
GET /api/permissions/overview
```

### Response Structure

```typescript
interface PermissionData {
  user: {
    id: number;
    username: string;
    name: string;
  };
  groups: Group[];
  timestamp: string;
}

interface Group {
  id: number;
  name: string;
  full_path: string;
  description?: string;
  parent_id?: number;
  visibility: 'public' | 'internal' | 'private';
  member_count: number;
  user_access: {
    access_level: number;
    access_level_name: string;
  };
  projects: Project[];
  subgroups: Group[];
  error?: string;
}

interface Project {
  id: number;
  name: string;
  path: string;
  description?: string;
  member_count: number;
  visibility: 'public' | 'internal' | 'private';
  user_access: {
    access_level: number;
    access_level_name: string;
  };
}
```

## Access Levels

The component displays the following access levels with color coding:

| Level | Color | Hex Code | Permissions |
|-------|-------|----------|-------------|
| Owner | Red | #ff6b6b | Full control, can delete group/project |
| Maintainer | Blue | #4dabf7 | Can push to protected branches, manage settings |
| Developer | Green | #51cf66 | Can push code, manage issues |
| Reporter | Gray | #868e96 | Can view and create issues |
| Guest | Light Gray | #adb5bd | Can view public/internal projects |

## Visibility Icons

- **Public** 👁️ (Visibility icon): Anyone can view
- **Internal** 🛡️ (Security icon): Logged-in users can view
- **Private** 👁️‍🗨️ (VisibilityOff icon): Only members can view

## UI Components

### Group Node
Each group displays:
- Expand/collapse button (if has children)
- Folder icon (changes to open folder when expanded)
- Group name
- Member count chip
- Access level badge
- Visibility icon
- Description (if available)

### Project Node
Each project displays:
- Code icon
- Project name
- Member count chip
- Access level badge
- Visibility icon
- Description (if available)

## Search Behavior

The search feature:
- Filters groups and projects by name and path
- Auto-expands parent groups if children match
- Highlights matching results
- Case-insensitive search

## Error Handling

- Displays loading spinner while fetching data
- Shows error alerts for failed API calls
- Individual group errors are shown inline
- Graceful fallback for missing data

## Performance Considerations

- Data is fetched once on component mount
- No pagination (loads all permissions at once)
- Search is performed client-side
- Collapsed nodes don't render children (lazy rendering)

## Example Integration

### In Dashboard

```tsx
import { PermissionTree } from '../components/PermissionTree';
import { Card, CardContent, Typography } from '@mui/material';

function Dashboard() {
  return (
    <div>
      <Typography variant="h4" gutterBottom>
        My Permissions
      </Typography>
      <PermissionTree />
    </div>
  );
}
```

### With Error Boundary

```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={<div>Error loading permissions</div>}>
  <PermissionTree />
</ErrorBoundary>
```

## Styling

The component uses Material-UI theming and can be customized through:

```tsx
// Custom theme colors for access levels
const theme = createTheme({
  palette: {
    accessLevels: {
      owner: '#ff6b6b',
      maintainer: '#4dabf7',
      developer: '#51cf66',
      reporter: '#868e96',
      guest: '#adb5bd',
    }
  }
});
```

## Accessibility

- Keyboard navigation support for tree expansion
- ARIA labels for screen readers
- Color contrast compliant badges
- Tooltips for additional context

## Future Enhancements

Potential improvements:
- Pagination for large permission sets
- Export permissions to CSV
- Permission change history
- Bulk permission management
- Real-time permission updates
- Permission comparison between users