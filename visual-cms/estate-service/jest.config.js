/**
 * Jest configuration for estate-service.
 *
 * ts-jest компилирует .ts тесты (без него jest берёт babel-jest и падает на
 * TypeScript). isolatedModules = transpile-only (типизацию проверяет `tsc`).
 * Тесты — чистые функции (overlay/derive/response-builder), без хендла БД,
 * поэтому setupFilesAfterEnv и открытые соединения не нужны.
 *
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
  clearMocks: true,
}
