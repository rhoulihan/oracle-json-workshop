import js from '@eslint/js';
import nodePlugin from 'eslint-plugin-n';

export default [
  js.configs.recommended,
  {
    plugins: { n: nodePlugin },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'n/no-process-exit': 'error',
    },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'public/js/vendor/'],
  },
];
