# Frontend Documentation

Comprehensive documentation for the GitLab Bulk Manager frontend application.

## 📚 Documentation Index

### Getting Started
- **[Getting Started Guide](./getting-started.md)** - Installation, setup, and first steps
- **[Development Guide](./development.md)** - Development environment setup and workflow

### Architecture & Design
- **[Architecture Overview](./architecture.md)** - System architecture, patterns, and design decisions
- **[Components Documentation](./components.md)** - Detailed component reference and usage
- **[API Integration](./api-integration.md)** - Backend API communication and service layer

### Features
- **[Features Overview](./features.md)** - Complete feature documentation
- **[Permission Tree](./permission-tree.md)** - User permissions visualization component

### Development & Testing
- **[Testing Guide](./testing.md)** - Unit, integration, and E2E testing strategies
- **[Deployment Guide](./deployment.md)** - Production deployment and DevOps

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── GitLabTree.tsx    # Hierarchical tree view
│   │   ├── PermissionTree.tsx # Permission visualization
│   │   ├── Layout.tsx        # App layout wrapper
│   │   └── bulk/            # Bulk operation components
│   ├── pages/           # Route page components
│   ├── services/        # API service layer
│   ├── store/          # Redux state management
│   │   └── slices/     # Redux slices
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── public/             # Static assets
├── docs/              # This documentation
└── e2e/               # End-to-end tests
```

## 🚀 Key Features

- **GitLab Integration**: Full integration with GitLab API for groups, projects, and members management
- **Bulk Operations**: CSV-based bulk import for groups, projects, and members
- **Permission Management**: Visual permission tree showing user access levels
- **Real-time Updates**: WebSocket integration for job progress tracking
- **Modern UI**: Material-UI based responsive interface

## 🛠️ Technology Stack

- **React 18** with TypeScript
- **Redux Toolkit** for state management
- **Material-UI v5** for UI components
- **Vite** for build tooling
- **React Router v6** for routing
- **Axios** for HTTP requests
- **Socket.io** for WebSocket communication

## 📋 Documentation Status

| Document | Status | Last Updated |
|----------|--------|-------------|
| Getting Started | ⚠️ Incomplete | Needs completion |
| Architecture | ✅ Complete | Current |
| Components | ⚠️ Needs Update | Missing PermissionTree |
| API Integration | ✅ Complete | Current |
| Features | ✅ Complete | Current |
| Development | ✅ Complete | Current |
| Testing | ✅ Complete | Current |
| Deployment | ✅ Complete | Current |
| Permission Tree | ❌ Missing | To be created |

## 🔄 Keeping Documentation Updated

When making changes to the codebase:
1. Update relevant documentation files
2. Add examples for new features
3. Update the status table above
4. Ensure code examples are tested and working

## 📞 Getting Help

If you need help:
1. Check the relevant documentation section
2. Look for examples in the codebase
3. Review the test files for usage patterns
4. Create an issue for documentation improvements