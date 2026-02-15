import * as vscode from 'vscode';
import { VaiClient } from './client';
import { CollectionsProvider } from './views/collections';
import { ResultsProvider } from './views/results';
import { StatusProvider } from './views/status';
import { VaiServer } from './server';

let vaiClient: VaiClient;
let vaiServer: VaiServer;
let collectionsProvider: CollectionsProvider;
let resultsProvider: ResultsProvider;
let statusProvider: StatusProvider;

export async function activate(context: vscode.ExtensionContext) {
  console.log('vai extension activating...');

  // Initialize client and server
  vaiClient = new VaiClient(context);
  vaiServer = new VaiServer(context);

  // Initialize tree view providers
  collectionsProvider = new CollectionsProvider(vaiClient);
  resultsProvider = new ResultsProvider();
  statusProvider = new StatusProvider(vaiServer);

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vai.collections', collectionsProvider),
    vscode.window.registerTreeDataProvider('vai.results', resultsProvider),
    vscode.window.registerTreeDataProvider('vai.status', statusProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('vai.query', () => queryCommand()),
    vscode.commands.registerCommand('vai.indexWorkspace', () => indexWorkspaceCommand()),
    vscode.commands.registerCommand('vai.searchCodebase', () => searchCodebaseCommand()),
    vscode.commands.registerCommand('vai.explainSelection', () => explainSelectionCommand()),
    vscode.commands.registerCommand('vai.similarity', () => similarityCommand()),
    vscode.commands.registerCommand('vai.showCollections', () => collectionsProvider.refresh()),
    vscode.commands.registerCommand('vai.showModels', () => showModelsCommand()),
    vscode.commands.registerCommand('vai.configure', () => configureCommand()),
    vscode.commands.registerCommand('vai.startServer', () => startServerCommand()),
    vscode.commands.registerCommand('vai.stopServer', () => stopServerCommand()),
    vscode.commands.registerCommand('vai.openResult', (result) => openResultCommand(result))
  );

  // Auto-start server if configured
  const config = vscode.workspace.getConfiguration('vai');
  if (config.get<boolean>('autoStartServer')) {
    await vaiServer.start();
    statusProvider.refresh();
  }

  // Status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(search) vai';
  statusBarItem.tooltip = 'vai - Voyage AI Semantic Search';
  statusBarItem.command = 'vai.query';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  console.log('vai extension activated');
}

export function deactivate() {
  if (vaiServer) {
    vaiServer.stop();
  }
}

// Command implementations

async function queryCommand() {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter your semantic search query',
    placeHolder: 'e.g., How do I handle authentication errors?'
  });

  if (!query) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Searching...',
    cancellable: false
  }, async () => {
    try {
      const results = await vaiClient.query(query);
      resultsProvider.setResults(results);
      vscode.commands.executeCommand('vai.results.focus');
    } catch (error: any) {
      vscode.window.showErrorMessage(`Query failed: ${error.message}`);
    }
  });
}

async function indexWorkspaceCommand() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showWarningMessage('No workspace folder open');
    return;
  }

  const options = await vscode.window.showQuickPick([
    { label: 'Index all files', description: 'Index entire workspace', value: 'all' },
    { label: 'Index documentation', description: '*.md, *.txt, *.rst files', value: 'docs' },
    { label: 'Index source code', description: 'Code files only', value: 'code' },
    { label: 'Custom pattern', description: 'Specify glob pattern', value: 'custom' }
  ], { placeHolder: 'What would you like to index?' });

  if (!options) return;

  let pattern = '**/*';
  if (options.value === 'docs') {
    pattern = '**/*.{md,txt,rst,adoc}';
  } else if (options.value === 'code') {
    pattern = '**/*.{js,ts,py,go,rs,java,c,cpp,h,hpp,cs,rb,php}';
  } else if (options.value === 'custom') {
    const customPattern = await vscode.window.showInputBox({
      prompt: 'Enter glob pattern',
      value: '**/*.md'
    });
    if (!customPattern) return;
    pattern = customPattern;
  }

  const db = await getConfiguredDb();
  const collection = await getConfiguredCollection();
  if (!db || !collection) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Indexing workspace...',
    cancellable: true
  }, async (progress, token) => {
    try {
      const result = await vaiClient.indexWorkspace(
        workspaceFolders[0].uri.fsPath,
        pattern,
        db,
        collection,
        (current, total) => {
          progress.report({
            message: `${current}/${total} files`,
            increment: (1 / total) * 100
          });
        }
      );
      vscode.window.showInformationMessage(
        `Indexed ${result.filesProcessed} files (${result.chunksCreated} chunks)`
      );
      collectionsProvider.refresh();
    } catch (error: any) {
      if (!token.isCancellationRequested) {
        vscode.window.showErrorMessage(`Indexing failed: ${error.message}`);
      }
    }
  });
}

