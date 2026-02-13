'use strict';

/**
 * Template expression engine for vai workflows.
 *
 * Resolves {{ expression }} strings against a context object.
 * Supports dot-path access and array indexing only.
 * No eval(), no function calls, no arithmetic.
 *
 * Grammar:
 *   expression = segment ("." segment)*
 *   segment    = identifier ("[" index "]")?
 *   identifier = [a-zA-Z_][a-zA-Z0-9_]*
 *   index      = [0-9]+
 */

// Matches {{ path.to.value }} including {{ path[0].field }}
const TEMPLATE_RE = /\{\{\s*(.+?)\s*\}\}/g;

// A string that is exactly one template expression with no surrounding text
// Use [^}] to prevent matching across multiple {{ }} pairs
const SOLE_TEMPLATE_RE = /^\{\{\s*([^}]+?)\s*\}\}$/;

/**
 * Check if a string contains template expressions.
 * @param {string} str
 * @returns {boolean}
 */
function isTemplateString(str) {
  if (typeof str !== 'string') return false;
  // Use a fresh regex to avoid global lastIndex state issues
  return /\{\{\s*(.+?)\s*\}\}/.test(str);
}

/**
 * Parse a dot-path expression into segments.
 *
 * @param {string} expr - e.g. "search_api.output.results[0].content"
 * @returns {Array<{key: string, index?: number}>}
 * @throws {Error} on invalid syntax
 */
function parseExpression(expr) {
  const trimmed = expr.trim();
  if (!trimmed) throw new Error('Empty expression');

  const segments = [];
  const parts = trimmed.split('.');

  for (const part of parts) {
    // Check for array indexing: identifier[index]
    const bracketMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/);
    if (bracketMatch) {
      segments.push({ key: bracketMatch[1], index: parseInt(bracketMatch[2], 10) });
      continue;
    }

    // Plain identifier
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
      segments.push({ key: part });
      continue;
    }

    throw new Error(`Invalid expression segment: "${part}" in "${expr}"`);
  }

  return segments;
}

/**
 * Resolve a parsed path against a context object.
 * Returns undefined (no throw) if any segment is missing.
 *
 * @param {Array<{key: string, index?: number}>} segments
 * @param {object} context
 * @returns {*}
 */
function resolvePath(segments, context) {
  let current = context;

  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;

    current = current[seg.key];
    if (current == null) return current; // null or undefined

    if (seg.index !== undefined) {
      if (!Array.isArray(current)) return undefined;
      current = current[seg.index];
    }
  }

  return current;
}

/**
 * Resolve template expressions within a single string.
 *
 * If the entire string is a single template expression, return the resolved
 * value directly (preserving type: array, number, object, etc.).
 * If the string contains templates mixed with text, return a string with
 * substitutions.
 *
 * @param {string} str
 * @param {object} context
 * @returns {*}
 */
function resolveString(str, context) {
  // Fast path: no templates
  if (!str.includes('{{')) return str;

  // Check if the entire string is a single template expression
  const soleMatch = str.match(SOLE_TEMPLATE_RE);
  if (soleMatch) {
    try {
      const segments = parseExpression(soleMatch[1]);
      return resolvePath(segments, context);
    } catch {
      return undefined;
    }
  }

  // Mixed text + templates: substitute all, coerce to string
  return str.replace(TEMPLATE_RE, (_match, expr) => {
    try {
      const segments = parseExpression(expr);
      const value = resolvePath(segments, context);
      if (value === undefined) return '';
      if (value === null) return 'null';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    } catch {
      return '';
    }
  });
}

/**
 * Recursively resolve all template expressions in a value.
 * Handles strings, arrays, and plain objects.
 *
 * @param {*} value
 * @param {object} context
 * @returns {*}
 */
function resolveTemplate(value, context) {
  if (typeof value === 'string') {
    return resolveString(value, context);
  }

  if (Array.isArray(value)) {
    return value.map(item => resolveTemplate(item, context));
  }

  if (value !== null && typeof value === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveTemplate(v, context);
    }
    return resolved;
  }

  // numbers, booleans, null, undefined pass through
  return value;
}

/**
 * Deep-resolve all template expressions in an object tree.
 * Alias for resolveTemplate when called on an object.
 *
 * @param {object} obj
 * @param {object} context
 * @returns {object}
 */
function resolveAllTemplates(obj, context) {
  return resolveTemplate(obj, context);
}

/**
 * Extract step IDs referenced by template expressions in an object tree.
 * Ignores "inputs" and "defaults" prefixes (those are workflow-level, not step refs).
 *
 * @param {*} obj - Step inputs, condition, forEach value
 * @returns {Set<string>} Set of step IDs referenced
 */
function extractDependencies(obj) {
  const deps = new Set();

  function scan(value) {
    if (typeof value === 'string') {
      // Reset regex state
      const re = /\{\{\s*(.+?)\s*\}\}/g;
      let match;
      while ((match = re.exec(value)) !== null) {
        const expr = match[1].trim();
        // Extract the first segment (root identifier)
        const dotIdx = expr.indexOf('.');
        const bracketIdx = expr.indexOf('[');
        let root;
        if (dotIdx === -1 && bracketIdx === -1) {
          root = expr;
        } else if (dotIdx === -1) {
          root = expr.slice(0, bracketIdx);
        } else if (bracketIdx === -1) {
          root = expr.slice(0, dotIdx);
        } else {
          root = expr.slice(0, Math.min(dotIdx, bracketIdx));
        }

        // Skip workflow-level references
        if (root !== 'inputs' && root !== 'defaults') {
          deps.add(root);
        }
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(scan);
      return;
    }

    if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(scan);
    }
  }

  scan(obj);
  return deps;
}

module.exports = {
  isTemplateString,
  parseExpression,
  resolvePath,
  resolveString,
  resolveTemplate,
  resolveAllTemplates,
  extractDependencies,
  TEMPLATE_RE,
};
