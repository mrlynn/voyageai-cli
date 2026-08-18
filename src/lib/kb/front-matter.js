'use strict';

/**
 * Parse simple YAML front matter delimited by --- lines (same rules as scripts/generate-kb-manifest.js).
 * @param {string} content
 * @param {string} filePath - for error messages
 * @returns {{ meta: Record<string, string>, body: string }}
 */
function parseFrontMatter(content, filePath) {
  const meta = {};
  const lines = content.split('\n');

  if (lines[0] && lines[0].trim() !== '---') {
    return { meta, body: content };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      endIndex = i;
      break;
    }

    if (line.trim() === '') continue;

    const match = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (!match) {
      if (line.includes(':')) {
        throw new Error(`Malformed YAML front matter in ${filePath} at line ${i + 1}: "${line.trim()}"`);
      }
      continue;
    }

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    meta[match[1]] = value;
  }

  if (endIndex === -1) {
    return { meta: {}, body: content };
  }

  const body = lines.slice(endIndex + 1).join('\n');
  return { meta, body };
}

module.exports = { parseFrontMatter };