async function searchCodebaseCommand() {
  const editor = vscode.window.activeTextEditor;
  let initialQuery = '';

  if (editor && editor.selection && !editor.selection.isEmpty) {
    initialQuery = editor.document.getText(editor.selection);
  }

  const query = await vscode.window.showInputBox({
    prompt: 'Search codebase semantically',
    value: initialQuery,
    placeHolder: 'e.g., database connection handling'
  });

  if (!query) return;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Searching codebase...',
    cancellable: false
  }, async () => {
    try {
      const results = await vaiClient.searchCodebase(query);
      resultsProvider.setResults(results);
      vscode.commands.executeCommand('vai.results.focus');
    } catch (error: any) {
      vscode.window.showErrorMessage(`Search failed: ${error.message}`);
    }
  });
}

async function explainSelectionCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showWarningMessage('Please select some code to explain');
    return;
  }

  const selectedText = editor.document.getText(editor.selection);
  const languageId = editor.document.languageId;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Finding relevant context...',
    cancellable: false
  }, async () => {
    try {
      const results = await vaiClient.explainCode(selectedText, languageId);

      // Show results in a new document
      const doc = await vscode.workspace.openTextDocument({
        content: formatExplanation(selectedText, results),
        language: 'markdown'
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Explanation failed: ${error.message}`);
    }
  });
}

async function similarityCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showWarningMessage('Please select text to compare');
    return;
  }

  const text1 = editor.document.getText(editor.selection);

  const text2 = await vscode.window.showInputBox({
    prompt: 'Enter text to compare against selected text',
    placeHolder: 'Text to compare...'
  });

  if (!text2) return;

  try {
    const similarity = await vaiClient.similarity(text1, text2);
    const percentage = (similarity * 100).toFixed(1);
    vscode.window.showInformationMessage(`Similarity: ${percentage}%`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Similarity check failed: ${error.message}`);
  }
}

async function showModelsCommand() {
  try {
    const models = await vaiClient.getModels();

    const items = models.map(m => ({
      label: m.name,
      description: `$${m.price}/M tokens`,
      detail: m.description
    }));

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Available Voyage AI models',
      matchOnDescription: true,
      matchOnDetail: true
    });
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to load models: ${error.message}`);
  }
}

async function configureCommand() {
  const options = [
    { label: 'Set API Key', value: 'apiKey' },
    { label: 'Set MongoDB URI', value: 'mongodbUri' },
    { label: 'Set Default Database', value: 'defaultDb' },
    { label: 'Set Default Collection', value: 'defaultCollection' },
    { label: 'Set Embedding Model', value: 'embeddingModel' },
    { label: 'Open Settings', value: 'settings' }
  ];

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: 'Configure vai'
  });

  if (!selected) return;

  if (selected.value === 'settings') {
    vscode.commands.executeCommand('workbench.action.openSettings', 'vai');
    return;
  }

  const config = vscode.workspace.getConfiguration('vai');
  const currentValue = config.get<string>(selected.value) || '';

  const newValue = await vscode.window.showInputBox({
    prompt: `Enter ${selected.label}`,
    value: currentValue,
    password: selected.value === 'apiKey' || selected.value === 'mongodbUri'
  });

  if (newValue !== undefined) {
    await config.update(selected.value, newValue, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`${selected.label} updated`);
  }
}

async function startServerCommand() {
  try {
    await vaiServer.start();
    statusProvider.refresh();
    vscode.window.showInformationMessage('vai MCP server started');
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to start server: ${error.message}`);
  }
}

async function stopServerCommand() {
  vaiServer.stop();
  statusProvider.refresh();
  vscode.window.showInformationMessage('vai MCP server stopped');
}

function openResultCommand(result: any) {
  if (result.filePath) {
    const uri = vscode.Uri.file(result.filePath);
    vscode.window.showTextDocument(uri, {
      selection: result.lineNumber ? new vscode.Range(result.lineNumber - 1, 0, result.lineNumber - 1, 0) : undefined
    });
  }
}

// Helper functions

async function getConfiguredDb(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('vai');
  let db = config.get<string>('defaultDb');

  if (!db) {
    db = await vscode.window.showInputBox({
      prompt: 'Enter MongoDB database name',
      placeHolder: 'myapp'
    });
    if (db) {
      await config.update('defaultDb', db, vscode.ConfigurationTarget.Global);
    }
  }

  return db;
}

async function getConfiguredCollection(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('vai');
  let collection = config.get<string>('defaultCollection');

  if (!collection) {
    collection = await vscode.window.showInputBox({
      prompt: 'Enter collection name',
      placeHolder: 'knowledge'
    });
    if (collection) {
      await config.update('defaultCollection', collection, vscode.ConfigurationTarget.Global);
    }
  }

  return collection;
}

function formatExplanation(code: string, results: any[]): string {
  let md = '# Code Context\n\n';
  md += '## Selected Code\n\n```\n' + code + '\n```\n\n';
  md += '## Related Context from Knowledge Base\n\n';

  for (const result of results) {
    md += `### ${result.source}\n\n`;
    md += `**Relevance:** ${(result.score * 100).toFixed(1)}%\n\n`;
    md += result.content + '\n\n';
    md += '---\n\n';
  }

  return md;
}
