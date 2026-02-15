import * as vscode from 'vscode';
import { SearchResult } from '../client';

export class ResultsProvider implements vscode.TreeDataProvider<ResultItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ResultItem | undefined | null | void> = new vscode.EventEmitter<ResultItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ResultItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private results: SearchResult[] = [];

  setResults(results: SearchResult[]): void {
    this.results = results;
    this._onDidChangeTreeData.fire();
  }

  clear(): void {
    this.results = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ResultItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ResultItem): Promise<ResultItem[]> {
    if (element) {
      // Show result content as child
      return [
        new ResultItem(
          element.result.content.slice(0, 200) + (element.result.content.length > 200 ? '...' : ''),
          vscode.TreeItemCollapsibleState.None,
          element.result,
          'content'
        )
      ];
    }

    // Root: list results
    if (this.results.length === 0) {
      return [
        new ResultItem(
          'No results. Run a query to see results here.',
          vscode.TreeItemCollapsibleState.None,
          null,
          'info'
        )
      ];
    }

    return this.results.map((r, i) => new ResultItem(
      `[${i + 1}] ${r.source}`,
      vscode.TreeItemCollapsibleState.Collapsed,
      r,
      'result'
    ));
  }
}

class ResultItem extends vscode.TreeItem {
  result: SearchResult | null;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    result: SearchResult | null,
    public readonly type: 'result' | 'content' | 'info'
  ) {
    super(label, collapsibleState);

    this.result = result;

    switch (type) {
      case 'result':
        this.iconPath = new vscode.ThemeIcon('file-text');
        this.contextValue = 'searchResult';
        if (result) {
          this.description = `${(result.score * 100).toFixed(1)}%`;
          this.tooltip = `Source: ${result.source}\nScore: ${(result.score * 100).toFixed(1)}%\n\n${result.content.slice(0, 500)}`;

          // Make clickable if we have a file path
          if (result.filePath) {
            this.command = {
              command: 'vai.openResult',
              title: 'Open Result',
              arguments: [result]
            };
          }
        }
        break;

      case 'content':
        this.iconPath = new vscode.ThemeIcon('quote');
        break;

      case 'info':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
    }
  }
}
