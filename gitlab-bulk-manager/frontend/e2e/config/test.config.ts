export const TEST_CONFIG = {
  // GitLab Test Configuration
  GITLAB_URL: process.env.TEST_GITLAB_URL || 'https://gitlab.com',
  GITLAB_TOKEN: process.env.TEST_GITLAB_TOKEN || '',
  TARGET_GROUP_ID: 107423238, // 제공된 그룹 ID
  
  // Test User Credentials
  TEST_USERS: {
    admin: {
      username: process.env.TEST_ADMIN_USERNAME || 'admin@test.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123!',
      role: 'admin',
    },
    manager: {
      username: process.env.TEST_MANAGER_USERNAME || 'manager@test.com',
      password: process.env.TEST_MANAGER_PASSWORD || 'manager123!',
      role: 'manager',
    },
    developer: {
      username: process.env.TEST_DEVELOPER_USERNAME || 'developer@test.com',
      password: process.env.TEST_DEVELOPER_PASSWORD || 'developer123!',
      role: 'developer',
    },
    viewer: {
      username: process.env.TEST_VIEWER_USERNAME || 'viewer@test.com',
      password: process.env.TEST_VIEWER_PASSWORD || 'viewer123!',
      role: 'viewer',
    },
  },
  
  // Test Data
  TEST_DATA: {
    groupPrefix: 'e2e-test-group',
    projectPrefix: 'e2e-test-project',
    backupPrefix: 'e2e-test-backup',
  },
  
  // Timeouts
  TIMEOUTS: {
    short: 5000,
    medium: 15000,
    long: 30000,
    extraLong: 60000,
  },
  
  // API Endpoints
  API_ENDPOINTS: {
    auth: '/api/auth',
    groups: '/api/groups',
    projects: '/api/projects',
    backups: '/api/backups',
    monitoring: '/api/monitoring',
  },
};