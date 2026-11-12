/**
 * Jest configuration.
 *
 * Без этого файла jest по умолчанию использует babel-jest, который не парсит
 * TypeScript, и все .ts-сьюты падают с "Test suite failed to run".
 *
 * - ts-jest: компиляция .ts тестов (зависимость уже в package.json)
 * - isolatedModules: transpile-only, без полного type-check в тестах
 *   (типизацию проверяет отдельный `npm run build` / `tsc --noEmit`)
 * - testMatch только *.test.ts: не подхватывает src/__tests__/setup.ts
 * - roots = src: не подхватывает скомпилированные копии из dist/
 * - testEnvironment по умолчанию node; CarouselRuntime.test.ts сам
 *   объявляет `@jest-environment jsdom` через docblock.
 *
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
  clearMocks: true,
}
