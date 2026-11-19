// Lint settings: the recommended rules, plus checks that every name a module uses is defined or imported.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'legacy/', 'source/', 'node_modules/', 'test-results/', 'playwright-report/', 'scripts/split/legacy-main.phase1.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // The port keeps the prototype's code style; these rules would flag patterns it uses on purpose.
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Style findings in the prototype's own code. Kept as warnings: fixing them is not part of a pure port.
      'prefer-const': 'warn', 'no-useless-escape': 'warn', 'no-self-assign': 'warn', '@typescript-eslint/no-unused-vars': 'warn',
      // Catches a missing import (a name that is not defined anywhere).
      'no-undef': 'error',
    },
  },
  { files: ['scripts/**/*.mjs', 'tests/**/*.ts', '*.config.*'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
);
