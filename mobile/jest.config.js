/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testTimeout: 15000,
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/']
}
