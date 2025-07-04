# Quick Start Tutorial

Get up and running with GitLab Bulk Manager in 5 minutes! This tutorial will walk you through your first bulk operation.

## Prerequisites

Before starting, ensure you have:
1. ✅ Completed the [Installation](./installation.md)
2. ✅ Backend server running on port 4000
3. ✅ Frontend server running on port 3000
4. ✅ GitLab Personal Access Token ready

## Step 1: Start the Application

### Start Both Servers
```bash
# Quick start script
./start.sh

# Or manually:
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

### Access the Application
Open your browser and navigate to: [http://localhost:3000](http://localhost:3000)

## Step 2: Login to GitLab

1. **Enter GitLab URL**: 
   - For GitLab.com: `https://gitlab.com`
   - For self-hosted: `https://your-gitlab-instance.com`

2. **Enter Personal Access Token**:
   - Paste your PAT with required scopes
   - The token is securely stored in server session

3. **Click Login**:
   - You'll be redirected to the dashboard

![Login Screen](../assets/login-screen.png)

## Step 3: Explore Existing Structure

### View Groups
1. Click **Groups** in the sidebar
2. You'll see your GitLab groups in a list
3. Click on any group to see its details

### View Projects Tree
1. Click **Projects** in the sidebar
2. Explore the hierarchical tree view
3. Expand groups to see nested projects
4. Click on projects to view details

## Step 4: Create Your First Bulk Operation

### Example 1: Bulk Create Groups

1. Navigate to **Bulk Operations** → **Import Groups**
2. Create a CSV file with this content:
   ```csv
   name,path,description,visibility
   Development Team,dev-team,Main development group,private
   QA Team,qa-team,Quality assurance group,private
   DevOps Team,devops-team,Infrastructure team,internal
   ```

3. Click **Choose File** and select your CSV
4. Review the preview
5. Click **Import Groups**
6. Monitor progress in real-time

### Example 2: Bulk Create Projects

1. Navigate to **Bulk Operations** → **Import Projects**
2. Create a CSV file:
   ```csv
   name,group_id,description,visibility
   frontend-app,123,React frontend application,private
   backend-api,123,Node.js API server,private
   mobile-app,123,React Native app,private
   ```
   *Replace `123` with an actual group ID*

3. Import and monitor progress

### Example 3: Bulk Add Members

1. Navigate to **Bulk Operations** → **Import Members**
2. Create a CSV file:
   ```csv
   username,group_id,access_level
   john.doe,123,developer
   jane.smith,123,maintainer
   bob.wilson,123,reporter
   ```

3. Import and watch the magic happen!

## Step 5: Advanced Features

### Drag & Drop Organization
1. Go to **Projects** view
2. Drag projects between groups
3. Reorganize your GitLab structure visually

### Job Monitoring
1. Click **Jobs** in the sidebar
2. View all running and completed operations
3. See detailed logs for each job
4. Retry failed operations

### Real-time Updates
- Watch for notifications in the top-right
- See live progress bars during operations
- Get instant feedback on success/failure

## Common Tasks Quick Reference

### Create a Single Group
```javascript
// Via UI
Groups → Create Group → Fill form → Submit

// Via CSV
name,path,description,visibility
My Group,my-group,Description here,private
```

### Create Multiple Projects
```javascript
// CSV Format
name,group_id,description,visibility,issues_enabled,wiki_enabled
project-1,123,First project,private,true,true
project-2,123,Second project,private,true,false
project-3,456,Third project,internal,true,true
```

### Move Projects Between Groups
1. Go to Projects view
2. Drag project to new group
3. Confirm the move

### Export Group Structure
1. Select a group
2. Click **Export** button
3. Choose format (CSV/JSON)
4. Download backup

## Tips for Success

### 1. Start Small
- Test with a few items first
- Verify the results
- Then scale up to hundreds

### 2. Use Templates
- Download example CSVs from the UI
- Modify them for your needs
- Keep templates for repeated tasks

### 3. Monitor Operations
- Always check the Jobs page
- Review logs for any failures
- Use the retry feature if needed

### 4. Backup First
- Export existing structure before major changes
- Keep CSV backups of your operations
- Document your bulk operations

## Troubleshooting Quick Fixes

### Can't Login?
- Verify your PAT has correct scopes
- Check GitLab URL (include https://)
- Ensure backend server is running

### Import Fails?
- Check CSV format matches exactly
- Verify group/project IDs exist
- Look for detailed errors in Jobs page

### Slow Performance?
- Reduce batch size to 50 items
- Check network connection
- Monitor server resources

## What's Next?

Now that you've completed the quick start:

1. **Deep Dive into Features**
   - Read about [Group Management](../features/groups.md)
   - Explore [Project Management](../features/projects.md)
   - Master [Bulk Operations](../features/bulk-operations.md)

2. **Understand the Architecture**
   - Review [System Overview](../architecture/overview.md)
   - Learn about [Security](../architecture/security.md)

3. **Set Up for Production**
   - Follow [Deployment Guide](../deployment/manual.md)
   - Configure [Monitoring](../maintenance/monitoring.md)

## Getting Help

- 📖 Check the [full documentation](../README.md)
- 🐛 Report issues on [GitHub](https://github.com/your-org/gitlab-bulk-manager/issues)
- 💬 Join our community discussions

Congratulations! You're now ready to manage GitLab at scale! 🎉