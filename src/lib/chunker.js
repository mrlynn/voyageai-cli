'use strict';

/**
 * Available chunking strategies.
 */
const STRATEGIES = ['fixed', 'sentence', 'paragraph', 'recursive', 'markdown'];

/**
 * Default chunk options.
 */
const DEFAULTS = {
  size: 512,
  overlap: 50,
  minSize: 20,
};

// ── Sentence splitting ──

/**
 * Split text into sentences. Handles common abbreviations and edge cases.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  // Split on sentence-ending punctuation followed by whitespace or EOL.
  // Negative lookbehind for common abbreviations (Mr., Dr., etc.)
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z\u00C0-\u024F"])/);
  return parts.map(s => s.trim()).filter(s => s.length > 0);
}

// ── Strategy implementations ──

/**
 * Fixed-size chunking with character count and overlap.
 * @param {string} text
 * @param {object} opts
 * @param {number} opts.size - Target chunk size in characters
 * @param {number} opts.overlap - Overlap between chunks in characters
 * @returns {string[]}
 */
function chunkFixed(text, opts) {
  const { size, overlap } = opts;
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = start + size;
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
    // Prevent infinite loop with tiny overlap
    if (end >= text.length) break;
  }

  return chunks.filter(c => c.length >= (opts.minSize || DEFAULTS.minSize));
}

/**
 * Sentence-boundary chunking. Groups sentences until size limit.
 * @param {string} text
 * @param {object} opts
 * @returns {string[]}
 */
function chunkSentence(text, opts) {
  const { size, overlap } = opts;
  const sentences = splitSentences(text);
  return groupUnits(sentences, size, overlap, opts.minSize || DEFAULTS.minSize);
}

/**
 * Paragraph chunking. Splits on double newlines, groups if needed.
 * @param {string} text
 * @param {object} opts
 * @returns {string[]}
 */
function chunkParagraph(text, opts) {
  const { size, overlap } = opts;
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);
  return groupUnits(paragraphs, size, overlap, opts.minSize || DEFAULTS.minSize);
}

/**
 * Recursive chunking. Tries largest delimiters first, falls back to smaller.
 * This is the most commonly used strategy for RAG pipelines.
 * @param {string} text
 * @param {object} opts
 * @returns {string[]}
 */
function chunkRecursive(text, opts) {
  const { size, minSize } = opts;
  const separators = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' '];

  return recursiveSplit(text, separators, size, minSize || DEFAULTS.minSize);
}

/**
 * Internal recursive split implementation.
 * @param {string} text
 * @param {string[]} separators
 * @param {number} maxSize
 * @param {number} minSize
 * @returns {string[]}
 */
function recursiveSplit(text, separators, maxSize, minSize) {
  if (text.length <= maxSize) {
    return text.trim().length >= minSize ? [text.trim()] : [];
  }

  // Find the first separator that exists in the text
  let sep = null;
  for (const s of separators) {
    if (text.includes(s)) {
      sep = s;
      break;
    }
  }

  // If no separator found, hard-split by characters
  if (sep === null) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxSize) {
      const chunk = text.slice(i, i + maxSize).trim();
      if (chunk.length >= minSize) chunks.push(chunk);
    }
    return chunks;
  }

  // Split on this separator and greedily merge pieces under maxSize
  const parts = text.split(sep);
  const chunks = [];
  let current = '';

  for (const part of parts) {
    const candidate = current ? current + sep + part : part;

    if (candidate.length <= maxSize) {
      current = candidate;
    } else {
      // Flush current chunk
      if (current.trim().length >= minSize) {
        chunks.push(current.trim());
      }
      // If this single part exceeds maxSize, recurse with next separator level
      if (part.length > maxSize) {
        const remainingSeps = separators.slice(separators.indexOf(sep) + 1);
        chunks.push(...recursiveSplit(part, remainingSeps, maxSize, minSize));
        current = '';
      } else {
        current = part;
      }
    }
  }

  // Flush remainder
  if (current.trim().length >= minSize) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Markdown-aware chunking. Splits on headings, preserves structure.
 * Each heading starts a new chunk; content under it is grouped.
 * @param {string} text
 * @param {object} opts
 * @returns {string[]}
 */
