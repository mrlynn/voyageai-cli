# Contributing to voyageai-cli

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/mrlynn/voyageai-cli.git
cd voyageai-cli
npm install
npm link  # makes `vai` available globally for testing
```

## Running Tests

```bash
npm test
```

Tests use Node.js built-in test runner (`node:test`). No external test framework needed.

## Project Structure

```
src/
├── cli.js              # Entry point
├── commands/           # One file per command
│   ├── embed.js
│   ├── rerank.js
│   ├── store.js
│   ├── search.js
│   ├── index.js
│   ├── models.js
│   ├── ping.js
│   ├── config.js
│   └── demo.js
└── lib/                # Shared utilities
    ├── api.js          # Voyage AI API client
    ├── mongo.js        # MongoDB connection
    ├── catalog.js      # Model catalog
    ├── config.js       # Config file management
    ├── format.js       # Table formatting
    ├── input.js        # Text input resolution
    ├── ui.js           # Colors, spinners, output helpers
    └── banner.js       # ASCII banner
test/
├── commands/           # Command tests
└── lib/                # Library tests
```

## Adding a New Command

1. Create `src/commands/mycommand.js` exporting a `registerMyCommand(program)` function
2. Register it in `src/cli.js`
3. Add tests in `test/commands/mycommand.test.js`
4. Update README.md with usage examples

## Code Style

- CommonJS (`require`/`module.exports`)
- `'use strict';` at the top of every file
- JSDoc comments on exported functions
- `parseInt(x, 10)` — always include radix
- Errors go to stderr (`console.error`)
- Support `--json` and `--quiet` flags on all commands
- No colors or spinners in `--json` mode

## Pull Requests

- Create a feature branch from `main`
- Include tests for new functionality
- Run `npm test` before submitting
- Write clear commit messages

## Reporting Issues

Open an issue at https://github.com/mrlynn/voyageai-cli/issues with:
- Node.js version (`node --version`)
- OS and version
- Steps to reproduce
- Expected vs actual behavior
