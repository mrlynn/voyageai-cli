'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  mergeKbVectorFilter,
  getStarterQuestionsForSession,
  KB_VECTOR_FILTER,
} = require('../../src/lib/kb/chat-resolve');

test('mergeKbVectorFilter adds tag filter', () => {
  const m = mergeKbVectorFilter();
  assert.deepStrictEqual(m, KB_VECTOR_FILTER);
});

test('mergeKbVectorFilter combines with user filter', () => {
  const m = mergeKbVectorFilter({ foo: 'bar' });
  assert.ok(m.$and);
  assert.strictEqual(m.$and.length, 2);
  assert.deepStrictEqual(m.$and[0], KB_VECTOR_FILTER);
  assert.deepStrictEqual(m.$and[1], { foo: 'bar' });
});

test('getStarterQuestionsForSession returns 3 items', () => {
  const q = getStarterQuestionsForSession('abc');
  assert.strictEqual(q.length, 3);
});
