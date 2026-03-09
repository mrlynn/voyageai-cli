'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Observability CLI', () => {

  describe('harness explanation topic', () => {
    it('getConcept("harness") returns an object with title, summary, and content', () => {
      const { getConcept } = require('../../src/lib/explanations');
      const concept = getConcept('harness');
      assert.ok(concept, 'harness concept should exist');
      assert.equal(concept.title, 'Chat Harness Architecture');
      assert.ok(concept.summary.length > 0, 'summary should be non-empty');
      assert.ok(concept.content.length > 0, 'content should be non-empty');
    });

    it('content covers state machine, memory, and session topics', () => {
      const { getConcept } = require('../../src/lib/explanations');
      const { content } = getConcept('harness');
      assert.ok(content.includes('state'), 'content should mention state');
      assert.ok(content.includes('memory') || content.includes('Memory'), 'content should mention memory');
      assert.ok(content.includes('session') || content.includes('Session'), 'content should mention session');
    });

    it('listConcepts() includes "harness"', () => {
      const { listConcepts } = require('../../src/lib/explanations');
      assert.ok(listConcepts().includes('harness'));
    });

    it('resolveConcept resolves harness and its aliases', () => {
      const { resolveConcept } = require('../../src/lib/explanations');
      assert.equal(resolveConcept('harness'), 'harness');
      assert.equal(resolveConcept('state-machine'), 'harness');
      assert.equal(resolveConcept('chat-harness'), 'harness');
      assert.equal(resolveConcept('sessions'), 'harness');
    });

    it('harness concept has links and tryIt arrays', () => {
      const { getConcept } = require('../../src/lib/explanations');
      const concept = getConcept('harness');
      assert.ok(Array.isArray(concept.links), 'links should be an array');
      assert.ok(concept.links.length > 0, 'links should be non-empty');
      assert.ok(Array.isArray(concept.tryIt), 'tryIt should be an array');
      assert.ok(concept.tryIt.length > 0, 'tryIt should be non-empty');
    });
  });

  describe('LABELS coverage', () => {
    it('every STATES key has a corresponding LABELS entry', () => {
      const { STATES, LABELS } = require('../../src/lib/turn-state');
      for (const key of Object.keys(STATES)) {
        assert.ok(LABELS[key] !== undefined, `LABELS missing key: ${key}`);
        assert.ok(typeof LABELS[key] === 'string', `LABELS[${key}] should be a string`);
        assert.ok(LABELS[key].length > 0, `LABELS[${key}] should be non-empty`);
      }
    });

    it('LABELS has the same number of entries as STATES', () => {
      const { STATES, LABELS } = require('../../src/lib/turn-state');
      assert.equal(Object.keys(LABELS).length, Object.keys(STATES).length);
    });
  });

  describe('MemoryBudget.getBreakdown', () => {
    it('returns expected shape after estimateSlotTokens', () => {
      const { MemoryBudget } = require('../../src/lib/memory-budget');
      const budget = new MemoryBudget();
      budget.estimateSlotTokens({
        systemPrompt: 'You are a helpful assistant.',
        contextDocs: [{ text: 'Some context document text.' }],
        currentMessage: 'What is MongoDB?',
      });
      const breakdown = budget.getBreakdown();

      assert.ok(breakdown, 'breakdown should not be null');
      assert.equal(breakdown.modelLimit, 128000);
      assert.equal(breakdown.reservedResponse, 4096);
      assert.equal(typeof breakdown.systemPrompt, 'number');
      assert.equal(typeof breakdown.context, 'number');
      assert.equal(typeof breakdown.currentMessage, 'number');
      assert.equal(typeof breakdown.historyBudget, 'number');
      assert.ok(breakdown.historyBudget > 0, 'historyBudget should be positive');
    });

    it('returns null before estimateSlotTokens is called', () => {
      const { MemoryBudget } = require('../../src/lib/memory-budget');
      const budget = new MemoryBudget();
      assert.equal(budget.getBreakdown(), null);
    });
  });

  describe('MemoryManager strategy info', () => {
    it('getStrategyNames returns array including sliding_window', () => {
      const { createFullMemoryManager } = require('../../src/lib/memory-strategy');
      const manager = createFullMemoryManager();
      const names = manager.getStrategyNames();
      assert.ok(Array.isArray(names));
      assert.ok(names.includes('sliding_window'));
    });

    it('default strategy is sliding_window', () => {
      const { createFullMemoryManager } = require('../../src/lib/memory-strategy');
      const manager = createFullMemoryManager();
      assert.equal(manager._defaultStrategy, 'sliding_window');
    });

    it('createFullMemoryManager registers summarization and hierarchical', () => {
      const { createFullMemoryManager } = require('../../src/lib/memory-strategy');
      const manager = createFullMemoryManager();
      const names = manager.getStrategyNames();
      assert.ok(names.includes('summarization'));
      assert.ok(names.includes('hierarchical'));
    });
  });

  describe('chat command --memory-strategy option', () => {
    it('chat command has --memory-strategy option', () => {
      const { Command } = require('commander');
      const { registerChat } = require('../../src/commands/chat');
      const program = new Command();
      registerChat(program);
      const chatCmd = program.commands.find(c => c.name() === 'chat');
      assert.ok(chatCmd, 'chat command should be registered');
      const opt = chatCmd.options.find(o => o.long === '--memory-strategy');
      assert.ok(opt, 'chat command should have --memory-strategy option');
    });
  });

});
