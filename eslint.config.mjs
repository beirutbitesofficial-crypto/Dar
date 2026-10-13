// Root ESLint flat config for the API and shared packages.
// The admin (Next.js) and mobile (Expo) apps can extend their framework presets.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/.expo/**', 'apps/mobile/ios/**', 'apps/mobile/android/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/api/prisma/seed.ts', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
