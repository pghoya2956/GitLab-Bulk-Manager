# Bulk Operations

GitLab Bulk Manager's core strength lies in its ability to perform mass operations efficiently. This guide covers all bulk operation features.

## Overview

Bulk operations allow you to:
- Create hundreds of groups at once
- Import projects from CSV files
- Add multiple members to groups
- Export and backup structures
- Perform mass updates

## CSV Import Features

### Groups Import

#### CSV Format
```csv
name,path,parent_id,description,visibility
Development Team,dev-team,,Main development group,private
Frontend Team,frontend-team,123,Frontend developers,private
Backend Team,backend-team,123,Backend developers,internal
```

#### Fields
- **name** (required): Display name of the group
- **path** (required): URL path (letters, numbers, hyphens, underscores)
- **parent_id** (optional): Parent group ID for subgroups
- **description** (optional): Group description
- **visibility** (required): `private`, `internal`, or `public`

#### Import Process
1. Navigate to **Bulk Operations** → **Import Groups**
2. Select your CSV file
3. Review the preview
4. Click **Import**
5. Monitor progress in real-time

### Projects Import

#### CSV Format
```csv
name,group_id,description,visibility,issues_enabled,wiki_enabled,default_branch
web-app,456,Main web application,private,true,true,main
api-service,456,REST API service,private,true,false,main
mobile-app,789,Mobile application,internal,true,true,develop
```

#### Fields
- **name** (required): Project name
- **group_id** (required): Target group ID
- **description** (optional): Project description
- **visibility** (required): `private`, `internal`, or `public`
- **issues_enabled** (optional): Enable issues (default: true)
- **wiki_enabled** (optional): Enable wiki (default: true)
- **default_branch** (optional): Default branch name (default: main)

### Members Import

#### CSV Format
```csv
username,group_id,access_level,expires_at
john.doe,123,developer,
jane.smith,123,maintainer,2024-12-31
bob.wilson,456,reporter,
```

#### Fields
- **username** (required): GitLab username
- **group_id** (required): Target group ID
- **access_level** (required): Access level (see below)
- **expires_at** (optional): Expiration date (YYYY-MM-DD)

#### Access Levels
- `guest` or `10`: Guest access
- `reporter` or `20`: Reporter access
- `developer` or `30`: Developer access
- `maintainer` or `40`: Maintainer access
- `owner` or `50`: Owner access

## Bulk Operations UI

### Import Workflow

```typescript
// Component structure
<BulkImport>
  <FileUpload />      // CSV file selection
  <DataPreview />     // Preview parsed data
  <ValidationErrors /> // Show any errors
  <ImportProgress />  // Real-time progress
  <ImportResults />   // Success/failure summary
</BulkImport>
```

### Real-time Progress

During import, you'll see:
- Progress bar showing completion percentage
- Current item being processed
- Success/failure count
- Estimated time remaining
- Detailed error messages for failures

### Error Handling

The system handles errors gracefully:
- Validation errors shown before import
- Failed items don't stop the entire import
- Detailed error logs for each failure
- Option to retry failed items
- Export failed items to CSV for correction

## Advanced Features

### Batch Processing

Large imports are processed in batches:
```javascript
// Default batch configuration
{
  batchSize: 50,        // Items per batch
  delayBetween: 1000,   // Milliseconds between batches
  maxConcurrent: 5,     // Concurrent API calls
  retryAttempts: 3      // Retry failed items
}
```

### Template Generation

Generate CSV templates with sample data:
1. Click **Download Template**
2. Choose entity type (groups, projects, members)
3. Get pre-formatted CSV with examples

### Validation Rules

#### Group Validation
- Name: 1-255 characters
- Path: lowercase letters, numbers, hyphens, underscores
- Parent ID: must exist and be accessible
- Visibility: must be valid option

#### Project Validation
- Name: 1-255 characters
- Group ID: must exist and user must have permission
- Default branch: valid Git branch name

#### Member Validation
- Username: must exist in GitLab
- Group ID: must exist and user must have permission
- Access level: valid level and not higher than current user

## Job Management

### Job Tracking

