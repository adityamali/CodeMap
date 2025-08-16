import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class ProjectStructureProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private _workspaceRoot: string | undefined;
    private _excludePatterns: string[] = [];

    constructor(workspaceRoot: string | undefined) {
        this._workspaceRoot = workspaceRoot;
        const config = vscode.workspace.getConfiguration('architectureVisualizer');
        this._excludePatterns = config.get<string[]>('excludePatterns') || ['node_modules', 'dist', '.git', '.vscode'];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!this._workspaceRoot) {
            vscode.window.showInformationMessage('No workspace folder found');
            return Promise.resolve([]);
        }

        if (element) {
            return Promise.resolve(this._getFilesInDirectory(element.resourceUri.fsPath));
        } else {
            return Promise.resolve(this._getFilesInDirectory(this._workspaceRoot));
        }
    }

    private _getFilesInDirectory(dirPath: string): FileItem[] {
        if (!fs.existsSync(dirPath)) {
            return [];
        }

        try {
            const items: FileItem[] = [];
            const files = fs.readdirSync(dirPath);

            // Sort: directories first, then files
            const sortedFiles = files.sort((a, b) => {
                const aPath = path.join(dirPath, a);
                const bPath = path.join(dirPath, b);
                const aIsDir = fs.statSync(aPath).isDirectory();
                const bIsDir = fs.statSync(bPath).isDirectory();

                if (aIsDir && !bIsDir) return -1;
                if (!aIsDir && bIsDir) return 1;
                return a.toLowerCase().localeCompare(b.toLowerCase());
            });

            for (const file of sortedFiles) {
                const filePath = path.join(dirPath, file);

                // Skip excluded patterns
                if (this._shouldExclude(file)) {
                    continue;
                }

                try {
                    const stat = fs.statSync(filePath);
                    const isDirectory = stat.isDirectory();

                    const fileItem = new FileItem(
                        file,
                        vscode.Uri.file(filePath),
                        isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        isDirectory,
                        this._getFileInfo(filePath, stat)
                    );

                    items.push(fileItem);
                } catch (error) {
                    // Skip files that can't be accessed
                    console.warn(`Cannot access ${filePath}:`, error);
                }
            }

            return items;
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
            return [];
        }
    }

    private _shouldExclude(fileName: string): boolean {
        return this._excludePatterns.some(pattern => {
            if (pattern.includes('*')) {
                // Simple glob pattern support
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(fileName);
            }
            return fileName === pattern || fileName.startsWith(pattern);
        });
    }

    private _getFileInfo(filePath: string, stat: fs.Stats): FileInfo {
        const ext = path.extname(filePath).toLowerCase();
        const isCodeFile = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.h'].includes(ext);

        let complexity = 0;
        let lines = 0;
        let fileType: FileType = 'other';

        if (!stat.isDirectory() && isCodeFile) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                lines = content.split('\n').length;
                complexity = this._estimateComplexity(content);
                fileType = this._getFileType(filePath, content);
            } catch (error) {
                // Ignore read errors
            }
        }

        return {
            size: stat.size,
            modified: stat.mtime,
            isCodeFile,
            lines,
            complexity,
            type: fileType
        };
    }

    private _estimateComplexity(content: string): number {
        // Simple complexity estimation based on control flow keywords
        const complexityKeywords = [
            'if', 'else', 'while', 'for', 'switch', 'case', 'try', 'catch',
            'function', 'class', 'return', '&&', '||', '?'
        ];

        let complexity = 1; // Base complexity

        for (const keyword of complexityKeywords) {
            const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
            if (matches) {
                complexity += matches.length;
            }
        }

        return Math.min(complexity, 50); // Cap at 50 for display purposes
    }

    private _getFileType(filePath: string, content: string): FileType {
        const fileName = path.basename(filePath).toLowerCase();

        if (fileName.includes('test') || fileName.includes('spec')) {
            return 'test';
        }
        if (fileName.includes('service') || fileName.includes('api')) {
            return 'service';
        }
        if (fileName.includes('component') || fileName.includes('view')) {
            return 'component';
        }
        if (fileName.includes('util') || fileName.includes('helper')) {
            return 'utility';
        }
        if (fileName.includes('model') || fileName.includes('entity') || fileName.includes('schema')) {
            return 'model';
        }
        if (fileName.includes('config') || fileName.includes('setting')) {
            return 'config';
        }

        // Analyze content for type hints
        if (content.includes('export class') || content.includes('class ')) {
            return 'class';
        }
        if (content.includes('export function') || content.includes('function ')) {
            return 'function';
        }
        if (content.includes('interface ') || content.includes('type ')) {
            return 'type';
        }

        return 'other';
    }
}

