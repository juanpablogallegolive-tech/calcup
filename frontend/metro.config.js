// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Disable file watching to avoid ENOSPC errors
config.watchFolders = [];
// Metro 0.82+ no longer accepts the watcher.watchman.enabled option.
// Leaving the watcher configuration out avoids the Expo Doctor warning.

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
