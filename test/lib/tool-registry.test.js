'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('tool-registry', () => {
  const {
    TOOL_DEFINITIONS,
    zodSchemaToJsonSchema,
    getToolDefinitions,
    executeTool,
  } = require('../../src/lib/tool-registry');

  describe('TOOL_DEFINITIONS', () => {
    it('defines all 11 tools', () => {
      assert.equal(TOOL_DEFINITIONS.length, 11);
    });

    it('includes all expected tool names', () => {
      const names = TOOL_DEFINITIONS.map(d => d.name);
      const expected = [
        'vai_query', 'vai_search', 'vai_rerank',
        'vai_embed', 'vai_similarity',
        'vai_collections', 'vai_models',
        'vai_topics', 'vai_explain', 'vai_estimate',
        'vai_ingest',
      ];
      for (const name of expected) {
        assert.ok(names.includes(name), `Missing tool: ${name}`);
      }
    });

    it('every definition has name, description, schemaKey', () => {
      for (const def of TOOL_DEFINITIONS) {
        assert.ok(def.name, `Missing name in ${JSON.stringify(def)}`);
        assert.ok(def.description, `Missing description for ${def.name}`);
        assert.ok(def.schemaKey, `Missing schemaKey for ${def.name}`);
      }
    });
  });

  describe('zodSchemaToJsonSchema', () => {
    const { z } = require('zod');

    it('converts a simple schema to JSON Schema', () => {
      const fields = {
        query: z.string().describe('Search query'),
      };
      const result = zodSchemaToJsonSchema(fields);
      assert.equal(result.type, 'object');
      assert.ok(result.properties.query);
      assert.equal(result.properties.query.type, 'string');
    });

    it('strips $schema key', () => {
      const fields = { text: z.string() };
      const result = zodSchemaToJsonSchema(fields);
      assert.equal(result['$schema'], undefined);
    });

    it('removes fields with defaults from required array', () => {
      const fields = {
        query: z.string().describe('Required field'),
        limit: z.number().default(5).describe('Optional with default'),
      };
      const result = zodSchemaToJsonSchema(fields);

      // query should be required, limit should not
      if (result.required) {
        assert.ok(result.required.includes('query'), 'query should be required');
        assert.ok(!result.required.includes('limit'), 'limit should not be required (has default)');
      }
    });

    it('removes required array entirely when all fields have defaults', () => {
      const fields = {
        limit: z.number().default(5),
        flag: z.boolean().default(true),
      };
      const result = zodSchemaToJsonSchema(fields);
      assert.equal(result.required, undefined);
    });

    it('handles optional fields', () => {
      const fields = {
        query: z.string(),
        filter: z.string().optional(),
      };
      const result = zodSchemaToJsonSchema(fields);
      // Optional fields should not be in required
      if (result.required) {
        assert.ok(!result.required.includes('filter'), 'optional filter should not be required');
      }
    });
  });

  describe('getToolDefinitions', () => {
    it('returns Anthropic format', () => {
      const tools = getToolDefinitions('anthropic');
      assert.ok(tools.length > 0);

      const first = tools[0];
      assert.ok(first.name, 'Should have name');
      assert.ok(first.description, 'Should have description');
      assert.ok(first.input_schema, 'Should have input_schema');
      assert.equal(first.input_schema.type, 'object');
      // Should NOT have OpenAI wrapper
      assert.equal(first.type, undefined);
      assert.equal(first.function, undefined);
    });

    it('returns OpenAI format', () => {
      const tools = getToolDefinitions('openai');
      assert.ok(tools.length > 0);

      const first = tools[0];
      assert.equal(first.type, 'function');
      assert.ok(first.function, 'Should have function wrapper');
      assert.ok(first.function.name, 'Should have function.name');
      assert.ok(first.function.description, 'Should have function.description');
      assert.ok(first.function.parameters, 'Should have function.parameters');
      assert.equal(first.function.parameters.type, 'object');
    });

    it('returns same number of tools in both formats', () => {
      const anthropic = getToolDefinitions('anthropic');
      const openai = getToolDefinitions('openai');
      assert.equal(anthropic.length, openai.length);
      assert.equal(anthropic.length, 11);
    });

    it('ollama format matches openai', () => {
      const ollama = getToolDefinitions('ollama');
      assert.ok(ollama[0].type === 'function');
      assert.ok(ollama[0].function);
    });

    it('generates valid JSON Schema properties for vai_query', () => {
      const tools = getToolDefinitions('anthropic');
      const query = tools.find(t => t.name === 'vai_query');
      assert.ok(query);
      assert.ok(query.input_schema.properties.query, 'Should have query property');
      // limit has a default, so should not be required
      if (query.input_schema.required) {
        assert.ok(!query.input_schema.required.includes('limit'), 'limit should not be required');
      }
    });
  });

  describe('executeTool', () => {
    it('throws on unknown tool', async () => {
      await assert.rejects(
        () => executeTool('vai_nonexistent', {}),
        /Unknown tool.*vai_nonexistent/
      );
    });

    it('throws on invalid input (missing required field)', async () => {
      // vai_query requires 'query' field
      await assert.rejects(
        () => executeTool('vai_query', {}),
        /error|invalid|required/i
      );
    });

    it('applies defaults during validation', async () => {
      // vai_rerank requires query + documents, model has default
      // This will fail at the API level but should pass validation
      try {
        await executeTool('vai_rerank', {
          query: 'test query',
          documents: ['doc 1', 'doc 2'],
          // model should default to 'rerank-2.5'
        });
      } catch (err) {
        // It's OK if it fails at the API call level,
        // as long as it didn't fail at Zod validation
        assert.ok(!err.message.includes('model'), 'Should not fail on model validation');
      }
    });
  });
});