type FileType = 'class' | 'function' | 'type' | 'service' | 'component' | 'utility' | 'model' | 'config' | 'test' | 'other';

interface FileInfo {
    size: number;
    modified: Date;
    isCodeFile: boolean;
    lines: number;
    complexity: number;
    type: FileType;
}

export class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly isDirectory: boolean,
        public readonly fileInfo: FileInfo
    ) {
        super(label, collapsibleState);

        this.tooltip = this._generateTooltip();
        this.contextValue = isDirectory ? 'directory' : 'file';
        this.command = isDirectory ? undefined : {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [resourceUri]
        };

        // Set icon based on file type
        this.iconPath = this._getIcon();

        // Add description with file info
        this.description = this._getDescription();
    }

    private _generateTooltip(): string {
        if (this.isDirectory) {
            return `Directory: ${this.label}`;
        }

        const info = this.fileInfo;
        let tooltip = `File: ${this.label}\n`;
        tooltip += `Size: ${this._formatFileSize(info.size)}\n`;
        tooltip += `Modified: ${info.modified.toLocaleDateString()}`;

        if (info.isCodeFile) {
            tooltip += `\nLines: ${info.lines}`;
            tooltip += `\nComplexity: ${info.complexity}`;
            tooltip += `\nType: ${info.type}`;
        }

        return tooltip;
    }

    private _getIcon(): vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri } {
        if (this.isDirectory) {
            return new vscode.ThemeIcon('folder');
        }

        const ext = path.extname(this.label).toLowerCase();
        const fileName = this.label.toLowerCase();

        // File type specific icons
        if (ext === '.ts' || ext === '.tsx') {
            return new vscode.ThemeIcon('symbol-file');
        }
        if (ext === '.js' || ext === '.jsx') {
            return new vscode.ThemeIcon('symbol-file');
        }
        if (ext === '.py') {
            return new vscode.ThemeIcon('symbol-file');
        }
        if (ext === '.java') {
            return new vscode.ThemeIcon('symbol-file');
        }
        if (ext === '.cs') {
            return new vscode.ThemeIcon('symbol-file');
        }
        if (ext === '.json') {
            return new vscode.ThemeIcon('json');
        }
        if (ext === '.md') {
            return new vscode.ThemeIcon('markdown');
        }
        if (fileName.includes('test') || fileName.includes('spec')) {
            return new vscode.ThemeIcon('beaker');
        }
        if (this.fileInfo.type === 'service') {
            return new vscode.ThemeIcon('gear');
        }
        if (this.fileInfo.type === 'component') {
            return new vscode.ThemeIcon('symbol-class');
        }
        if (this.fileInfo.type === 'config') {
            return new vscode.ThemeIcon('settings');
        }

        return new vscode.ThemeIcon('file');
    }

    private _getDescription(): string {
        if (this.isDirectory) {
            return '';
        }

        const info = this.fileInfo;

        if (!info.isCodeFile) {
            return this._formatFileSize(info.size);
        }

        // Show complexity indicator
        let indicator = '';
        if (info.complexity <= 5) {
            indicator = '🟢'; // Low complexity
        } else if (info.complexity <= 10) {
            indicator = '🟡'; // Medium complexity
        } else {
            indicator = '🔴'; // High complexity
        }

        return `${indicator} ${info.lines}L C:${info.complexity}`;
    }

    private _formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}
