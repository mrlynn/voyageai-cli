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
  const promptedStepIndices = new Set();

  if (renderer.intro) await renderer.intro(steps, config);

  // Recompute active steps after each answer so conditional steps (e.g. mongodbUri when wantMongo)
  // are included once their skip predicate becomes false. A step is "next" when it's active and
  // we haven't prompted for it yet (so we still show steps that have initial/default values).
  while (true) {
    const currentActive = activeIndices(steps, answers, config);
    if (currentActive.length === 0) break;

    const nextPos = currentActive.findIndex((idx) => !promptedStepIndices.has(idx));
    if (nextPos < 0) break;

    const stepIdx = currentActive[nextPos];
    const step = steps[stepIdx];

    let options = resolveOptions(step, answers, config);
    if (options && typeof options.then === 'function') options = await options;
    const defaultValue = answers[step.id] !== undefined
      ? answers[step.id]
      : resolveDefault(step, answers, config);

    const result = await renderer.prompt(step, {
      options,
      defaultValue,
      stepNumber: nextPos + 1,
      totalSteps: currentActive.length,
      isFirst: nextPos === 0,
      isLast: nextPos === currentActive.length - 1,
      answers,
      config,
    });

    if (result === Symbol.for('cancel')) {
      if (renderer.cancel) await renderer.cancel();
      return { answers, cancelled: true };
    }

    if (result === Symbol.for('back')) {
      if (nextPos > 0) {
        const prevStepIdx = currentActive[nextPos - 1];
        delete answers[steps[prevStepIdx].id];
        promptedStepIndices.delete(prevStepIdx);
      }
      continue;
    }

    const valid = validateStep(step, result, answers);
    if (valid !== true) {
      if (renderer.error) await renderer.error(valid);
      continue;
    }

    promptedStepIndices.add(stepIdx);
    answers[step.id] = result;
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
