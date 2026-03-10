'use strict';

const pc = require('picocolors');
const { setConfigValue } = require('../lib/config');
const {
  NOTICE_URL,
  getTelemetryStatus,
  getTelemetryEvent,
  preview,
  resetNoticeState,
} = require('../lib/telemetry');

function formatEnabledLabel(policy) {
  if (policy.enabled) return 'enabled';
  if (policy.disabledReason === 'VAI_TELEMETRY') return 'disabled by VAI_TELEMETRY';
  if (policy.disabledReason === 'DO_NOT_TRACK') return 'disabled by DO_NOT_TRACK';
  if (policy.disabledReason === 'config') return 'disabled in config';
  return 'disabled';
}

function formatNoticeLabel(status) {
  if (!status.noticeShown) return 'not shown';
  if (!status.noticeShownAt) return 'shown';
  return `shown (${status.noticeShownAt})`;
}

function summarizeEvents(events) {
  const modelFields = ['model', 'models', 'embeddingModel', 'rerankModel', 'llmModel'];
  const modelBearing = events.filter((event) => event.fields.some((field) => modelFields.includes(field)));
  const timed = events.filter((event) => event.fields.includes('durationMs'));
  const lifecycle = events.filter((event) => event.name.startsWith('cli_'));
  const demos = events.filter((event) => event.name.startsWith('demo_'));
  const errors = events.filter((event) => event.name === 'cli_error');

  return {
    total: events.length,
    modelBearing: modelBearing.length,
    timed: timed.length,
    lifecycle: lifecycle.length,
    demos: demos.length,
    errors: errors.length,
    modelBearingEvents: modelBearing,
  };
}

function printEventGroups(events) {
  const summary = summarizeEvents(events);
  console.log(`  ${pc.bold('Coverage summary:')}`);
  console.log(`    Total events:         ${summary.total}`);
  console.log(`    Model-bearing events: ${summary.modelBearing}`);
  console.log(`    Timed events:         ${summary.timed}`);
  console.log(`    CLI events:           ${summary.lifecycle}`);
  console.log(`    Demo events:          ${summary.demos}`);
  console.log(`    Error events:         ${summary.errors}`);
  console.log('');
}

function printModelCoverage(events) {
  const summary = summarizeEvents(events);
  console.log(`  ${pc.bold('Model reporting fields:')}`);
  console.log(`    Normalized: model, modelRole, models, modelCount, local`);
  console.log(`    Legacy compatibility: embeddingModel, rerankModel, llmModel`);
  console.log('');
  console.log(`  ${pc.bold('Model-bearing events:')}`);
  for (const event of summary.modelBearingEvents) {
    console.log(`    ${event.name.padEnd(26)} ${event.fields.join(', ')}`);
  }
  console.log('');
}

function printOverview() {
  const status = getTelemetryStatus();
  const events = status.events;

  console.log('');
  console.log(`  ${pc.bold('Telemetry:')} ${formatEnabledLabel(status.policy)}`);
  console.log(`  ${pc.bold('Endpoint:')}  ${status.endpoint}`);
  console.log(`  ${pc.bold('Notice:')}    ${formatNoticeLabel(status)}`);
  console.log(`  ${pc.bold('Shared:')}    CLI + desktop use the same preference`);
  console.log(`  ${pc.bold('Debug:')}     ${status.policy.debug ? 'print-only mode enabled' : 'network delivery enabled'}`);
  console.log(`  ${pc.bold('Can send:')}  ${status.policy.canSend ? 'yes' : 'no'}`);
  console.log('');
  printEventGroups(events);
  printModelCoverage(events);
  console.log(`  ${pc.bold('Events collected:')}`);
  for (const event of events) {
    const fields = event.fields.length > 0 ? event.fields.join(', ') : 'base fields only';
    console.log(`    ${event.name.padEnd(26)} ${fields}`);
  }
  console.log('');
  console.log(`  Disable: ${pc.cyan('vai telemetry off')}`);
  console.log(`  Details: ${NOTICE_URL}`);
  console.log('');
}

