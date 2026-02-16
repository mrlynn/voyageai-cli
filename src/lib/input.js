'use strict';

const fs = require('fs');
const path = require('path');

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

/**
 * MIME type mappings for supported image formats.
 */
const IMAGE_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
};

/**
 * MIME type mappings for supported video formats.
 */
const VIDEO_MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
};

/**
 * Check if a file path is a supported image format.
 * @param {string} filePath
 * @returns {boolean}
 */
function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext in IMAGE_MIME_TYPES;
}

/**
 * Check if a file path is a supported video format.
 * @param {string} filePath
 * @returns {boolean}
 */
function isVideoFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext in VIDEO_MIME_TYPES;
}

/**
 * Read a media file (image or video) and return it as a base64 data URL.
 * @param {string} filePath - Path to the media file
 * @returns {{ base64DataUrl: string, mimeType: string, sizeBytes: number }}
 */
function readMediaAsBase64(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = IMAGE_MIME_TYPES[ext] || VIDEO_MIME_TYPES[ext];

  if (!mimeType) {
    const supported = [
      ...Object.keys(IMAGE_MIME_TYPES),
      ...Object.keys(VIDEO_MIME_TYPES),
    ].join(', ');
    throw new Error(
      `Unsupported media format "${ext}". Supported: ${supported}`
    );
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const base64DataUrl = `data:${mimeType};base64,${base64}`;

  return {
    base64DataUrl,
    mimeType,
    sizeBytes: buffer.length,
  };
}

module.exports = {
  resolveTextInput,
  readMediaAsBase64,
  isImageFile,
  isVideoFile,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
};
