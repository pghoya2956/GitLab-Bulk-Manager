# Getting Started

## Prerequisites

- Node.js 16+ and npm
- GitLab instance with API access
- GitLab Personal Access Token with appropriate scopes

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gitlab-bulk-manager/frontend
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
   ```
   VITE_API_URL=http://localhost:5000
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## Backend Setup

The frontend requires the backend API server to be running:

1. **Configure GitLab credentials**
   ```bash
   cd ../Scripts
   cp config/gitlab.env.example config/gitlab.env
   ```
   
   Edit `config/gitlab.env`:
   ```bash
   GITLAB_URL="https://gitlab.example.com"
   GITLAB_TOKEN="your-personal-access-token"
   ```

2. **Start the API server**
   ```bash
   cd ../backend
   npm install
   npm start
   ```

## First Login

1. Navigate to `http://localhost:3000`
2. You'll be redirected to the login page
3. Enter your GitLab credentials:
   - GitLab URL: Your GitLab instance URL
   - Access Token: Your personal access token

The credentials are stored in localStorage and used for all API requests.

## Configuration Files

### Frontend Configuration

- `.env` - Environment variables for the frontend
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration

### Backend Configuration

- `Scripts/config/gitlab.env` - GitLab API credentials
- `Scripts/config/*.txt` - Input files for bulk operations

## Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/         # Page components
│   ├── services/      # API service layer
│   ├── store/         # Redux store and slices
│   ├── hooks/         # Custom React hooks
│   └── utils/         # Utility functions
├── public/            # Static assets
└── docs/             # Documentation
```

## GitLab Personal Access Token

To use this application, you need a GitLab Personal Access Token with the following scopes:

- `api` - Full API access
- `read_user` - Read user information
- `read_api` - Read access to the API (if using read-only features)

### Creating a Personal Access Token

1. Log in to your GitLab instance
2. Go to User Settings → Access Tokens
3. Create a new token with the required scopes
4. Copy the token immediately (it won't be shown again)

## Common Issues

### Authentication Failed
- Verify your GitLab URL is correct (include `https://`)
- Check that your token hasn't expired
- Ensure the token has the required scopes

### Cannot Connect to Backend
- Ensure the backend server is running on port 5000
- Check that VITE_API_URL in `.env` is correct
- Look for CORS errors in the browser console

### Missing Dependencies
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

1. **Explore the Dashboard**: Get an overview of your GitLab instance
2. **Try Group Management**: Create and organize groups
3. **Import Data**: Use bulk operations to import from CSV
4. **Check Permissions**: View your access levels with Permission Tree

For more detailed information, see:
- [Architecture Overview](./architecture.md)
- [Development Guide](./development.md)
- [Features Documentation](./features.md)