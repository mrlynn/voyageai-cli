import * as vscode from 'vscode';
import { VaiClient } from '../client';

export class CollectionsProvider implements vscode.TreeDataProvider<CollectionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CollectionItem | undefined | null | void> = new vscode.EventEmitter<CollectionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<CollectionItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private client: VaiClient;

  constructor(client: VaiClient) {
    this.client = client;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CollectionItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CollectionItem): Promise<CollectionItem[]> {
    if (element) {
      // Collection details
      return [
        new CollectionItem(
          `Documents: ${element.docCount || 'unknown'}`,
          vscode.TreeItemCollapsibleState.None,
          'info'
        ),
        new CollectionItem(
          `Index: ${element.indexName || 'none'}`,
          vscode.TreeItemCollapsibleState.None,
          'info'
        )
      ];
    }

    // Root: list collections
    try {
      const collections = await this.client.getCollections();

      if (collections.length === 0) {
        return [
          new CollectionItem(
            'No collections found',
            vscode.TreeItemCollapsibleState.None,
            'info'
          )
        ];
      }

      return collections.map(c => new CollectionItem(
        c.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        'collection',
        c.count,
        c.vectorIndex
      ));
    } catch (error: any) {
      return [
        new CollectionItem(
          `Error: ${error.message}`,
          vscode.TreeItemCollapsibleState.None,
          'error'
        )
      ];
    }
  }
}

class CollectionItem extends vscode.TreeItem {
  docCount?: number;
  indexName?: string;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'collection' | 'info' | 'error',
    docCount?: number,
    indexName?: string
  ) {
    super(label, collapsibleState);

    this.docCount = docCount;
    this.indexName = indexName;

    switch (type) {
      case 'collection':
        this.iconPath = new vscode.ThemeIcon('database');
        this.contextValue = 'collection';
        this.tooltip = `${label} - ${docCount || 0} documents`;
        break;
      case 'info':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error');
        break;
    }
  }
}
