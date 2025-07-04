# GitLab Bulk Manager

A full-stack web application for managing GitLab groups and projects in bulk with drag-and-drop functionality.

## 📚 Documentation

For comprehensive documentation, please see the [docs directory](./docs/README.md):
- [Getting Started Guide](./docs/getting-started/quick-start.md)
- [Architecture Overview](./docs/architecture/overview.md)
- [API Documentation](./docs/api/README.md)
- [Development Guide](./docs/development/setup.md)

## 🏗️ Architecture

This application consists of:
- **Frontend**: React-based SPA for the user interface
- **Backend**: Node.js/Express proxy server that handles GitLab API communication
- **Security**: Token management handled server-side with secure session cookies

## ✨ Features

- **Group Management**
  - Create, update, and delete groups
  - Drag-and-drop groups to reorganize hierarchy
  - Create subgroups with visual hierarchy

- **Project Management**
  - Create projects in any group
  - Drag-and-drop projects between groups
  - Visual organization by group

- **Bulk Operations**
  - Import groups from CSV files
  - Import projects from CSV files
  - Import members from CSV files
  - Real-time progress tracking

- **Job Monitoring**
  - Real-time job status updates
  - Progress tracking with visual indicators
  - Detailed job logs and error reporting

- **Error Handling**
  - Comprehensive error messages
  - Global error boundary
  - Toast notifications for user feedback

## 📋 Prerequisites

- Node.js 16+ and npm
- GitLab account with API access
- GitLab Personal Access Token with the following scopes:
  - `api`
  - `read_api`
  - `read_repository`
  - `write_repository`

## 🚀 Quick Start

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gitlab-bulk-manager
```

2. Install dependencies:
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

3. Configure the backend:
```bash
cd ../backend
cp .env.example .env
# Edit .env with your settings
```

### Running the Application

```bash
# Quick start both servers
./start.sh

# Or run separately:
# Terminal 1 - Backend (port 4000)
cd backend && npm run dev

# Terminal 2 - Frontend (port 3000)
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and login with your GitLab URL and Personal Access Token.

📖 For detailed setup instructions, see our [Installation Guide](./docs/getting-started/installation.md)

## 📄 CSV File Formats

### Groups CSV Format
```
# Format: name|path|parent_id|description|visibility
Frontend Team|frontend||Frontend development team|private
Backend Team|backend||Backend development team|internal
```

### Projects CSV Format
```
# Format: name|group_id|description|visibility|issues_enabled|wiki_enabled|default_branch
web-main|110|Main website|private|true|true|main
api-gateway|120|API Gateway|internal|true|false|main
```

### Members CSV Format
```
# Format: email|group_path|access_level|expiry_date
user@example.com|dev-division/frontend|developer|
lead@example.com|dev-division/frontend|maintainer|2024-12-31
```

Access levels: `guest`, `reporter`, `developer`, `maintainer`, `owner` (or numeric: 10, 20, 30, 40, 50)

## 🏭 Building for Production

```bash
cd frontend
npm run build
```

The built files will be in the `frontend/dist` directory.

📖 See our [Deployment Guide](./docs/deployment/manual.md) for production deployment instructions.

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **UI**: Material-UI (MUI)
- **State Management**: Redux Toolkit
- **Build Tool**: Vite
- **Routing**: React Router v6

### Backend
- **Runtime**: Node.js
- **Framework**: Express
- **Session Management**: express-session
- **WebSocket**: Socket.io
- **Security**: Helmet, CORS, rate limiting

## 🔒 Security

- GitLab tokens are securely stored server-side in encrypted sessions
- Frontend authentication uses httpOnly cookies
- All API calls are proxied through the backend
- CORS protection enabled
- Rate limiting implemented for API endpoints
- Automatic session expiration after 24 hours

📖 Read more in our [Security Architecture](./docs/architecture/security.md) documentation.

## 🧪 Testing

```bash
# Frontend unit tests
cd frontend && npm test

# E2E tests with Playwright
cd frontend && npx playwright test

# Run comprehensive test suite
cd frontend && ./e2e/run-all-tests.sh
```

📖 See our [Testing Guide](./docs/development/testing.md) for more information.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Getting Help

- 📖 Check the [documentation](./docs/README.md)
- 🐛 Report bugs in [GitHub Issues](https://github.com/your-org/gitlab-bulk-manager/issues)
- 💬 Ask questions in [Discussions](https://github.com/your-org/gitlab-bulk-manager/discussions)

---

Made with ❤️ for the GitLab community