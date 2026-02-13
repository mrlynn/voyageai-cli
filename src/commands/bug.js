'use strict';

const os = require('os');
const pc = require('picocolors');
const ui = require('../lib/ui');
const { send: sendTelemetry } = require('../lib/telemetry');

// Try to get package version safely
function getVersion() {
  try {
    return require('../../package.json').version;
  } catch {
    return 'unknown';
  }
}

const GITHUB_ISSUES_URL = 'https://github.com/mrlynn/voyageai-cli/issues/new';
const BUG_API_URL = 'https://vaicli.com/api/bugs';

/**
 * Generate a GitHub issue URL with pre-filled template
 */
function generateGitHubUrl(title, description, context = {}) {
  const issueTitle = encodeURIComponent(`[Bug] ${title || 'Bug Report'}`);
  
  const body = `## Description
${description || 'Describe the bug here...'}

## Steps to Reproduce
1. 
2. 
3. 

## Expected Behavior


## Actual Behavior


## Environment
- **CLI Version:** ${context.cliVersion || getVersion()}
- **Node Version:** ${process.version}
- **Platform:** ${os.platform()} ${os.release()}
- **Arch:** ${os.arch()}
${context.command ? `- **Command:** \`${context.command}\`` : ''}

## Additional Context
${context.errorMessage ? `### Error\n\`\`\`\n${context.errorMessage}\n\`\`\`` : 'Add any other context here.'}
`;

  return `${GITHUB_ISSUES_URL}?title=${issueTitle}&body=${encodeURIComponent(body)}&labels=bug`;
}

/**
 * Submit bug report to API
 */
async function submitBugReport(data) {
  try {
    const response = await fetch(BUG_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        source: 'cli',
        cliVersion: getVersion(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to submit bug report: ${error.message}`);
  }
}

/**
 * Open URL in default browser
 */
function openUrl(url) {
  const { exec } = require('child_process');
  const command = os.platform() === 'darwin' ? 'open' :
                  os.platform() === 'win32' ? 'start' : 'xdg-open';
  exec(`${command} "${url}"`);
}

/**
 * Interactive bug report (when no arguments provided)
 */
async function interactiveBugReport() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise((resolve) => {
    rl.question(prompt, resolve);
  });

  console.log(ui.info('🐛 Bug Reporter'));
  console.log(ui.dim('Report issues with the Vai CLI\n'));

  try {
    const title = await question(ui.label('Title', 'Brief description of the bug') + '\n> ');
    if (!title.trim()) {
      console.log(ui.warn('Bug report cancelled.'));
      rl.close();
      return;
    }

    const description = await question(ui.label('Description', 'What happened?') + '\n> ');
    const steps = await question(ui.label('Steps to Reproduce', 'Optional, press Enter to skip') + '\n> ');
    const email = await question(ui.label('Email', 'Optional, for follow-up') + '\n> ');

    console.log('');
    const method = await question('Submit to:\n  [1] Bug tracker (anonymous)\n  [2] GitHub Issues (public)\n  [3] Both\n> ');

    rl.close();

    const bugData = {
      title: title.trim(),
      description: description.trim(),
      stepsToReproduce: steps.trim() || null,
      email: email.trim() || null,
    };

    if (method === '1' || method === '3') {
      console.log(ui.dim('\nSubmitting to bug tracker...'));
      try {
        const result = await submitBugReport(bugData);
        console.log(ui.success(`Bug submitted! ID: ${result.bugId}`));
      } catch (error) {
        console.log(ui.error(error.message));
      }
    }

    if (method === '2' || method === '3') {
      const url = generateGitHubUrl(bugData.title, bugData.description, {
        cliVersion: getVersion(),
      });
      console.log(ui.dim('\nOpening GitHub...'));
      openUrl(url);
      console.log(ui.success('GitHub issue page opened in browser'));
    }

    if (!['1', '2', '3'].includes(method)) {
      console.log(ui.warn('No submission method selected.'));
    }

  } catch (error) {
    rl.close();
    console.error(ui.error(`Error: ${error.message}`));
  }
}

/**
 * Main bug command
 */
async function bugCommand(args, flags) {
  // --github flag: open GitHub issues directly
  if (flags.github || flags.g) {
    const title = args.join(' ');
    const url = generateGitHubUrl(title, '', { cliVersion: getVersion() });
    console.log(ui.info('Opening GitHub Issues...'));
    openUrl(url);
    return;
  }

  // --quick flag: quick submit with just title
  if (flags.quick || flags.q) {
    const title = args.join(' ');
    if (!title) {
      console.error(ui.error('Please provide a bug title: vai bug --quick "Something broke"'));
      process.exit(1);
    }

    console.log(ui.dim('Submitting quick bug report...'));
    try {
      const result = await submitBugReport({
        title,
        description: title,
      });
      console.log(ui.success(`Bug submitted! ID: ${result.bugId}`));
      console.log(ui.dim(`Create GitHub issue: ${result.githubIssueUrl}`));
    } catch (error) {
      console.error(ui.error(error.message));
      process.exit(1);
    }
    return;
  }

  // If title provided as argument, use quick mode
  if (args.length > 0) {
    const title = args.join(' ');
    console.log(ui.dim('Submitting bug report...'));
    try {
      const result = await submitBugReport({
        title,
        description: title,
      });
      console.log(ui.success(`Bug submitted! ID: ${result.bugId}`));
      console.log(ui.dim('To create a GitHub issue with more details:'));
      console.log(ui.dim(`  ${result.githubIssueUrl.slice(0, 80)}...`));
    } catch (error) {
      console.error(ui.error(error.message));
      process.exit(1);
    }
    return;
  }

  // No arguments: interactive mode
  await interactiveBugReport();
}

/**
 * Register the bug command with Commander
 */
function registerBug(program) {
  program
    .command('bug [title...]')
    .description('Report a bug or issue with the Vai CLI')
    .option('-g, --github', 'Open GitHub Issues in browser')
    .option('-q, --quick', 'Quick submit (title only, no interaction)')
    .action(async (titleParts, options) => {
      sendTelemetry('bug', { 
        method: options.github ? 'github' : options.quick ? 'quick' : 'interactive' 
      });
      
      const args = titleParts || [];
      const flags = {
        github: options.github,
        g: options.github,
        quick: options.quick,
        q: options.quick,
      };
      
      await bugCommand(args, flags);
    });
}

module.exports = { registerBug };
module.exports.bugCommand = bugCommand;
