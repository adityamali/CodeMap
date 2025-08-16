import * as vscode from 'vscode';
import { ArchitectureViewProvider } from './providers/ArchitectureViewProvider';
import { ProjectStructureProvider } from './providers/ProjectStructureProvider';
import { OpenAIService } from './services/OpenAIService';
import { ProjectAnalyzer } from './services/ProjectAnalyzer';
import { VisualizationGenerator } from './services/VisualizationGenerator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Architecture Visualizer extension activated');

    // Initialize services
    const openaiService = new OpenAIService();
    const projectAnalyzer = new ProjectAnalyzer();
    const visualizationGenerator = new VisualizationGenerator();

    // Create view providers
    const architectureProvider = new ArchitectureViewProvider(
        context.extensionUri, 
        openaiService,
        projectAnalyzer,
        visualizationGenerator
    );

    const structureProvider = new ProjectStructureProvider(
        vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath
    );

    // Register webview provider
        context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
                'codemap.sidebar', 
            architectureProvider
        )
    );

    // Register tree data provider
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            'projectStructure',
            structureProvider
        )
    );

    // Register commands
    registerCommands(context, architectureProvider, openaiService, projectAnalyzer, visualizationGenerator);

    // Auto-refresh on file changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js,tsx,jsx,py,java,cs}');
    watcher.onDidChange(() => {
        structureProvider.refresh();
        architectureProvider.refresh();
    });

    context.subscriptions.push(watcher);
}

function registerCommands(
    context: vscode.ExtensionContext,
    architectureProvider: ArchitectureViewProvider,
    openaiService: OpenAIService,
    projectAnalyzer: ProjectAnalyzer,
    visualizationGenerator: VisualizationGenerator
) {
    // Generate Architecture Diagram
    const generateArchitecture = vscode.commands.registerCommand(
            'codemap.generateArchitecture',
        async () => {
            try {
                vscode.window.showInformationMessage('Analyzing project architecture...');
                const analysis = await projectAnalyzer.analyzeProjectStructure();
                const diagram = await visualizationGenerator.generateArchitectureDiagram(analysis);
                architectureProvider.showVisualization('architecture', diagram);
                vscode.window.showInformationMessage('Architecture diagram generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate architecture: ${error}`);
            }
        }
    );

    // Generate Data Flow Diagram
    const generateDataFlow = vscode.commands.registerCommand(
            'codemap.generateDataFlow',
        async () => {
            try {
                vscode.window.showInformationMessage('Analyzing data flow patterns...');
                const analysis = await projectAnalyzer.analyzeDataFlow();
                const diagram = await visualizationGenerator.generateDataFlowDiagram(analysis);
                architectureProvider.showVisualization('dataflow', diagram);
                vscode.window.showInformationMessage('Data flow diagram generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate data flow: ${error}`);
            }
        }
    );

    // Generate Class Diagram
    const generateClassDiagram = vscode.commands.registerCommand(
            'codemap.generateClassDiagram',
        async () => {
            try {
                vscode.window.showInformationMessage('Analyzing class relationships...');
                const analysis = await projectAnalyzer.analyzeClassStructure();
                console.log(" Class Structure Analysis : ",analysis);
                const diagram = await visualizationGenerator.generateClassDiagram(analysis);
                architectureProvider.showVisualization('class', diagram);
                vscode.window.showInformationMessage('Class diagram generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate class diagram: ${error}`);
            }
        }
    );

    // Generate Complexity Heatmap
    const generateHeatmap = vscode.commands.registerCommand(
            'codemap.generateHeatmap',
        async () => {
            try {
                vscode.window.showInformationMessage('Analyzing code complexity...');
                const analysis = await projectAnalyzer.analyzeComplexity();
                const heatmap = await visualizationGenerator.generateHeatmap(analysis);
                architectureProvider.showVisualization('heatmap', heatmap);
                vscode.window.showInformationMessage('Complexity heatmap generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate heatmap: ${error}`);
            }
        }
    );

    // Authenticate with OpenAI
    const authenticate = vscode.commands.registerCommand(
            'codemap.authenticate',
        async () => {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your OpenAI API Key',
                password: true,
                placeHolder: 'sk-...'
            });

            if (apiKey) {
                await vscode.workspace.getConfiguration('codemap')
                    .update('openaiApiKey', apiKey, vscode.ConfigurationTarget.Global);

                openaiService.setApiKey(apiKey);
                vscode.window.showInformationMessage('OpenAI API key configured successfully!');
            }
        }
    );

    // Analyze with AI
    const analyzeWithAI = vscode.commands.registerCommand(
            'codemap.analyzeWithAI',
        async () => {
            try {
                const apiKey = vscode.workspace.getConfiguration('codemap')
                    .get<string>('openaiApiKey');

                if (!apiKey) {
                    const response = await vscode.window.showWarningMessage(
                        'OpenAI API key not configured. Configure it now?',
                        'Configure',
                        'Cancel'
                    );

                    if (response === 'Configure') {
                        await vscode.commands.executeCommand('architectureVisualizer.authenticate');
                        return;
                    }
                    return;
                }

                vscode.window.showInformationMessage('Analyzing architecture with AI...');
                const analysis = await projectAnalyzer.analyzeProjectStructure();
                const suggestions = await openaiService.analyzeArchitecture(analysis);

                architectureProvider.showAISuggestions(suggestions);
                vscode.window.showInformationMessage('AI analysis completed!');

            } catch (error) {
                vscode.window.showErrorMessage(`AI analysis failed: ${error}`);
            }
        }
    );

    // Refresh command
    const refresh = vscode.commands.registerCommand(
            'codemap.refresh',
        async () => {
            architectureProvider.refresh();
            vscode.window.showInformationMessage('Architecture views refreshed!');
        }
    );

    // Register all commands
    context.subscriptions.push(
        generateArchitecture,
        generateDataFlow,
        generateClassDiagram,
        generateHeatmap,
        authenticate,
        analyzeWithAI,
        refresh
    );
}

export function deactivate() {
    console.log('Architecture Visualizer extension deactivated');
}
