// Metro config. Expo SDK 54 detects pnpm/yarn monorepos automatically, so we keep
// Expo's defaults and only make sure the workspace root (packages/shared) is watched.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const workspaceRoot = path.resolve(__dirname, '../..');
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));

module.exports = config;
