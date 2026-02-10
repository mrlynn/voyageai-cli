'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createZip } = require('../../src/lib/zip');

describe('zip', () => {
  it('creates a valid ZIP buffer', () => {
    const files = [
      { name: 'test.txt', content: 'Hello, World!' },
      { name: 'folder/nested.txt', content: 'Nested content' },
    ];
    
    const zip = createZip(files);
    
    // ZIP files start with PK\x03\x04
    assert.equal(zip[0], 0x50); // P
    assert.equal(zip[1], 0x4b); // K
    assert.equal(zip[2], 0x03);
    assert.equal(zip[3], 0x04);
  });

  it('handles empty files array', () => {
    const zip = createZip([]);
    
    // Should still be a valid ZIP (just end of central directory)
    assert.ok(zip.length > 0);
    // EOCD signature should be present
    const eocdSig = zip.readUInt32LE(zip.length - 22);
    assert.equal(eocdSig, 0x06054b50);
  });

  it('includes all files in the ZIP', () => {
    const files = [
      { name: 'a.txt', content: 'A' },
      { name: 'b.txt', content: 'B' },
      { name: 'c.txt', content: 'C' },
    ];
    
    const zip = createZip(files);
    
    // Check file count in EOCD (offset -22 from end, +8 for entry count)
    const entryCount = zip.readUInt16LE(zip.length - 22 + 8);
    assert.equal(entryCount, 3);
  });

  it('preserves file content', () => {
    const content = 'Test content with special chars: éàü 日本語';
    const files = [{ name: 'test.txt', content }];
    
    const zip = createZip(files);
    
    // The content should appear in the ZIP (uncompressed store mode)
    const zipStr = zip.toString('utf8');
    assert.ok(zipStr.includes(content));
  });
});
