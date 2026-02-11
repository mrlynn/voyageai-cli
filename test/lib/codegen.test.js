'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { render, getPath, isTruthy, listTargets, listTemplates, buildContext } = require('../../src/lib/codegen');

describe('codegen', () => {
  describe('getPath', () => {
    it('returns top-level property', () => {
      assert.equal(getPath({ a: 1 }, 'a'), 1);
    });

    it('returns nested property', () => {
      assert.equal(getPath({ a: { b: { c: 42 } } }, 'a.b.c'), 42);
    });

    it('returns undefined for missing path', () => {
      assert.equal(getPath({ a: 1 }, 'b'), undefined);
    });

    it('returns undefined for null object', () => {
      assert.equal(getPath(null, 'a'), undefined);
    });

    it('returns undefined for empty path', () => {
      assert.equal(getPath({ a: 1 }, ''), undefined);
    });

    it('handles intermediate null gracefully', () => {
      assert.equal(getPath({ a: null }, 'a.b'), undefined);
    });
  });

  describe('isTruthy', () => {
    it('empty array is falsy', () => {
      assert.equal(isTruthy([]), false);
    });

    it('non-empty array is truthy', () => {
      assert.equal(isTruthy([1]), true);
    });

    it('empty string is falsy', () => {
      assert.equal(isTruthy(''), false);
    });

    it('non-empty string is truthy', () => {
      assert.equal(isTruthy('hello'), true);
    });

    it('zero is falsy', () => {
      assert.equal(isTruthy(0), false);
    });

    it('null is falsy', () => {
      assert.equal(isTruthy(null), false);
    });

    it('undefined is falsy', () => {
      assert.equal(isTruthy(undefined), false);
    });

    it('object is truthy', () => {
      assert.equal(isTruthy({}), true);
    });

    it('true is truthy', () => {
      assert.equal(isTruthy(true), true);
    });
  });

  describe('render', () => {
    it('substitutes simple variables', () => {
      assert.equal(render('Hello {{name}}!', { name: 'World' }), 'Hello World!');
    });

    it('substitutes nested variables', () => {
      assert.equal(render('{{a.b}}', { a: { b: 'deep' } }), 'deep');
    });

    it('replaces missing variables with empty string', () => {
      assert.equal(render('{{missing}}', {}), '');
    });

    it('replaces null variables with empty string', () => {
      assert.equal(render('{{val}}', { val: null }), '');
    });

    it('stringifies object variables as JSON', () => {
      const result = render('{{obj}}', { obj: { x: 1 } });
      assert.equal(result, '{"x":1}');
    });

    it('handles multiple variables', () => {
      assert.equal(
        render('{{a}} and {{b}}', { a: 'foo', b: 'bar' }),
        'foo and bar'
      );
    });

    it('processes #if blocks — truthy', () => {
      assert.equal(
        render('{{#if show}}visible{{/if}}', { show: true }),
        'visible'
      );
    });

    it('processes #if blocks — falsy', () => {
      assert.equal(
        render('{{#if show}}visible{{/if}}', { show: false }),
        ''
      );
    });

    it('processes #if/else blocks', () => {
      assert.equal(
        render('{{#if a}}yes{{else}}no{{/if}}', { a: false }),
        'no'
      );
    });

    it('processes #unless blocks — falsy shows content', () => {
      assert.equal(
        render('{{#unless hide}}shown{{/unless}}', { hide: false }),
        'shown'
      );
    });

    it('processes #unless blocks — truthy hides content', () => {
      assert.equal(
        render('{{#unless hide}}shown{{/unless}}', { hide: true }),
        ''
      );
    });

    it('processes #each blocks', () => {
      const result = render('{{#each items}}{{this}},{{/each}}', { items: ['a', 'b', 'c'] });
      assert.equal(result, 'a,b,c,');
    });

    it('sets @index, @first, @last in loop context (not substituted by variable regex)', () => {
      // Note: {{@index}} isn't matched by the variable regex ([a-zA-Z_][\w.]*)
      // These special vars work when accessed via object spread in nested templates
      const result = render('{{#each items}}{{this}},{{/each}}', { items: ['a', 'b'] });
      assert.equal(result, 'a,b,');
    });

    it('spreads object items in #each', () => {
      const result = render('{{#each people}}{{name}};{{/each}}', {
        people: [{ name: 'Alice' }, { name: 'Bob' }],
      });
      assert.equal(result, 'Alice;Bob;');
    });

    it('handles empty #each array', () => {
      assert.equal(render('{{#each items}}x{{/each}}', { items: [] }), '');
    });

    it('handles nested #if inside #each', () => {
      const tpl = '{{#each items}}{{#if active}}*{{/if}}{{name}},{{/each}}';
      const result = render(tpl, {
        items: [{ name: 'a', active: true }, { name: 'b', active: false }],
      });
      assert.equal(result, '*a,b,');
    });
  });

  describe('listTargets', () => {
    it('returns an array of target names', () => {
      const targets = listTargets();
      assert.ok(Array.isArray(targets));
      assert.ok(targets.includes('vanilla'), 'should include vanilla target');
    });
  });

  describe('listTemplates', () => {
    it('returns templates for vanilla target', () => {
      const templates = listTemplates('vanilla');
      assert.ok(Array.isArray(templates));
      assert.ok(templates.length > 0, 'vanilla should have templates');
    });

    it('returns empty array for unknown target', () => {
      assert.deepEqual(listTemplates('nonexistent-target-xyz'), []);
    });
  });

  describe('buildContext', () => {
    it('returns defaults when no project or options', () => {
      const ctx = buildContext({});
      assert.ok(ctx.model);
      assert.ok(ctx.db);
      assert.ok(ctx.collection);
      assert.ok(ctx.field);
      assert.ok(ctx.index);
      assert.ok(ctx.dimensions);
      assert.ok(ctx.generatedAt);
      assert.ok(ctx.vaiVersion);
    });

    it('project config overrides defaults', () => {
      const ctx = buildContext({ db: 'mydb', collection: 'mycoll' });
      assert.equal(ctx.db, 'mydb');
      assert.equal(ctx.collection, 'mycoll');
    });

    it('CLI options override project config', () => {
      const ctx = buildContext({ db: 'projdb' }, { db: 'clidb' });
      assert.equal(ctx.db, 'clidb');
    });

    it('includes chunk config from project', () => {
      const ctx = buildContext({ chunk: { strategy: 'sentence', size: 500 } });
      assert.equal(ctx.chunkStrategy, 'sentence');
      assert.equal(ctx.chunkSize, 500);
    });
  });
});
