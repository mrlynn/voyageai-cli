'use strict';

const pc = require('picocolors');

/**
 * Generate bash completion script for vai CLI.
 * @returns {string}
 */
function generateBashCompletions() {
  return `#!/bin/bash
# vai bash completion script
# Install: vai completions bash >> ~/.bashrc && source ~/.bashrc
# Or:      vai completions bash > /usr/local/etc/bash_completion.d/vai

_vai_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  # Top-level commands
  commands="embed rerank store search index models ping config demo explain similarity ingest completions help"

  # Subcommands
  local index_subs="create list delete"
  local config_subs="set get delete path reset"

  # Global flags
  local global_flags="--json --quiet --help --version"

  case "\${COMP_WORDS[1]}" in
    embed)
      COMPREPLY=( \$(compgen -W "--model --input-type --dimensions --file --output-format --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    rerank)
      COMPREPLY=( \$(compgen -W "--query --documents --documents-file --model --top-k --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    store)
      COMPREPLY=( \$(compgen -W "--db --collection --field --text --file --model --input-type --dimensions --metadata --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    search)
      COMPREPLY=( \$(compgen -W "--query --db --collection --index --field --model --input-type --dimensions --limit --min-score --num-candidates --filter --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    index)
      if [[ \$COMP_CWORD -eq 2 ]]; then
        COMPREPLY=( \$(compgen -W "\$index_subs" -- "\$cur") )
      else
        case "\${COMP_WORDS[2]}" in
          create)
            COMPREPLY=( \$(compgen -W "--db --collection --field --dimensions --similarity --index-name --json --quiet --help" -- "\$cur") )
            ;;
          list)
            COMPREPLY=( \$(compgen -W "--db --collection --json --quiet --help" -- "\$cur") )
            ;;
          delete)
            COMPREPLY=( \$(compgen -W "--db --collection --index-name --json --quiet --help" -- "\$cur") )
            ;;
        esac
      fi
      return 0
      ;;
    models)
      COMPREPLY=( \$(compgen -W "--type --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    ping)
      COMPREPLY=( \$(compgen -W "--json --quiet --help" -- "\$cur") )
      return 0
      ;;
    config)
      if [[ \$COMP_CWORD -eq 2 ]]; then
        COMPREPLY=( \$(compgen -W "\$config_subs" -- "\$cur") )
      else
        case "\${COMP_WORDS[2]}" in
          set)
            COMPREPLY=( \$(compgen -W "api-key mongodb-uri base-url default-model --stdin --help" -- "\$cur") )
            ;;
          get|delete)
            COMPREPLY=( \$(compgen -W "api-key mongodb-uri base-url default-model --help" -- "\$cur") )
            ;;
        esac
      fi
      return 0
      ;;
    demo)
      COMPREPLY=( \$(compgen -W "--no-pause --skip-pipeline --keep --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    explain)
      COMPREPLY=( \$(compgen -W "embeddings reranking vector-search rag cosine-similarity two-stage-retrieval input-type models api-keys api-access batch-processing --help" -- "\$cur") )
      return 0
      ;;
    similarity)
      COMPREPLY=( \$(compgen -W "--against --file1 --file2 --model --dimensions --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    ingest)
      COMPREPLY=( \$(compgen -W "--file --db --collection --field --model --input-type --dimensions --batch-size --text-field --text-column --strict --dry-run --json --quiet --help" -- "\$cur") )
      return 0
      ;;
    completions)
      COMPREPLY=( \$(compgen -W "bash zsh --help" -- "\$cur") )
      return 0
      ;;
  esac

  # Complete top-level commands and global flags
  if [[ \$COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( \$(compgen -W "\$commands \$global_flags" -- "\$cur") )
    return 0
  fi

  # Model name completions
  case "\$prev" in
    --model|-m)
      COMPREPLY=( \$(compgen -W "voyage-4-large voyage-4 voyage-4-lite voyage-code-3 voyage-finance-2 voyage-law-2 voyage-multimodal-3.5 rerank-2.5 rerank-2.5-lite" -- "\$cur") )
      return 0
      ;;
    --input-type)
      COMPREPLY=( \$(compgen -W "query document" -- "\$cur") )
      return 0
      ;;
    --type|-t)
      COMPREPLY=( \$(compgen -W "embedding reranking all" -- "\$cur") )
      return 0
      ;;
    --similarity|-s)
      COMPREPLY=( \$(compgen -W "cosine dotProduct euclidean" -- "\$cur") )
      return 0
      ;;
    --output-format|-o)
      COMPREPLY=( \$(compgen -W "json array" -- "\$cur") )
      return 0
      ;;
    --file|-f|--documents-file|--file1|--file2)
      COMPREPLY=( \$(compgen -f -- "\$cur") )
      return 0
      ;;
  esac
}

complete -F _vai_completions vai
`;
}

