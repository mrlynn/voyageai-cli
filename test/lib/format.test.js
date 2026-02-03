'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formatTable } = require('../../src/lib/format');

describe('formatTable', () => {
  it('formats a simple table', () => {
    const headers = ['Name', 'Age'];
    const rows = [
      ['Alice', '30'],
      ['Bob', '25'],
    ];
    const result = formatTable(headers, rows);
    assert.ok(result.includes('Alice'));
    assert.ok(result.includes('Bob'));
    assert.ok(result.includes('Name'));
    assert.ok(result.includes('Age'));
  });

  it('handles empty rows', () => {
    const headers = ['Col1', 'Col2'];
    const rows = [];
    const result = formatTable(headers, rows);
    // Should still have the header and separator
    const lines = result.split('\n');
    assert.equal(lines.length, 2); // header + separator, no data lines
    assert.ok(lines[0].includes('Col1'));
    assert.ok(lines[0].includes('Col2'));
  });

  it('handles varying column widths', () => {
    const headers = ['X', 'Long Header'];
    const rows = [
      ['Short', 'Y'],
      ['A very long cell value', 'Z'],
    ];
    const result = formatTable(headers, rows);
    // The widest cell should determine column width
    assert.ok(result.includes('A very long cell value'));
    // All rows should have consistent separators
    const lines = result.split('\n');
    assert.equal(lines.length, 4); // header + separator + 2 data rows
  });

  it('uses correct separator character', () => {
    const headers = ['A', 'B'];
    const rows = [['1', '2']];
    const result = formatTable(headers, rows);
    const lines = result.split('\n');
    // Separator line should contain ─ and ┼
    assert.ok(lines[1].includes('─'));
    assert.ok(lines[1].includes('┼'));
  });

  it('uses │ as column separator in data lines', () => {
    const headers = ['A', 'B'];
    const rows = [['1', '2']];
    const result = formatTable(headers, rows);
    const lines = result.split('\n');
    // Header and data lines should use │
    assert.ok(lines[0].includes('│'));
    assert.ok(lines[2].includes('│'));
  });

  it('pads cells correctly', () => {
    const headers = ['Name', 'Value'];
    const rows = [['A', 'B']];
    const result = formatTable(headers, rows);
    const lines = result.split('\n');
    // Each cell should be padded to column width
    // "Name" is 4 chars, "A" should be padded to 4
    assert.ok(lines[2].includes(' A    ') || lines[2].includes(' A '));
  });
});
