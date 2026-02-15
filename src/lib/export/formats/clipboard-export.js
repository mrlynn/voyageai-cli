'use strict';

const { execSync } = require('child_process');
const os = require('os');

/**
 * Copy text content to the system clipboard.
 * @param {string} content - Text to copy
 * @returns {boolean} success
 */
function copyToClipboard(content) {
  const platform = os.platform();
  try {
    if (platform === 'darwin') {
      execSync('pbcopy', { input: content, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (platform === 'linux') {
      execSync('xclip -selection clipboard', { input: content, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (platform === 'win32') {
      execSync('clip', { input: content, stdio: ['pipe', 'ignore', 'ignore'] });
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

module.exports = { copyToClipboard };
