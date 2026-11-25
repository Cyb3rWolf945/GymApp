import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.expo/**', '**/.next/**', '**/.web/**', '**/test-results/**', '**/playwright-report/**', '**/next-env.d.ts', '**/node_modules/**'] },
  js.configs.recommended,
  // Node scripts (the E2E static server) use Node globals.
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly', URL: 'readonly', console: 'readonly' } } },
  ...tseslint.configs.recommended,
);
