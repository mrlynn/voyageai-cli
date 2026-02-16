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
 * Resolve a single expression fragment (a path, string literal, or number).
 * Returns the resolved value or undefined.
 *
 * @param {string} fragment - e.g. "inputs.code", "'hello'", "42"
 * @param {object} context
 * @returns {*}
 */
function resolveFragment(fragment, context) {
  const trimmed = fragment.trim();
  if (!trimmed) return undefined;

  // String literal (single or double quotes)
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Boolean / null / undefined
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // Path lookup
  const segments = parseExpression(trimmed);
  return resolvePath(segments, context);
}

/**
 * Resolve an expression that may contain || (fallback) and + (concatenation).
 *
 * Supports:
 *   path.to.value                          simple path
 *   a.value || b.value                     fallback (first truthy)
 *   'prefix: ' + path.to.value             string concatenation
 *   a.value || 'default text'              fallback with literal
 *   'prefix' + a.value + ' suffix'         multi-part concatenation
 *
 * Operator precedence: || is evaluated first (lowest), then +.
 *
 * @param {string} expr
 * @param {object} context
 * @returns {*}
 */
function resolveExpr(expr, context) {
  const trimmed = expr.trim();

  // Split on || (fallback operator) first
  if (trimmed.includes('||')) {
    const parts = splitOnOperator(trimmed, '||');
    if (parts.length > 1) {
      for (const part of parts) {
        const val = resolveExpr(part.trim(), context);
        if (val !== undefined && val !== null && val !== '' && val !== false) {
          return val;
        }
      }
      // All parts falsy: return the last one resolved
      return resolveExpr(parts[parts.length - 1].trim(), context);
    }
  }

  // Split on + (concatenation)
  if (trimmed.includes('+')) {
    const parts = splitOnOperator(trimmed, '+');
    if (parts.length > 1) {
      let result = '';
      for (const part of parts) {
        const val = resolveFragment(part.trim(), context);
        if (val === undefined || val === null) {
          result += '';
        } else if (typeof val === 'object') {
          result += JSON.stringify(val);
        } else {
          result += String(val);
        }
      }
      return result;
    }
  }

  // Simple fragment (path, literal, etc.)
  return resolveFragment(trimmed, context);
}

/**
 * Split a string on an operator, respecting string literals.
 * Doesn't split inside quoted strings.
 *
 * @param {string} str
 * @param {string} op - e.g. "||" or "+"
 * @returns {string[]}
 */
function splitOnOperator(str, op) {
  const parts = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
    } else if (!inSingle && !inDouble && str.slice(i, i + op.length) === op) {
      parts.push(current);
      current = '';
      i += op.length - 1;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
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
      return resolveExpr(soleMatch[1], context);
    } catch {
      return undefined;
    }
  }

  // Mixed text + templates: substitute all, coerce to string
  return str.replace(TEMPLATE_RE, (_match, expr) => {
    try {
      const value = resolveExpr(expr, context);
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
        // Extract ALL root identifiers from the expression.
        // Expressions can contain operators (&&, ||, !, ===, etc.)
        // so we scan for all dotted-path identifiers.
        const idRe = /(?:^|[^a-zA-Z0-9_.])([a-zA-Z_][a-zA-Z0-9_]*)(?:\.|$|\[| *[><=!&|)])/g;
        let idMatch;
        while ((idMatch = idRe.exec(expr)) !== null) {
          const root = idMatch[1];
          // Skip workflow-level references, literals, and keywords
          if (root !== 'inputs' && root !== 'defaults' &&
              root !== 'true' && root !== 'false' &&
              root !== 'null' && root !== 'undefined' &&
              root !== 'item' && root !== 'index') {
            deps.add(root);
          }
        }
        // Also handle simple single-identifier case (e.g. "{{ stepId }}")
        if (!expr.includes('.') && !expr.includes('[') &&
            !expr.includes('&') && !expr.includes('|') &&
            !expr.includes('!') && !expr.includes('=') &&
            !expr.includes('>') && !expr.includes('<')) {
          const root = expr;
          if (root !== 'inputs' && root !== 'defaults' &&
              root !== 'true' && root !== 'false' &&
              root !== 'null' && root !== 'undefined' &&
              root !== 'item' && root !== 'index') {
            deps.add(root);
          }
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
