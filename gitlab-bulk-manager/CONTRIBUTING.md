# Contributing to GitLab Bulk Manager

Thank you for your interest in contributing to GitLab Bulk Manager! This document provides guidelines and instructions for contributing.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## 🚀 Getting Started

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/gitlab-bulk-manager.git
   cd gitlab-bulk-manager
   ```

2. **Set Up Development Environment**
   ```bash
   # Install dependencies
   cd backend && npm install
   cd ../frontend && npm install
   
   # Copy environment configuration
   cd ../backend
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

## 📝 Development Guidelines

### Code Style

#### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Creates a new GitLab group
 * @param data - Group creation parameters
 * @returns Promise resolving to the created group
 */
export async function createGroup(data: CreateGroupDto): Promise<Group> {
  // Implementation
}
```

#### React Components
- Use functional components with hooks
- Implement proper TypeScript interfaces for props
- Follow Material-UI theming guidelines
- Keep components small and focused

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary';
  onClick: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ variant, onClick, children }) => {
  // Component implementation
};
```

### Commit Messages

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Build process or auxiliary tool changes

Examples:
```bash
feat(groups): add drag-and-drop support for group reorganization
fix(auth): resolve session timeout issue
docs(api): update authentication endpoint documentation
```

### Testing

#### Writing Tests
- Write tests for all new features
- Maintain or improve code coverage
- Use descriptive test names

```typescript
describe('GroupService', () => {
  describe('createGroup', () => {
    it('should create a group with valid data', async () => {
      // Test implementation
    });
    
    it('should throw error for invalid group name', async () => {
      // Test implementation
    });
  });
});
```

#### Running Tests
```bash
# Frontend tests
cd frontend
npm test
npm run test:coverage

# Backend tests
cd backend
npm test

# E2E tests
cd frontend
npx playwright test
```

## 🔄 Pull Request Process

1. **Before Submitting**
   - Ensure all tests pass
   - Run linters and fix any issues
   - Update documentation if needed
   - Add tests for new functionality

2. **Pull Request Template**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] E2E tests pass
   - [ ] Manual testing completed
   
   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No new warnings generated
   ```

3. **Review Process**
   - PR will be reviewed by maintainers
   - Address feedback promptly
   - Keep PR focused and reasonably sized
   - Be patient and respectful

## 🐛 Reporting Issues

### Bug Reports

Use the bug report template:

```markdown
**Describe the bug**
Clear description of the bug

**To Reproduce**
1. Go to '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen

**Screenshots**
If applicable

**Environment:**
- OS: [e.g. macOS]
- Browser: [e.g. Chrome]
- Version: [e.g. 1.0.0]
```

### Feature Requests

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
Description of the problem

**Describe the solution**
Clear description of desired solution

**Alternatives considered**
Other solutions you've considered

**Additional context**
Any other context or screenshots
```

## 🏗️ Project Structure

Understanding the project structure helps in making contributions:

```
gitlab-bulk-manager/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Route components
│   │   ├── services/     # API services
│   │   └── store/        # Redux store
│   └── e2e/           # E2E tests
├── backend/           # Express server
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── middleware/   # Express middleware
│   └── tests/         # Backend tests
└── docs/              # Documentation
```

## 🔧 Development Tools

### Recommended VS Code Extensions
- ESLint
- Prettier
- TypeScript Vue Plugin
- GitLens
- Jest Runner

### Debugging
```bash
# Frontend debugging
cd frontend
npm run dev
# Open Chrome DevTools

# Backend debugging
cd backend
node --inspect src/index.js
# Use Chrome DevTools or VS Code debugger
```

### Using zen and playwright-mcp
See [CLAUDE.md](./CLAUDE.md) for detailed instructions on using AI-assisted development tools.

## 📚 Resources

- [Project Documentation](./docs/README.md)
- [Architecture Overview](./docs/architecture/overview.md)
- [API Reference](./docs/api/reference.md)
- [React Documentation](https://react.dev/)
- [Material-UI Documentation](https://mui.com/)
- [GitLab API Documentation](https://docs.gitlab.com/ee/api/)

## 🎉 Recognition

Contributors will be recognized in:
- The project README
- Release notes
- Contributors page

## 💬 Getting Help

- Check existing issues and discussions
- Join our community chat (if available)
- Ask questions in GitHub Discussions
- Tag maintainers for urgent issues

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to GitLab Bulk Manager! 🚀