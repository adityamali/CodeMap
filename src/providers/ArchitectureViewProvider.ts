import * as vscode from 'vscode';
import { OpenAIService } from '../services/OpenAIService';
import { ProjectAnalyzer } from '../services/ProjectAnalyzer';
import { VisualizationGenerator } from '../services/VisualizationGenerator';

export class ArchitectureViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codemap.sidebar';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _openaiService: OpenAIService,
        private readonly _projectAnalyzer: ProjectAnalyzer,
        private readonly _visualizationGenerator: VisualizationGenerator
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'dist'),
                vscode.Uri.joinPath(this._extensionUri, 'dist', 'vendor')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                this._handleWebviewMessage(message);
            }
        );
    }

    public showVisualization(type: string, data: any) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'showVisualization',
                type: type,
                data: data
            });
        }
    }

    public showAISuggestions(suggestions: any[]) {
        if (this._view) {
            this._view.webview.postMessage({
                command: 'showAISuggestions',
                suggestions: suggestions
            });
        }
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private async _handleWebviewMessage(message: any) {
        switch (message.command) {
            case 'generateVisualization':
                await this._generateVisualization(message.type);
                break;
            case 'authenticateOpenAI':
                await vscode.commands.executeCommand('architectureVisualizer.authenticate');
                break;
            case 'analyzeWithAI':
                await vscode.commands.executeCommand('architectureVisualizer.analyzeWithAI');
                break;
            case 'exportVisualization':
                await this._exportVisualization(message.type, message.data);
                break;
        }
    }

    private async _generateVisualization(type: string) {
        try {
            let analysis: any;
            let visualization: any;

            switch (type) {
                case 'architecture':
                    analysis = await this._projectAnalyzer.analyzeProjectStructure();
                    visualization = await this._visualizationGenerator.generateArchitectureDiagram(analysis);
                    break;
                case 'dataflow':
                    analysis = await this._projectAnalyzer.analyzeDataFlow();
                    visualization = await this._visualizationGenerator.generateDataFlowDiagram(analysis);
                    break;
                case 'class':
                    analysis = await this._projectAnalyzer.analyzeClassStructure();
                    visualization = await this._visualizationGenerator.generateClassDiagram(analysis);
                    break;
                case 'heatmap':
                    analysis = await this._projectAnalyzer.analyzeComplexity();
                    visualization = await this._visualizationGenerator.generateHeatmap(analysis);
                    break;
            }

            this.showVisualization(type, visualization);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate ${type}: ${error}`);
        }
    }

    private async _exportVisualization(type: string, data: any) {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`${type}-diagram.svg`),
            filters: {
                'SVG Files': ['svg'],
                'PNG Files': ['png'],
                'JSON Files': ['json']
            }
        });

        if (uri) {
            // Export logic would go here
            vscode.window.showInformationMessage(`Visualization exported to ${uri.fsPath}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
    // Get URIs for resources
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.bundle.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.css'));
    // Load D3 copied into dist/vendor by webpack
    const d3LocalUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'vendor', 'd3.min.js'));

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}' ${webview.cspSource};">
    <link href="${styleUri}" rel="stylesheet">
    <title>CodeMap</title>
</head>
<body>
    <div class="container">
        <!-- Header with glassmorphism design -->
        <div class="glass-header">
            <div class="header-content">
                <div class="logo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <h2>CodeMap</h2>
                </div>
                <div class="auth-status" id="authStatus">
                    <div class="auth-indicator offline" id="authIndicator"></div>
                    <span id="authText">Not authenticated</span>
                </div>
            </div>
        </div>

        <!-- Main content area -->
        <div class="content-area">
            <!-- Control Panel -->
            <div class="glass-panel control-panel">
                <h3>Generate Visualizations</h3>

                <div class="button-group">
                    <button class="glass-button" id="btnArchitecture">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                        </svg>
                        Architecture
                    </button>

                    <button class="glass-button" id="btnDataflow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                        </svg>
                        Data Flow
                    </button>

                    <button class="glass-button" id="btnClass">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                        </svg>
                        Class Diagram
                    </button>

                    <button class="glass-button" id="btnHeatmap">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        Heatmap
                    </button>
                </div>

                <!-- AI Section -->
                <div class="ai-section">
                    <h4>AI Analysis</h4>
                    <button class="glass-button ai-button" id="authButton">
                        🔑 Configure API Key
                    </button>
                    <button class="glass-button ai-button" id="analyzeButton" disabled>
                        🤖 Analyze Architecture
                    </button>
                </div>
            </div>

            <!-- Visualization Area -->
            <div class="glass-panel visualization-panel">
                <div class="viz-header">
                    <h3 id="vizTitle">Select a visualization type</h3>
                    <div class="viz-controls">
                        <button class="control-btn" id="btnZoomIn">🔍+</button>
                        <button class="control-btn" id="btnZoomOut">🔍-</button>
                        <button class="control-btn" id="btnResetZoom">⌂</button>
                        <button class="control-btn" id="btnExport">💾</button>
                    </div>
                </div>

                <div class="visualization-container" id="vizContainer">
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <p>Generate a visualization to get started</p>
                    </div>
                </div>

                <!-- Loading overlay -->
                <div class="loading-overlay" id="loadingOverlay">
                    <div class="loading-spinner"></div>
                    <p>Generating visualization...</p>
                </div>
            </div>

            <!-- AI Suggestions Panel -->
            <div class="glass-panel suggestions-panel" id="suggestionsPanel" style="display: none;">
                <h3>🤖 AI Suggestions</h3>
                <div class="suggestions-list" id="suggestionsList">
                    <!-- AI suggestions will be populated here -->
                </div>
            </div>
        </div>
    </div>

    <!-- Load D3 from dist/vendor dependency -->
    <script nonce="${nonce}" src="${d3LocalUri}" onload="console.log('D3 loaded successfully (vendor)')" onerror="console.error('Failed to load D3 from vendor path')"></script>
    <script nonce="${nonce}" src="${scriptUri}" onload="console.log('Webview script loaded successfully')" onerror="console.error('Failed to load Webview script')"></script>
</body>
</html>`;
    }

    private _getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
