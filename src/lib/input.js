'use strict';

const fs = require('fs');

/**
 * Read text input from argument, --file flag, or stdin.
 * @param {string|undefined} textArg - Text argument from CLI
 * @param {string|undefined} filePath - File path from --file flag
 * @returns {Promise<string[]>} Array of text strings
 */
async function resolveTextInput(textArg, filePath) {
  if (filePath) {
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    return [content];
  }

  if (textArg) {
    return [textArg];
  }

  // Try reading from stdin (piped input)
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8').trim();
    if (!input) {
      console.error('Error: No input provided. Pass text as an argument, use --file, or pipe via stdin.');
      process.exit(1);
    }
    // Split by newlines for bulk embedding
    return input.split('\n').filter(line => line.trim());
  }

  console.error('Error: No input provided. Pass text as an argument, use --file, or pipe via stdin.');
  process.exit(1);
}

module.exports = { resolveTextInput };