/**
 * Generate zsh completion script for vai CLI.
 * @returns {string}
 */
function generateZshCompletions() {
  return `#compdef vai
# vai zsh completion script
# Install: vai completions zsh > ~/.zsh/completions/_vai && source ~/.zshrc
# Or:      vai completions zsh > /usr/local/share/zsh/site-functions/_vai

_vai() {
  local -a commands
  commands=(
    'embed:Generate embeddings for text'
    'rerank:Rerank documents against a query'
    'store:Embed text and store in MongoDB Atlas'
    'search:Vector search against Atlas collection'
    'index:Manage Atlas Vector Search indexes'
    'models:List available Voyage AI models'
    'ping:Test connectivity to Voyage AI API'
    'config:Manage persistent configuration'
    'demo:Interactive guided walkthrough'
    'explain:Learn about AI and vector search concepts'
    'similarity:Compute cosine similarity between texts'
    'ingest:Bulk import documents with progress'
    'completions:Generate shell completion scripts'
    'help:Display help for command'
  )

  local -a models
  models=(voyage-4-large voyage-4 voyage-4-lite voyage-code-3 voyage-finance-2 voyage-law-2 voyage-multimodal-3.5 rerank-2.5 rerank-2.5-lite)

  local -a explain_topics
  explain_topics=(embeddings reranking vector-search rag cosine-similarity two-stage-retrieval input-type models api-keys api-access batch-processing)

  _arguments -C \\
    '(-V --version)'{-V,--version}'[output the version number]' \\
    '(-h --help)'{-h,--help}'[display help]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case \$state in
    command)
      _describe 'vai command' commands
      ;;
    args)
      case \$words[1] in
        embed)
          _arguments \\
            '(-m --model)'{-m,--model}'[Embedding model]:model:(\$models)' \\
            '(-t --input-type)'{-t,--input-type}'[Input type]:type:(query document)' \\
            '(-d --dimensions)'{-d,--dimensions}'[Output dimensions]:dimensions:' \\
            '(-f --file)'{-f,--file}'[Read text from file]:file:_files' \\
            '(-o --output-format)'{-o,--output-format}'[Output format]:format:(json array)' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]' \\
            '1:text:'
          ;;
        rerank)
          _arguments \\
            '--query[Search query]:query:' \\
            '--documents[Documents to rerank]:document:' \\
            '--documents-file[File with documents]:file:_files' \\
            '(-m --model)'{-m,--model}'[Reranking model]:model:(\$models)' \\
            '(-k --top-k)'{-k,--top-k}'[Return top K results]:k:' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
          ;;
        store)
          _arguments \\
            '--db[Database name]:database:' \\
            '--collection[Collection name]:collection:' \\
            '--field[Embedding field name]:field:' \\
            '--text[Text to embed and store]:text:' \\
            '(-f --file)'{-f,--file}'[File to embed and store]:file:_files' \\
            '(-m --model)'{-m,--model}'[Embedding model]:model:(\$models)' \\
            '--input-type[Input type]:type:(query document)' \\
            '(-d --dimensions)'{-d,--dimensions}'[Output dimensions]:dimensions:' \\
            '--metadata[Additional metadata as JSON]:json:' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
          ;;
        search)
          _arguments \\
            '--query[Search query text]:query:' \\
            '--db[Database name]:database:' \\
            '--collection[Collection name]:collection:' \\
            '--index[Vector search index name]:index:' \\
            '--field[Embedding field name]:field:' \\
            '(-m --model)'{-m,--model}'[Embedding model]:model:(\$models)' \\
            '--input-type[Input type]:type:(query document)' \\
            '(-d --dimensions)'{-d,--dimensions}'[Output dimensions]:dimensions:' \\
            '(-l --limit)'{-l,--limit}'[Maximum results]:limit:' \\
            '--min-score[Minimum similarity score]:score:' \\
            '--num-candidates[Number of ANN candidates]:n:' \\
            '--filter[Pre-filter JSON]:json:' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
          ;;
        index)
          local -a index_commands
          index_commands=(
            'create:Create a vector search index'
            'list:List vector search indexes'
            'delete:Delete a vector search index'
          )
          _arguments -C \\
            '1:index command:->index_command' \\
            '*::arg:->index_args'
          case \$state in
            index_command)
              _describe 'index command' index_commands
              ;;
            index_args)
              case \$words[1] in
                create)
                  _arguments \\
                    '--db[Database name]:database:' \\
                    '--collection[Collection name]:collection:' \\
                    '--field[Embedding field name]:field:' \\
                    '(-d --dimensions)'{-d,--dimensions}'[Vector dimensions]:dimensions:' \\
                    '(-s --similarity)'{-s,--similarity}'[Similarity function]:similarity:(cosine dotProduct euclidean)' \\
                    '(-n --index-name)'{-n,--index-name}'[Index name]:name:' \\
                    '--json[Machine-readable JSON output]' \\
                    '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
                  ;;
                list)
                  _arguments \\
                    '--db[Database name]:database:' \\
                    '--collection[Collection name]:collection:' \\
                    '--json[Machine-readable JSON output]' \\
                    '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
                  ;;
                delete)
                  _arguments \\
                    '--db[Database name]:database:' \\
                    '--collection[Collection name]:collection:' \\
                    '--index-name[Index name]:name:' \\
                    '--json[Machine-readable JSON output]' \\
                    '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
                  ;;
              esac
              ;;
          esac
          ;;
        models)
          _arguments \\
            '(-t --type)'{-t,--type}'[Filter by type]:type:(embedding reranking all)' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
          ;;
        ping)
          _arguments \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
          ;;
        config)
          local -a config_commands
          config_commands=(
            'set:Set a config value'
            'get:Show current configuration'
            'delete:Remove a config value'
            'path:Show config file path'
            'reset:Reset all configuration'
          )
          _arguments -C \\
            '1:config command:->config_command' \\
            '*::arg:->config_args'
          case \$state in
            config_command)
              _describe 'config command' config_commands
              ;;
            config_args)
              case \$words[1] in
                set)
                  _arguments \\
                    '1:key:(api-key mongodb-uri base-url default-model)' \\
                    '2:value:' \\
                    '--stdin[Read value from stdin]'
                  ;;
                delete)
                  _arguments \\
                    '1:key:(api-key mongodb-uri base-url default-model)'
                  ;;
              esac
              ;;
          esac
          ;;
        demo)
          _arguments \\
            '--no-pause[Skip pauses between steps]' \\
            '--skip-pipeline[Skip MongoDB pipeline steps]' \\
            '--keep[Keep demo data after completion]' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
          ;;
        explain)
          _arguments \\
            '1:topic:(\$explain_topics)'
          ;;
        similarity)
          _arguments \\
            '--against[Compare against multiple texts]:text:' \\
            '--file1[Read text A from file]:file:_files' \\
            '--file2[Read text B from file]:file:_files' \\
            '(-m --model)'{-m,--model}'[Embedding model]:model:(\$models)' \\
            '--dimensions[Output dimensions]:dimensions:' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]' \\
            '*:text:'
          ;;
        ingest)
          _arguments \\
            '--file[Input file]:file:_files' \\
            '--db[Database name]:database:' \\
            '--collection[Collection name]:collection:' \\
            '--field[Embedding field name]:field:' \\
            '(-m --model)'{-m,--model}'[Embedding model]:model:(\$models)' \\
            '--input-type[Input type]:type:(query document)' \\
            '(-d --dimensions)'{-d,--dimensions}'[Output dimensions]:dimensions:' \\
            '--batch-size[Documents per batch]:size:' \\
            '--text-field[JSON field containing text]:field:' \\
            '--text-column[CSV column to embed]:column:' \\
            '--strict[Abort on first batch error]' \\
            '--dry-run[Validate only, no API calls]' \\
            '--json[Machine-readable JSON output]' \\
            '(-q --quiet)'{-q,--quiet}'[Suppress non-essential output]'
          ;;
        completions)
          _arguments \\
            '1:shell:(bash zsh)'
          ;;
      esac
      ;;
  esac
}

_vai "\$@"
`;
}

