module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/src/__tests__/helpers/jest-setup.js'],
  globalSetup: '<rootDir>/src/__tests__/helpers/global-setup.js',
  globalTeardown: '<rootDir>/src/__tests__/helpers/global-teardown.js',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  maxWorkers: 1
};
