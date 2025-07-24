# Getting Started

## Prerequisites

Before installing GitLab Bulk Manager, ensure you have:

- **Node.js 18+** and npm 9+
- **GitLab instance** (self-hosted or GitLab.com)
- **GitLab Personal Access Token** with appropriate scopes
- **Modern web browser** (Chrome, Firefox, Safari, or Edge)

## Quick Start

### Using the Management Script (Recommended)

The easiest way to get started is using the provided management script:

```bash
# Clone the repository
git clone <repository-url>
cd gitlab-bulk-manager

# Start both frontend and backend
./manage.sh start

# View logs
./manage.sh logs

# Check status
./manage.sh status

# Stop all services
./manage.sh stop
```

The application will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

## Manual Installation

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set:
   ```bash
   PORT=4000
   SESSION_SECRET=your-secret-key-here
   # Optional: Set default GitLab instance
   GITLAB_URL=https://gitlab.com
   ```

4. **Start the backend server**
   ```bash
   npm start
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000`

## First Login

1. **Navigate to the application**
   Open `http://localhost:3000` in your browser

2. **Login with GitLab credentials**
   - **GitLab URL**: Your GitLab instance URL (e.g., `https://gitlab.com`)
   - **Personal Access Token**: Your GitLab PAT (see below for creation)

3. **Verify connection**
   The dashboard should display your GitLab statistics

## Creating a GitLab Personal Access Token

### Required Scopes

Create a token with the following scopes:
- ✅ `api` - Full API access (required)
- ✅ `read_user` - Read user information
- ✅ `read_api` - Read-only API access (optional)

### Token Creation Steps

1. **Log in to GitLab**
2. **Navigate to User Settings**
   - Click your avatar → Preferences → Access Tokens
3. **Create new token**
   - Name: `GitLab Bulk Manager`
   - Expiry date: Set as needed
   - Select required scopes
4. **Copy the token immediately**
   - It won't be shown again!

## Configuration

### Environment Variables

#### Backend (.env)
```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# Session Configuration  
SESSION_SECRET=your-session-secret

# GitLab Defaults (Optional)
GITLAB_URL=https://gitlab.com
GITLAB_TOKEN=your-default-token

# Logging
LOG_LEVEL=info
```

#### Frontend
The frontend automatically connects to the backend on port 4000. No configuration needed for development.

### Production Configuration

For production deployment:

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Set production environment**
   ```bash
   NODE_ENV=production
   ```

3. **Use a process manager**
   ```bash
   npm install -g pm2
   pm2 start backend/src/index.js --name gitlab-bulk-manager
   ```

## Project Structure

```
gitlab-bulk-manager/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server setup
│   │   ├── routes/           # API endpoints
│   │   ├── middleware/       # Auth & error handling
│   │   └── services/         # Business logic
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── services/        # API services
│   │   ├── store/           # Redux store
│   │   └── App.tsx          # Main app component
│   ├── public/              # Static assets
│   └── package.json
├── docs/                    # Documentation
└── manage.sh               # Management script
```

## Common Issues & Solutions

### Connection Refused

**Problem**: Cannot connect to backend
```
Error: Network Error at http://localhost:4000
```

**Solution**: Ensure the backend is running
```bash
./manage.sh status
./manage.sh start
```

### Authentication Failed

**Problem**: Login fails with 401 error

**Solutions**:
1. Verify your GitLab URL includes the protocol (`https://`)
2. Check token has not expired
3. Ensure token has `api` scope
4. Try creating a new token

### CORS Errors

**Problem**: CORS policy blocking requests

**Solution**: The backend should handle CORS. Check:
- Backend is running on port 4000
- Frontend is using the proxy configuration
- No direct GitLab API calls from frontend

### Port Already in Use

**Problem**: Port 3000 or 4000 already in use

**Solution**: 
```bash
# Find process using port
lsof -i :3000
lsof -i :4000

# Kill process
kill -9 <PID>

# Or use different ports
PORT=3001 npm run dev  # Frontend
PORT=4001 npm start    # Backend
```

### Session Expired

**Problem**: Logged out unexpectedly

**Solution**: 
- Sessions expire after inactivity
- Simply log in again
- For longer sessions, configure `SESSION_TIMEOUT` in backend

## Next Steps

Once you're logged in successfully:

1. **Explore the Dashboard**
   - View GitLab statistics
   - Check system health
   - Review recent activities

2. **Navigate Groups & Projects**
   - Use the tree view to explore
   - View your permissions
   - Try drag-and-drop reorganization

3. **Try Bulk Operations**
   - Download sample CSV templates
   - Import a test group
   - Create multiple projects

4. **Review Documentation**
   - Access in-app documentation
   - Learn keyboard shortcuts
   - Watch tutorial videos

## Getting Help

### Resources

- **In-app Documentation**: Click the "Docs" link in the navigation
- **API Reference**: Available at `/api/docs` when backend is running
- **Issue Tracker**: Report bugs on GitLab/GitHub
- **Community Support**: Join our Discord/Slack channel

### Debug Mode

Enable debug logging for troubleshooting:
```bash
# Backend
LOG_LEVEL=debug npm start

# Frontend  
VITE_DEBUG=true npm run dev
```

### Support Checklist

When reporting issues, please include:
- [ ] GitLab version
- [ ] Browser and version
- [ ] Node.js version (`node --version`)
- [ ] Error messages from browser console
- [ ] Backend logs
- [ ] Steps to reproduce

---

**Last Updated**: 2025-07-24