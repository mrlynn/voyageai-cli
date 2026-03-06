'use strict';

const { ValidationError } = require('./errors');

/**
 * Input validation middleware factory.
 * Takes a schema object describing expected fields and returns middleware
 * that validates req.body against the schema.
 *
 * Schema format:
 *   { fieldName: { type, required?, min?, max?, pattern?, enum?, custom? } }
 *
 * Usage:
 *   router.post('/tasks', validate(createTaskSchema), createTaskHandler);
 *
 * @param {object} schema - Validation rules per field
 * @returns {function} Express middleware
 */
function validate(schema) {
  return (req, _res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }

      // Skip validation for optional absent fields
      if (value === undefined || value === null) continue;

      // Type check
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({ field, message: `${field} must be a string` });
        continue;
      }

      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push({ field, message: `${field} must be a number` });
        continue;
      }

      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push({ field, message: `${field} must be an array` });
        continue;
      }

      // String length constraints
      if (typeof value === 'string') {
        if (rules.min && value.length < rules.min) {
          errors.push({ field, message: `${field} must be at least ${rules.min} characters` });
        }
        if (rules.max && value.length > rules.max) {
          errors.push({ field, message: `${field} must be at most ${rules.max} characters` });
        }
      }

      // Number range constraints
      if (typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push({ field, message: `${field} must be at least ${rules.min}` });
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push({ field, message: `${field} must be at most ${rules.max}` });
        }
      }

      // Regex pattern
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push({ field, message: rules.patternMessage || `${field} has an invalid format` });
      }

      // Enum (allowed values)
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({
          field,
          message: `${field} must be one of: ${rules.enum.join(', ')}`,
        });
      }

      // Custom validator function
      if (rules.custom) {
        const customError = rules.custom(value, body);
        if (customError) {
          errors.push({ field, message: customError });
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }

    next();
  };
}

/**
 * Sanitize a string by trimming whitespace and removing HTML tags.
 * Prevents basic XSS in stored user input.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/<[^>]*>/g, '')    // Strip HTML tags
    .replace(/&[a-z]+;/gi, ''); // Strip HTML entities
}

// ── Common schemas ─────────────────────────────────────────────────

const createTaskSchema = {
  title: {
    type: 'string',
    required: true,
    min: 1,
    max: 200,
  },
  description: {
    type: 'string',
    max: 5000,
  },
  priority: {
    type: 'string',
    enum: ['low', 'medium', 'high', 'critical'],
  },
  dueDate: {
    type: 'string',
    custom: (val) => {
      if (val && isNaN(Date.parse(val))) return 'dueDate must be a valid ISO date';
      if (val && new Date(val) < new Date()) return 'dueDate must be in the future';
      return null;
    },
  },
  tags: {
    type: 'array',
    custom: (val) => {
      if (val.length > 10) return 'Maximum 10 tags allowed';
      if (val.some(t => typeof t !== 'string')) return 'All tags must be strings';
      return null;
    },
  },
};

const registerUserSchema = {
  email: {
    type: 'string',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMessage: 'email must be a valid email address',
  },
  password: {
    type: 'string',
    required: true,
    min: 8,
    max: 128,
    custom: (val) => {
      if (!/[A-Z]/.test(val)) return 'Password must contain an uppercase letter';
      if (!/[0-9]/.test(val)) return 'Password must contain a number';
      return null;
    },
  },
  name: {
    type: 'string',
    required: true,
    min: 1,
    max: 100,
  },
};

module.exports = {
  validate,
  sanitizeString,
  createTaskSchema,
  registerUserSchema,
};
