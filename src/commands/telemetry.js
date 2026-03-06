'use strict';

const pc = require('picocolors');
const { setConfigValue } = require('../lib/config');
const {
  NOTICE_URL,
  getTelemetryStatus,
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

function printOverview() {
  const status = getTelemetryStatus();
  const events = status.events;

  console.log('');
  console.log(`  ${pc.bold('Telemetry:')} ${formatEnabledLabel(status.policy)}`);
  console.log(`  ${pc.bold('Endpoint:')}  ${status.endpoint}`);
  console.log(`  ${pc.bold('Notice:')}    ${formatNoticeLabel(status)}`);
  console.log(`  ${pc.bold('Shared:')}    CLI + desktop use the same preference`);
  console.log('');
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

function printPreview() {
  const payload = preview('cli_command', { command: '<command>' });

  console.log('');
  console.log('  Next telemetry payload (not sent):');
  console.log(`  ${JSON.stringify(payload, null, 2).replace(/\n/g, '\n  ')}`);
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
    .command('status')
    .description('Show a sample telemetry payload without sending it')
    .action(() => {
      printPreview();
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
