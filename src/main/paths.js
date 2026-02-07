const fs = require('fs');
const path = require('path');

function getAssetPath(filename) {
  return path.join(__dirname, '..', '..', 'assets', filename);
}

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getAssetPath,
  fileExists,
};
