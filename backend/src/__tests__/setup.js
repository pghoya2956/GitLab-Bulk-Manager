// Test setup file

// Set test environment
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.PORT = '4001';

// Global test timeout
global.jest = {
  setTimeout: (_timeout) => {
    // Jest timeout handler
  },
};