function chunkMarkdown(text, opts) {
  const { size, minSize } = opts;

  // Split on markdown headings (# through ######)
  const headingPattern = /^(#{1,6}\s.+)$/gm;
  const sections = [];
  let lastIndex = 0;
  let match;

  while ((match = headingPattern.exec(text)) !== null) {
    // Content before this heading
    if (match.index > lastIndex) {
      const content = text.slice(lastIndex, match.index).trim();
      if (content) {
        if (sections.length > 0) {
          // Append to previous section
          sections[sections.length - 1].content += '\n\n' + content;
        } else {
          sections.push({ heading: '', content });
        }
      }
    }
    sections.push({ heading: match[1], content: '' });
    lastIndex = match.index + match[0].length;
  }

  // Remaining content after last heading
  if (lastIndex < text.length) {
    const content = text.slice(lastIndex).trim();
    if (content) {
      if (sections.length > 0) {
        sections[sections.length - 1].content += '\n\n' + content;
      } else {
        sections.push({ heading: '', content });
      }
    }
  }

  // Build chunks from sections, splitting large sections recursively
  const chunks = [];
  for (const section of sections) {
    const full = section.heading
      ? section.heading + '\n\n' + section.content.trim()
      : section.content.trim();

    if (!full || full.length < (minSize || DEFAULTS.minSize)) continue;

    if (full.length <= size) {
      chunks.push(full);
    } else {
      // Section too large — recursively split the content, prepend heading to first chunk
      const subChunks = chunkRecursive(section.content.trim(), opts);
      for (let i = 0; i < subChunks.length; i++) {
        if (i === 0 && section.heading) {
          chunks.push(section.heading + '\n\n' + subChunks[i]);
        } else {
          chunks.push(subChunks[i]);
        }
      }
    }
  }

  return chunks;
}

// ── Shared helpers ──

/**
 * Group text units (sentences, paragraphs) into chunks under a size limit.
 * Supports overlap by re-including trailing units from the previous chunk.
 * @param {string[]} units
 * @param {number} maxSize
 * @param {number} overlapChars
 * @param {number} minSize
 * @returns {string[]}
 */
function groupUnits(units, maxSize, overlapChars, minSize) {
  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const unit of units) {
    const addLen = current.length > 0 ? unit.length + 1 : unit.length; // +1 for space

    if (currentLen + addLen > maxSize && current.length > 0) {
      chunks.push(current.join(' ').trim());

      // Overlap: keep trailing units that fit within overlap budget
      if (overlapChars > 0) {
        let overlapUnits = [];
        let overlapLen = 0;
        for (let i = current.length - 1; i >= 0; i--) {
          if (overlapLen + current[i].length + 1 > overlapChars) break;
          overlapUnits.unshift(current[i]);
          overlapLen += current[i].length + 1;
        }
        current = overlapUnits;
        currentLen = overlapLen;
      } else {
        current = [];
        currentLen = 0;
      }
    }

    current.push(unit);
    currentLen += addLen;
  }

  // Flush remainder
  if (current.length > 0) {
    const text = current.join(' ').trim();
    if (text.length >= minSize) chunks.push(text);
  }

  return chunks;
}

// ── Token estimation ──

/**
 * Rough token estimate. ~4 chars per token for English text.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ── Public API ──

/**
 * Chunk text using the specified strategy.
 * @param {string} text - Input text
 * @param {object} [options]
 * @param {string} [options.strategy='recursive'] - Chunking strategy
 * @param {number} [options.size=512] - Target chunk size in characters
 * @param {number} [options.overlap=50] - Overlap between chunks in characters
 * @param {number} [options.minSize=20] - Minimum chunk size
 * @returns {string[]} Array of text chunks
 */
function chunk(text, options = {}) {
  const opts = {
    strategy: options.strategy || 'recursive',
    size: options.size || DEFAULTS.size,
    overlap: options.overlap != null ? options.overlap : DEFAULTS.overlap,
    minSize: options.minSize || DEFAULTS.minSize,
  };

  if (!text || text.trim().length === 0) return [];

  switch (opts.strategy) {
    case 'fixed':
      return chunkFixed(text, opts);
    case 'sentence':
      return chunkSentence(text, opts);
    case 'paragraph':
      return chunkParagraph(text, opts);
    case 'recursive':
      return chunkRecursive(text, opts);
    case 'markdown':
      return chunkMarkdown(text, opts);
    default:
      throw new Error(`Unknown chunking strategy: ${opts.strategy}. Available: ${STRATEGIES.join(', ')}`);
  }
}

module.exports = {
  chunk,
  splitSentences,
  estimateTokens,
  STRATEGIES,
  DEFAULTS,
};