All bulk operations create trackable jobs:
```javascript
{
  id: "job-123",
  type: "bulk_create_groups",
  status: "running",
  progress: 45,
  total: 100,
  successCount: 44,
  failureCount: 1,
  startedAt: "2024-01-01T10:00:00Z",
  estimatedCompletion: "2024-01-01T10:05:00Z"
}
```

### Job States
- **Pending**: Queued for processing
- **Running**: Currently processing
- **Completed**: Successfully finished
- **Failed**: Stopped due to error
- **Cancelled**: Manually stopped

### Job Actions
- **View Details**: See full job information
- **View Logs**: Detailed processing logs
- **Retry Failed**: Retry only failed items
- **Cancel**: Stop running job
- **Export Results**: Download results as CSV

## Performance Optimization

### Large Dataset Handling

For imports with 1000+ items:
1. **Chunking**: Automatic splitting into manageable chunks
2. **Throttling**: Respect GitLab API rate limits
3. **Progress Saving**: Resume interrupted imports
4. **Memory Management**: Stream processing for large files

### Best Practices

1. **Test First**: Always test with small dataset
2. **Validate Data**: Check CSV formatting before import
3. **Off-Peak Hours**: Run large imports during low-usage times
4. **Monitor Progress**: Watch for errors during import
5. **Backup First**: Export existing structure before major changes

## Export Features

### Export Groups Structure
```javascript
// Export format
{
  "groups": [
    {
      "id": 123,
      "name": "Development",
      "path": "development",
      "full_path": "company/development",
      "parent_id": 100,
      "description": "Development team",
      "visibility": "private",
      "subgroups": [...]
    }
  ]
}
```

### Export Options
- **Format**: CSV or JSON
- **Include**: Subgroups, projects, members
- **Filters**: By visibility, creation date, etc.

## WebSocket Integration

Real-time updates during bulk operations:

```javascript
// Subscribe to job updates
socket.on('job:progress', (data) => {
  updateProgressBar(data.progress, data.total);
});

socket.on('job:item:success', (data) => {
  addSuccessItem(data.item);
});

socket.on('job:item:failed', (data) => {
  addFailedItem(data.item, data.error);
});

socket.on('job:completed', (data) => {
  showCompletionSummary(data);
});
```

## Error Recovery

### Common Errors and Solutions

1. **Rate Limit Exceeded**
   - Solution: Reduce batch size
   - Auto-retry with exponential backoff

2. **Permission Denied**
   - Solution: Verify user permissions
   - Skip item and continue

3. **Duplicate Entry**
   - Solution: Check "Skip Existing" option
   - Or update existing entries

4. **Invalid Data**
   - Solution: Fix CSV and re-import
   - Use validation preview

### Retry Strategies

```javascript
// Exponential backoff
const retryWithBackoff = async (fn, attempts = 3) => {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;
      await sleep(delay);
    }
  }
};
```

## Troubleshooting

### Import Fails Immediately
- Check CSV encoding (use UTF-8)
- Verify required columns exist
- Ensure no extra commas or quotes

### Slow Performance
- Reduce batch size
- Check network connection
- Verify GitLab API performance

### Partial Success
- Review error logs
- Fix data issues
- Re-import failed items only

## Examples

### Example: Migrate Organization Structure

1. Export from old system to CSV
2. Transform to required format
3. Import groups first (hierarchical order)
4. Import projects into groups
5. Import member assignments
6. Verify structure

### Example: Bulk Permission Update

```csv
username,group_id,access_level
john.doe,123,maintainer
jane.smith,123,maintainer
bob.wilson,123,developer
```

## API Reference

### Bulk Endpoints

```http
POST /api/gitlab/bulk/groups
POST /api/gitlab/bulk/projects
POST /api/gitlab/bulk/members

GET /api/jobs
GET /api/jobs/:id
POST /api/jobs/:id/retry
DELETE /api/jobs/:id
```

## Next Steps

- Try the [Quick Start Tutorial](../getting-started/quick-start.md)
- Learn about [Job Monitoring](./job-monitoring.md)
- Review [API Documentation](../api/README.md)
- Set up [Automation Scripts](../development/automation.md)