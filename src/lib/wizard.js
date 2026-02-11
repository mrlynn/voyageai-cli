'use strict';

/**
 * Surface-agnostic wizard engine.
 *
 * Defines step schemas, validation, flow control (next/back/skip),
 * and config resolution. UI renderers (CLI, Playground, Desktop)
 * consume the same step definitions.
 *
 * A wizard is an ordered array of Step objects. The engine walks
 * them forward/backward, skipping steps whose `skip` predicate
 * returns true, and validating answers before advancing.
 */

/**
 * @typedef {Object} StepOption
 * @property {string} value   - stored value
 * @property {string} label   - display label
 * @property {string} [hint]  - secondary description
 */

/**
 * @typedef {Object} Step
 * @property {string}   id         - unique key (becomes the answer key)
 * @property {string}   label      - human-readable prompt
 * @property {'select'|'text'|'password'|'confirm'} type
 * @property {StepOption[]|function(answers,config):StepOption[]} [options]  - for select type
 * @property {*}        [defaultValue]       - static default
 * @property {function(answers,config):*}   [getDefault] - dynamic default
 * @property {boolean}  [required]           - must have a value to advance
 * @property {function(value,answers):true|string} [validate] - return true or error message
 * @property {function(answers,config):boolean}    [skip]     - skip this step entirely
 * @property {string}   [group]              - visual grouping label
 * @property {string}   [placeholder]        - input placeholder / hint text
 */

/**
 * Resolve the effective options array for a step.
 * @param {Step} step
 * @param {object} answers   - answers collected so far
 * @param {object} config    - existing configuration
 * @returns {StepOption[]}
 */
function resolveOptions(step, answers, config) {
  if (typeof step.options === 'function') return step.options(answers, config);
  return step.options || [];
}

/**
 * Resolve the default value for a step.
 * @param {Step} step
 * @param {object} answers
 * @param {object} config
 * @returns {*}
 */
function resolveDefault(step, answers, config) {
  if (typeof step.getDefault === 'function') return step.getDefault(answers, config);
  return step.defaultValue;
}

/**
 * Determine whether a step should be skipped.
 * @param {Step} step
 * @param {object} answers
 * @param {object} config
 * @returns {boolean}
 */
function shouldSkip(step, answers, config) {
  if (typeof step.skip === 'function') return step.skip(answers, config);
  return false;
}

/**
 * Validate a step's answer.
 * @param {Step} step
 * @param {*} value
 * @param {object} answers
 * @returns {true|string}  true if valid, or error message string
 */
function validateStep(step, value, answers) {
  if (step.required && (value === undefined || value === null || value === '')) {
    return `${step.label} is required`;
  }
  if (typeof step.validate === 'function') {
    return step.validate(value, answers);
  }
  return true;
}

/**
 * Compute the ordered list of non-skipped step indices.
 * @param {Step[]} steps
 * @param {object} answers
 * @param {object} config
 * @returns {number[]}
 */
function activeIndices(steps, answers, config) {
  const indices = [];
  for (let i = 0; i < steps.length; i++) {
    if (!shouldSkip(steps[i], answers, config)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Walk a wizard definition and collect answers.
 *
 * This is the **headless engine**. It calls `renderer.prompt(step, context)`
 * for each active step. The renderer returns:
 *   - A value (answer)
 *   - Symbol.for('back')  → go to previous step
 *   - Symbol.for('cancel') → abort the wizard
 *
 * @param {Object} params
 * @param {Step[]}  params.steps    - wizard step definitions
 * @param {object}  params.config   - existing config (for skip/default resolution)
 * @param {object}  params.renderer - { prompt(step, ctx) → value|symbol, intro?, outro? }
 * @param {object}  [params.initial] - pre-filled answers
 * @returns {Promise<{answers: object, cancelled: boolean}>}
 */
async function runWizard({ steps, config = {}, renderer, initial = {} }) {
  const answers = { ...initial };
  const active = activeIndices(steps, answers, config);

  if (active.length === 0) {
    return { answers, cancelled: false };
  }

  if (renderer.intro) await renderer.intro(steps, config);

  let pos = 0; // position within the active array

  while (pos < active.length) {
    const stepIdx = active[pos];
    const step = steps[stepIdx];

    // Recompute active list (answers may change skip predicates)
    const currentActive = activeIndices(steps, answers, config);
    if (!currentActive.includes(stepIdx)) {
      pos++;
      continue;
    }

    const options = resolveOptions(step, answers, config);
    const defaultValue = answers[step.id] !== undefined
      ? answers[step.id]
      : resolveDefault(step, answers, config);

    const result = await renderer.prompt(step, {
      options,
      defaultValue,
      stepNumber: pos + 1,
      totalSteps: currentActive.length,
      isFirst: pos === 0,
      isLast: pos === currentActive.length - 1,
      answers,
      config,
    });

    // Handle navigation
    if (result === Symbol.for('cancel')) {
      if (renderer.cancel) await renderer.cancel();
      return { answers, cancelled: true };
    }

    if (result === Symbol.for('back')) {
      if (pos > 0) pos--;
      continue;
    }

    // Validate
    const valid = validateStep(step, result, answers);
    if (valid !== true) {
      if (renderer.error) await renderer.error(valid);
      continue; // re-prompt same step
    }

    answers[step.id] = result;
    pos++;
  }

  if (renderer.outro) await renderer.outro(answers);

  return { answers, cancelled: false };
}

/**
 * Export step definitions as a plain serializable array
 * (for web/desktop consumption). Strips functions, resolves
 * options and defaults against the provided config.
 *
 * @param {Step[]} steps
 * @param {object} config
 * @returns {object[]}
 */
function serializeSteps(steps, config = {}) {
  const answers = {};
  return steps
    .filter(s => !shouldSkip(s, answers, config))
    .map(s => ({
      id: s.id,
      label: s.label,
      type: s.type,
      required: !!s.required,
      group: s.group || null,
      placeholder: s.placeholder || null,
      options: resolveOptions(s, answers, config),
      defaultValue: resolveDefault(s, answers, config),
    }));
}

module.exports = {
  runWizard,
  serializeSteps,
  resolveOptions,
  resolveDefault,
  shouldSkip,
  validateStep,
  activeIndices,
};
