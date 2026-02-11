'use strict';

/**
 * CLI renderer for the wizard engine.
 *
 * Uses @clack/prompts for beautiful terminal UI with
 * back-navigation support (type "back" or "<" at any prompt).
 */

// Lazy-loaded — @clack/prompts is ESM-only in some versions,
// and eager require crashes on Node <22. Only loaded when actually used.
let p;
let pc;
function ensureDeps() {
  if (!p) p = require('@clack/prompts');
  if (!pc) pc = require('picocolors');
}

const BACK = Symbol.for('back');
const CANCEL = Symbol.for('cancel');

/**
 * Create a CLI renderer for runWizard().
 *
 * @param {object} [opts]
 * @param {string} [opts.title]       - intro title
 * @param {string} [opts.doneMessage] - outro message
 * @param {boolean} [opts.showBackHint] - show "type < to go back" hint (default true)
 * @returns {object} renderer compatible with runWizard
 */
function createCLIRenderer(opts = {}) {
  ensureDeps();
  const showBackHint = opts.showBackHint !== false;

  return {
    async intro(steps, config) {
      if (opts.title) {
        p.intro(pc.bold(opts.title));
      }
    },

    async prompt(step, ctx) {
      const { options, defaultValue, stepNumber, totalSteps, isFirst } = ctx;
      const backHint = (!isFirst && showBackHint)
        ? pc.dim('  (< to go back)')
        : '';
      const stepLabel = pc.dim(`[${stepNumber}/${totalSteps}]`);
      const label = `${stepLabel} ${step.label}${backHint}`;

      let result;

      switch (step.type) {
        case 'select': {
          // Map options to clack format
          const clackOptions = options.map(o => ({
            value: o.value,
            label: o.label,
            hint: o.hint || undefined,
          }));

          // Add "Go back" option if not first step
          if (!isFirst) {
            clackOptions.push({
              value: '__back__',
              label: pc.dim('← Go back'),
            });
          }

          result = await p.select({
            message: label,
            options: clackOptions,
            initialValue: defaultValue || undefined,
          });

          if (p.isCancel(result)) return CANCEL;
          if (result === '__back__') return BACK;
          return result;
        }

        case 'text':
        case 'password': {
          result = await p.text({
            message: label,
            placeholder: step.placeholder || '',
            defaultValue: defaultValue != null ? String(defaultValue) : undefined,
            validate: (val) => {
              if (val == null) return undefined;
              // Handle back navigation
              if (val === '<' || (typeof val === 'string' && val.toLowerCase() === 'back')) return undefined;
              if (step.required && !val) return `${step.label} is required`;
              if (step.validate) {
                const v = step.validate(val, ctx.answers);
                if (v !== true) return v;
              }
              return undefined;
            },
          });

          if (p.isCancel(result)) return CANCEL;
          if (result === '<' || (typeof result === 'string' && result.toLowerCase() === 'back')) return BACK;
          return result;
        }

        case 'confirm': {
          result = await p.confirm({
            message: label,
            initialValue: defaultValue != null ? defaultValue : true,
          });

          if (p.isCancel(result)) return CANCEL;
          return result;
        }

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
    },

    async error(message) {
      p.log.error(message);
    },

    async cancel() {
      p.cancel('Setup cancelled.');
    },

    async outro(answers) {
      if (opts.doneMessage) {
        p.outro(opts.doneMessage);
      }
    },
  };
}

module.exports = { createCLIRenderer };
