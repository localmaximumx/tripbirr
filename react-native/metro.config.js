const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [workspaceRoot],
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
