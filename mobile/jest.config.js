/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testTimeout: 15000,
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/']
}
