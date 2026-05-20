module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    // A3: запретить console.* в продакшен-коде; использовать `logger` из services/Logger.
    // Исключения см. в `overrides` ниже (scripts, сам Logger, тесты).
    'no-console': 'warn',
  },
  overrides: [
    {
      // Разовые CLI-скрипты: console допустим.
      files: ['src/scripts/**/*.ts'],
      rules: { 'no-console': 'off' },
    },
    {
      // Сам Logger использует console внутри (это его работа).
      files: ['src/services/Logger.ts'],
      rules: { 'no-console': 'off' },
    },
    {
      // Тесты: можно console для отладки.
      files: ['src/**/__tests__/**/*.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
  ignorePatterns: ['dist', 'node_modules'],
}