/**
 * Show installation instructions for shell completions.
 * @param {string} shell - 'bash' or 'zsh'
 */
function showInstallInstructions(shell) {
  console.log('');
  if (shell === 'bash') {
    console.log(`  ${pc.bold('Install bash completions:')}`);
    console.log('');
    console.log(`  ${pc.cyan('# Add to your ~/.bashrc (or ~/.bash_profile on macOS)')}`);
    console.log(`  ${pc.white('vai completions bash >> ~/.bashrc')}`);
    console.log(`  ${pc.white('source ~/.bashrc')}`);
    console.log('');
    console.log(`  ${pc.cyan('# Or install system-wide (Linux)')}`);
    console.log(`  ${pc.white('vai completions bash > /etc/bash_completion.d/vai')}`);
    console.log('');
    console.log(`  ${pc.cyan('# Or with Homebrew (macOS)')}`);
    console.log(`  ${pc.white('vai completions bash > $(brew --prefix)/etc/bash_completion.d/vai')}`);
  } else {
    console.log(`  ${pc.bold('Install zsh completions:')}`);
    console.log('');
    console.log(`  ${pc.cyan('# Create completions directory if needed')}`);
    console.log(`  ${pc.white('mkdir -p ~/.zsh/completions')}`);
    console.log('');
    console.log(`  ${pc.cyan('# Add to fpath in your ~/.zshrc (if not already there)')}`);
    console.log(`  ${pc.white('echo \'fpath=(~/.zsh/completions $fpath)\' >> ~/.zshrc')}`);
    console.log(`  ${pc.white('echo \'autoload -Uz compinit && compinit\' >> ~/.zshrc')}`);
    console.log('');
    console.log(`  ${pc.cyan('# Generate the completion file')}`);
    console.log(`  ${pc.white('vai completions zsh > ~/.zsh/completions/_vai')}`);
    console.log(`  ${pc.white('source ~/.zshrc')}`);
    console.log('');
    console.log(`  ${pc.cyan('# Or install system-wide')}`);
    console.log(`  ${pc.white('vai completions zsh > /usr/local/share/zsh/site-functions/_vai')}`);
  }
  console.log('');
}

/**
 * Register the completions command on a Commander program.
 * @param {import('commander').Command} program
 */
function registerCompletions(program) {
  program
    .command('completions [shell]')
    .description('Generate shell completion scripts (bash or zsh)')
    .action((shell) => {
      if (!shell) {
        console.log('');
        console.log(`  ${pc.bold('Usage:')} vai completions ${pc.cyan('<bash|zsh>')}`);
        console.log('');
        console.log('  Outputs a completion script for the specified shell.');
        console.log('  Redirect the output to the appropriate file for your shell.');
        console.log('');
        showInstallInstructions('bash');
        showInstallInstructions('zsh');
        return;
      }

      const normalized = shell.toLowerCase().trim();

      if (normalized === 'bash') {
        process.stdout.write(generateBashCompletions());
      } else if (normalized === 'zsh') {
        process.stdout.write(generateZshCompletions());
      } else {
        console.error(`  ${pc.red('✗')} Unknown shell: ${shell}. Supported: bash, zsh`);
        process.exit(1);
      }
    });
}

module.exports = { registerCompletions, generateBashCompletions, generateZshCompletions };
