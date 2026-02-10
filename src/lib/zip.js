'use strict';

/**
 * Minimal ZIP file creator for text files.
 * Creates uncompressed (STORE) ZIP archives - perfect for scaffolded code.
 * No external dependencies.
 */

/**
 * Create a ZIP file from an array of file entries.
 * @param {Array<{name: string, content: string}>} files - Files to include
 * @returns {Buffer} - ZIP file as a Buffer
 */
function createZip(files) {
  const entries = [];
  let offset = 0;

  // Process each file
  for (const file of files) {
    const content = Buffer.from(file.content, 'utf8');
    const name = Buffer.from(file.name, 'utf8');
    const now = new Date();
    const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
    const crc = crc32(content);

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + name.length);
    localHeader.writeUInt32LE(0x04034b50, 0);      // Local file header signature
    localHeader.writeUInt16LE(20, 4);              // Version needed (2.0)
    localHeader.writeUInt16LE(0, 6);               // General purpose bit flag
    localHeader.writeUInt16LE(0, 8);               // Compression method (0 = store)
    localHeader.writeUInt16LE(dosTime, 10);        // Last mod time
    localHeader.writeUInt16LE(dosDate, 12);        // Last mod date
    localHeader.writeUInt32LE(crc, 14);            // CRC-32
    localHeader.writeUInt32LE(content.length, 18); // Compressed size
    localHeader.writeUInt32LE(content.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(name.length, 26);    // Filename length
    localHeader.writeUInt16LE(0, 28);              // Extra field length
    name.copy(localHeader, 30);

    entries.push({
      name,
      content,
      crc,
      dosTime,
      dosDate,
      headerOffset: offset,
      localHeader,
    });

    offset += localHeader.length + content.length;
  }

  // Build central directory
  const centralDir = [];
  for (const entry of entries) {
    const cdHeader = Buffer.alloc(46 + entry.name.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);                   // Central directory signature
    cdHeader.writeUInt16LE(20, 4);                           // Version made by
    cdHeader.writeUInt16LE(20, 6);                           // Version needed
    cdHeader.writeUInt16LE(0, 8);                            // General purpose bit flag
    cdHeader.writeUInt16LE(0, 10);                           // Compression method
    cdHeader.writeUInt16LE(entry.dosTime, 12);               // Last mod time
    cdHeader.writeUInt16LE(entry.dosDate, 14);               // Last mod date
    cdHeader.writeUInt32LE(entry.crc, 16);                   // CRC-32
    cdHeader.writeUInt32LE(entry.content.length, 20);        // Compressed size
    cdHeader.writeUInt32LE(entry.content.length, 24);        // Uncompressed size
    cdHeader.writeUInt16LE(entry.name.length, 28);           // Filename length
    cdHeader.writeUInt16LE(0, 30);                           // Extra field length
    cdHeader.writeUInt16LE(0, 32);                           // Comment length
    cdHeader.writeUInt16LE(0, 34);                           // Disk number start
    cdHeader.writeUInt16LE(0, 36);                           // Internal file attributes
    cdHeader.writeUInt32LE(0, 38);                           // External file attributes
    cdHeader.writeUInt32LE(entry.headerOffset, 42);          // Relative offset of local header
    entry.name.copy(cdHeader, 46);
    centralDir.push(cdHeader);
  }

  const centralDirBuffer = Buffer.concat(centralDir);
  const centralDirOffset = offset;
  const centralDirSize = centralDirBuffer.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);               // EOCD signature
  eocd.writeUInt16LE(0, 4);                        // Disk number
  eocd.writeUInt16LE(0, 6);                        // Disk with central directory
  eocd.writeUInt16LE(entries.length, 8);           // Entries on this disk
  eocd.writeUInt16LE(entries.length, 10);          // Total entries
  eocd.writeUInt32LE(centralDirSize, 12);          // Central directory size
  eocd.writeUInt32LE(centralDirOffset, 16);        // Central directory offset
  eocd.writeUInt16LE(0, 20);                       // Comment length

  // Combine all parts
  const parts = [];
  for (const entry of entries) {
    parts.push(entry.localHeader);
    parts.push(entry.content);
  }
  parts.push(centralDirBuffer);
  parts.push(eocd);

  return Buffer.concat(parts);
}

/**
 * CRC-32 calculation (IEEE polynomial).
 */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = crcTable[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

module.exports = { createZip };
