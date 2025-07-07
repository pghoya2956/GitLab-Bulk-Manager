export default {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).{ts,tsx}',
    '**/?(*.)+(spec|test).{ts,tsx}'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'setupTests.ts',
    'test-utils.tsx'
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        module: 'commonjs',
      },
      diagnostics: {
        ignoreCodes: [1343]
      },
      astTransformers: {
        before: [{
          path: 'ts-jest-mock-import-meta',
          options: {
            metaObjectReplacement: {
              env: {
                VITE_API_URL: 'http://localhost:4000',
                VITE_WS_URL: 'ws://localhost:4000',
                MODE: 'test',
                DEV: false,
                PROD: false,
                SSR: false
              }
            }
          }
        }]
      }
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/__tests__/fileMock.js',
  },
  globals: {
    'import.meta': {
      env: {
        VITE_API_URL: 'http://localhost:4000',
        VITE_WS_URL: 'ws://localhost:4000',
        MODE: 'test',
        DEV: false,
        PROD: false,
        SSR: false
      }
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setupTests.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-gfm|rehype-highlight|vfile|unist-|unified|bail|is-plain-obj|trough|remark-|mdast-|micromark|decode-named-character-reference|character-entities|property-information|hast-|space-separated-tokens|comma-separated-tokens|react-syntax-highlighter|refractor|hastscript|@types/hast|parse-entities|stringify-entities))'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 1,
      lines: 1,
      statements: 1,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
};