function getSamplePayloads() {
  return [
    {
      label: 'cli_command',
      payload: preview('cli_command', { command: '<command>' }),
    },
    {
      label: 'cli_embed (remote)',
      payload: preview('cli_embed', {
        model: 'voyage-4-large',
        inputType: 'document',
        textCount: 3,
        dimensions: 1024,
      }),
    },
    {
      label: 'cli_embed (local)',
      payload: preview('cli_embed', {
        model: 'voyage-4-nano',
        local: true,
        inputType: 'document',
        textCount: 3,
        dimensions: 1024,
      }),
    },
    {
      label: 'cli_chat',
      payload: preview('cli_chat', {
        provider: 'ollama',
        llmModel: 'qwen3.5:latest',
        embeddingModel: 'voyage-4-nano',
        rerankModel: 'rerank-2.5',
        turnCount: 4,
      }),
    },
  ];
}

function sampleFieldsForEvent(eventName) {
  switch (eventName) {
    case 'cli_command':
      return { command: '<command>' };
    case 'cli_embed':
      return { model: 'voyage-4-large', inputType: 'document', textCount: 3, dimensions: 1024 };
    case 'cli_chat':
      return {
        provider: 'ollama',
        llmModel: 'qwen3.5:latest',
        embeddingModel: 'voyage-4-nano',
        rerankModel: 'rerank-2.5',
        turnCount: 4,
      };
    case 'cli_ingest':
      return { model: 'voyage-4-nano', local: true, inputType: 'document', batchSize: 50, format: 'jsonl', docCount: 12 };
    case 'cli_query':
      return { model: 'voyage-4-large', rerankModel: 'rerank-2.5', rerank: true, limit: 20, topK: 5, resultCount: 5 };
    default:
      return {};
  }
}

function printPreview(eventName) {
  if (eventName) {
    const event = getTelemetryEvent(eventName);
    if (!event) {
      console.log('');
      console.log(`  Unknown telemetry event: ${eventName}`);
      console.log('  Use `vai telemetry` to browse all collected events.');
      console.log('');
      return;
    }

    const payload = preview(eventName, sampleFieldsForEvent(eventName));
    console.log('');
    console.log(`  Sample payload for ${pc.cyan(eventName)} (not sent):`);
    console.log(`  ${JSON.stringify(payload, null, 2).replace(/\n/g, '\n  ')}`);
    console.log('');
    console.log(`  Source: ${event.source}`);
    console.log(`  Fields: ${event.fields.length ? event.fields.join(', ') : 'base fields only'}`);
    console.log('');
    console.log(`  Tip: Set ${pc.cyan('VAI_TELEMETRY_DEBUG=1')} to print payloads to stderr during usage.`);
    console.log('');
    return;
  }

  console.log('');
  console.log('  Sample telemetry payloads (not sent):');
  console.log('');
  for (const sample of getSamplePayloads()) {
    console.log(`  ${pc.bold(sample.label)}`);
    console.log(`  ${JSON.stringify(sample.payload, null, 2).replace(/\n/g, '\n  ')}`);
    console.log('');
  }
  console.log('  Pass an event name for a focused preview:');
  console.log(`    ${pc.cyan('vai telemetry status cli_chat')}`);
  console.log('');
  console.log(`  Tip: Set ${pc.cyan('VAI_TELEMETRY_DEBUG=1')} to print payloads to stderr during usage.`);
  console.log('');
}

function registerTelemetry(program) {
  const telemetry = program
    .command('telemetry')
    .description('Inspect and manage anonymous telemetry settings');

  telemetry
    .action(() => {
      printOverview();
    });

  telemetry
    .command('on')
    .description('Enable telemetry')
    .action(() => {
      setConfigValue('telemetry', true);
      console.log('Telemetry enabled.');
    });

  telemetry
    .command('off')
    .description('Disable telemetry')
    .action(() => {
      setConfigValue('telemetry', false);
      console.log('Telemetry disabled.');
    });

  telemetry
    .command('status [event]')
    .description('Show sample telemetry payloads without sending them')
    .action((event) => {
      printPreview(event);
    });

  telemetry
    .command('reset')
    .description('Clear the saved telemetry notice state')
    .action(() => {
      resetNoticeState();
      console.log('Telemetry notice state cleared. The notice will be shown again on the next launch.');
    });
}

module.exports = { registerTelemetry };
