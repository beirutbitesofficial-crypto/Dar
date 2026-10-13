/**
 * End-to-end tests run the real Nest app against TEST_DATABASE_URL.
 * The database is reset (migrations applied) and base data seeded once per run.
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: false }] },
  moduleNameMapper: { '^@dar/shared$': '<rootDir>/../../packages/shared/src/index.ts' },
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/e2e/global-setup.ts',
  testTimeout: 60_000,
};
