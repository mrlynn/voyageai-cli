'use strict';

/**
 * Project init wizard step definitions.
 *
 * Surface-agnostic — consumed by CLI, Playground, and Desktop.
 * Replaces the raw readline prompts in the old init command.
 */

const { MODEL_CATALOG } = require('./catalog');
const { STRATEGIES } = require('./chunker');

/**
 * Get available embedding models (non-legacy, non-unreleased).
 */
function getEmbeddingModelOptions() {
  return MODEL_CATALOG
    .filter(m => m.type === 'embedding' && !m.legacy && !m.unreleased)
    .map(m => ({
      value: m.name,
      label: m.name,
      hint: `${m.shortFor || m.bestFor} — ${m.price}`,
    }));
}

/**
 * Get chunk strategy options.
 */
function getStrategyOptions() {
  const descriptions = {
    fixed: 'Fixed character count',
    sentence: 'Split on sentence boundaries',
    paragraph: 'Split on paragraph boundaries',
    recursive: 'Recursive splitting (recommended)',
    markdown: 'Markdown-aware splitting',
  };
  return STRATEGIES.map(s => ({
    value: s,
    label: s,
    hint: descriptions[s] || '',
  }));
}

/**
 * Get dimension options for the selected model.
 */
function getDimensionOptions(answers) {
  const model = answers.model;
  const info = MODEL_CATALOG.find(m => m.name === model);
  if (!info || !info.dimensions) {
    return [
      { value: '1024', label: '1024', hint: 'default' },
      { value: '512', label: '512' },
      { value: '256', label: '256' },
    ];
  }
  // Parse dimensions string like "1024 (default), 256, 512, 2048"
  const dims = info.dimensions.split(',').map(d => d.trim());
  return dims.map(d => {
    const isDefault = d.includes('default');
    const val = d.replace(/[^0-9]/g, '');
    return {
      value: val,
      label: val,
      hint: isDefault ? 'default' : undefined,
    };
  });
}

const initSteps = [
  // Embedding model
  {
    id: 'model',
    label: 'Embedding model',
    type: 'select',
    options: () => getEmbeddingModelOptions(),
    defaultValue: 'voyage-4-large',
    required: true,
    group: 'Embedding',
  },

  // MongoDB
  {
    id: 'db',
    label: 'Database name',
    type: 'text',
    defaultValue: 'myapp',
    placeholder: 'myapp',
    required: true,
    group: 'MongoDB Atlas',
  },
  {
    id: 'collection',
    label: 'Collection name',
    type: 'text',
    defaultValue: 'documents',
    placeholder: 'documents',
    required: true,
    group: 'MongoDB Atlas',
  },
  {
    id: 'field',
    label: 'Embedding field',
    type: 'text',
    defaultValue: 'embedding',
    placeholder: 'embedding',
    group: 'MongoDB Atlas',
  },
  {
    id: 'index',
    label: 'Vector index name',
    type: 'text',
    defaultValue: 'vector_index',
    placeholder: 'vector_index',
    group: 'MongoDB Atlas',
  },

  // Dimensions
  {
    id: 'dimensions',
    label: 'Dimensions',
    type: 'select',
    options: (answers) => getDimensionOptions(answers),
    getDefault: (answers) => {
      const info = MODEL_CATALOG.find(m => m.name === answers.model);
      if (info && info.dimensions && info.dimensions.includes('1024')) return '1024';
      return '512';
    },
    group: 'Embedding',
  },

  // Chunking
  {
    id: 'chunkStrategy',
    label: 'Chunk strategy',
    type: 'select',
    options: () => getStrategyOptions(),
    defaultValue: 'recursive',
    group: 'Chunking',
  },
  {
    id: 'chunkSize',
    label: 'Chunk size (chars)',
    type: 'text',
    defaultValue: '512',
    placeholder: '512',
    validate: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 50) return 'Must be a number ≥ 50';
      return true;
    },
    group: 'Chunking',
  },
  {
    id: 'chunkOverlap',
    label: 'Chunk overlap (chars)',
    type: 'text',
    defaultValue: '50',
    placeholder: '50',
    validate: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 0) return 'Must be a non-negative number';
      return true;
    },
    group: 'Chunking',
  },
];

module.exports = {
  initSteps,
  getEmbeddingModelOptions,
  getStrategyOptions,
  getDimensionOptions,
};
