'use strict';

const pc = require('picocolors');
const { resolveConcept, listConcepts, getConcept } = require('../lib/explanations');

const DISCLAIMER = pc.dim('  This tool is not affiliated with MongoDB, Inc. or Voyage AI.');

/**
 * Show the list of available topics.
 */
function showTopicList() {
  console.log('');
  console.log(`  🧭 ${pc.bold('Voyage AI Concepts')}`);
  console.log('');
  console.log('  Available topics:');

  const concepts = listConcepts();
  const maxKeyLen = Math.max(...concepts.map(k => k.length));

  for (const key of concepts) {
    const concept = getConcept(key);
    const padding = ' '.repeat(maxKeyLen - key.length + 4);
    console.log(`    ${pc.cyan(key)}${padding}${pc.dim(concept.summary)}`);
  }

  console.log('');
  console.log(`  Usage: ${pc.cyan('vai explain <topic>')}`);
  console.log('');
}

/**
 * Show a formatted explanation of a concept.
 * @param {string} key - canonical concept key
 */
function showExplanation(key) {
  const concept = getConcept(key);
  if (!concept) return;

  console.log('');
  console.log(`  🧭 ${pc.bold(concept.title)}`);
  console.log(`  ${pc.dim('━'.repeat(concept.title.length + 2))}`);
  console.log('');

  // Indent the content
  const lines = concept.content.split('\n');
  for (const line of lines) {
    console.log(`  ${line}`);
  }

  console.log('');

  if (concept.tryIt && concept.tryIt.length > 0) {
    console.log('');
    console.log(`  ${pc.bold('Try it:')}`);
    for (const cmd of concept.tryIt) {
      console.log(`    ${pc.dim('$')} ${pc.cyan(cmd)}`);
    }
  }

  if (concept.links && concept.links.length > 0) {
    console.log('');
    console.log(`  ${pc.bold('Learn more:')}`);
    for (const link of concept.links) {
      console.log(`    ${link}`);
    }
  }

  console.log('');
  console.log(DISCLAIMER);
  console.log('');
}

/**
 * Show a JSON explanation of a concept.
 * @param {string} key - canonical concept key
 */
function showJsonExplanation(key) {
  const concept = getConcept(key);
  if (!concept) return;

  // Strip ANSI codes for JSON
  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');

  const output = {
    concept: key,
    title: concept.title,
    summary: concept.summary,
    content: stripAnsi(concept.content),
    links: concept.links,
    tryIt: concept.tryIt,
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Find close matches for an unknown concept.
 * @param {string} input
 * @returns {string[]} up to 3 suggestions
 */
function findSuggestions(input) {
  const normalized = input.toLowerCase().trim();
  const allKeys = listConcepts();

  // Simple substring matching
  const matches = allKeys.filter(k =>
    k.includes(normalized) || normalized.includes(k)
  );

  if (matches.length > 0) return matches.slice(0, 3);

  // Levenshtein-ish: just return first 3 concepts as fallback
  return allKeys.slice(0, 3);
}

/**
 * Register the explain command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerExplain(program) {
  program
    .command('explain [concept]')
    .alias('explore')
    .description('Learn about embeddings, reranking, vector search, and more')
    .option('--json', 'Output in JSON format')
    .action((concept, opts) => {
      const telemetry = require('../lib/telemetry');
      telemetry.send('cli_explain', { topic: concept || 'list' });
      if (!concept) {
        // Show topic list
        if (opts.json) {
          const topics = listConcepts().map(key => {
            const c = getConcept(key);
            return { key, title: c.title, summary: c.summary };
          });
          console.log(JSON.stringify({ topics }, null, 2));
        } else {
          showTopicList();
        }
        return;
      }

      const resolved = resolveConcept(concept);
      if (!resolved) {
        const suggestions = findSuggestions(concept);
        console.error('');
        console.error(`  ${pc.red('✗')} Unknown topic: ${pc.bold(concept)}`);
        console.error('');
        if (suggestions.length > 0) {
          console.error('  Did you mean?');
          for (const s of suggestions) {
            console.error(`    ${pc.cyan('vai explain ' + s)}`);
          }
          console.error('');
        }
        console.error(`  Run ${pc.cyan('vai explain')} to see all available topics.`);
        console.error('');
        process.exit(1);
      }

      if (opts.json) {
        showJsonExplanation(resolved);
      } else {
        showExplanation(resolved);
      }
    });
}

module.exports = { registerExplain };
