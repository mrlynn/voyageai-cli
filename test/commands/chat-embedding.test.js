'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Command } = require('commander');
const { registerChat, resolveEmbeddingConfig } = require('../../src/commands/chat');

describe('chat --embedding-model', () => {
  function setup() {
    const program = new Command();
    program.exitOverride();
    registerChat(program);
    return program.commands.find(c => c.name() === 'chat');
  }

  it('registers --embedding-model option', () => {
    const cmd = setup();
    const opt = cmd.options.find(o => o.long === '--embedding-model');
    assert.ok(opt, '--embedding-model option should be registered');
  });

  describe('resolveEmbeddingConfig', () => {
    it('returns defaults when no options provided', () => {
      const result = resolveEmbeddingConfig({});
      assert.deepEqual(result, {
        embeddingModel: null,
        isLocalEmbed: false,
        doRerank: true,
      });
    });

    it('--local sets embeddingModel to voyage-4-nano and disables reranking', () => {
      const result = resolveEmbeddingConfig({ local: true });
      assert.deepEqual(result, {
        embeddingModel: 'voyage-4-nano',
        isLocalEmbed: true,
        doRerank: false,
      });
    });

    it('explicit --embedding-model voyage-4-lite keeps reranking enabled', () => {
      const result = resolveEmbeddingConfig({ embeddingModel: 'voyage-4-lite' });
      assert.deepEqual(result, {
        embeddingModel: 'voyage-4-lite',
        isLocalEmbed: false,
        doRerank: true,
      });
    });

    it('explicit --embedding-model voyage-4-nano disables reranking', () => {
      const result = resolveEmbeddingConfig({ embeddingModel: 'voyage-4-nano' });
      assert.deepEqual(result, {
        embeddingModel: 'voyage-4-nano',
        isLocalEmbed: true,
        doRerank: false,
      });
    });

    it('falls back to chatConf.embeddingModel', () => {
      const result = resolveEmbeddingConfig({}, { embeddingModel: 'voyage-4' });
      assert.deepEqual(result, {
        embeddingModel: 'voyage-4',
        isLocalEmbed: false,
        doRerank: true,
      });
    });

    it('explicit flag wins over chatConf', () => {
      const result = resolveEmbeddingConfig(
        { embeddingModel: 'voyage-4-lite' },
        { embeddingModel: 'voyage-4' }
      );
      assert.equal(result.embeddingModel, 'voyage-4-lite');
    });

    it('explicit --no-rerank is honored for non-nano models', () => {
      const result = resolveEmbeddingConfig({
        rerank: false,
        embeddingModel: 'voyage-4-lite',
      });
      assert.equal(result.doRerank, false);
    });
  });
});
