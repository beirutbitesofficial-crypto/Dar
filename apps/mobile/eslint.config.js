// Expo's flat ESLint preset (includes React, React Hooks and import rules).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'dist-web/*', 'dist-native/*', '.expo/*'] },
]);
