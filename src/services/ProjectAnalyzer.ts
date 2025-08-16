import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface ModuleInfo {
    id: string;
    name: string;
    type: 'service' | 'utility' | 'component' | 'data' | 'presentation';
    filePath: string;
    dependencies: string[];
    exports: string[];
    imports: string[];
    complexity: number;
    lines: number;
    functions: number;
    classes: number;
}

export interface ClassInfo {
    name: string;
    filePath: string;
    methods: string[];
    properties: string[];
    inheritance: string[];
    implements: string[];
    complexity: number;
}

export interface DataFlowInfo {
    nodes: Array<{
        id: string;
        label: string;
        type: 'input' | 'process' | 'output' | 'store';
    }>;
    edges: Array<{
        from: string;
        to: string;
        label: string;
        data?: string;
    }>;
}

export interface ComplexityInfo {
    file: string;
    complexity: number;
    lines: number;
    functions: number;
    classes: number;
    coverage?: number;
    bugs?: number;
    maintainabilityIndex: number;
}

export class ProjectAnalyzer {
    private _workspaceRoot: string | undefined;
    private _excludePatterns: string[];

    constructor() {
        this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        const config = vscode.workspace.getConfiguration('codemap');
        this._excludePatterns = config.get<string[]>('excludePatterns') || ['node_modules', 'dist', '.git'];
    }

    public async analyzeProjectStructure(): Promise<{ modules: ModuleInfo[], relationships: any[], metrics: any }> {
        if (!this._workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        const modules = await this._scanModules();
        const relationships = this._analyzeRelationships(modules);
        const metrics = this._calculateMetrics(modules, relationships);

        return { modules, relationships, metrics };
    }

    public async analyzeClassStructure(): Promise<ClassInfo[]> {
        console.log("Starting class structure analysis...");
        const classInfos: ClassInfo[] = [];

        const files = await this._findSourceFiles();
        console.log("Files to analyze:", files);

        for (const file of files) {
            try {
                const content = await fs.promises.readFile(file, 'utf8');
                const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
                const classes = this._extractClasses(sourceFile, file);
                console.log(`Classes found in ${file}:`, classes);
                classInfos.push(...classes);
            } catch (error) {
                console.error(`Failed to analyze file ${file}:`, error);
            }
        }

        console.log("Class structure analysis completed. Total classes found:", classInfos.length);
        return classInfos;
    }

    public async analyzeDataFlow(): Promise<DataFlowInfo> {
        if (!this._workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        const modules = await this._scanModules();
        const nodes = this._identifyDataFlowNodes(modules);
        const edges = this._traceDataFlow(modules, nodes);

        return { nodes, edges };
    }

    public async analyzeComplexity(): Promise<ComplexityInfo[]> {
        if (!this._workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        const files = await this._findSourceFiles();
        const complexityData: ComplexityInfo[] = [];

        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const analysis = this._calculateFileComplexity(content, file);
                complexityData.push(analysis);
            } catch (error) {
                console.warn(`Failed to analyze complexity for ${file}:`, error);
            }
        }

        return complexityData.sort((a, b) => b.complexity - a.complexity);
    }

    private async _scanModules(): Promise<ModuleInfo[]> {
        const files = await this._findSourceFiles();
        const modules: ModuleInfo[] = [];

        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const moduleInfo = this._analyzeModule(content, file);
                if (moduleInfo) {
                    modules.push(moduleInfo);
                }
            } catch (error) {
                console.warn(`Failed to analyze module ${file}:`, error);
            }
        }

        return modules;
    }

    private async _findSourceFiles(): Promise<string[]> {
        if (!this._workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        console.log("Workspace root:", this._workspaceRoot);
        console.log("Exclude patterns:", this._excludePatterns);

        const files: string[] = [];
        const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

        for (const pattern of patterns) {
            try {
                const foundFiles = await vscode.workspace.findFiles(
                    pattern,
                    `**/{${this._excludePatterns.join(',')}}/**`
                );
                console.log(`Files found for pattern '${pattern}':`, foundFiles.map(f => f.fsPath));
                files.push(...foundFiles.map(f => f.fsPath));
            } catch (error) {
                console.error(`Error finding files for pattern '${pattern}':`, error);
            }
        }

        const uniqueFiles = [...new Set(files)]; // Remove duplicates
        console.log("Unique files found:", uniqueFiles);
        return uniqueFiles;
    }

    private _analyzeModule(content: string, filePath: string): ModuleInfo | null {
        try {
            const sourceFile = ts.createSourceFile(
                filePath,
                content,
                ts.ScriptTarget.Latest,
                true
            );

            const fileName = path.basename(filePath, path.extname(filePath));
            const relativePath = path.relative(this._workspaceRoot!, filePath);

            const dependencies = this._extractDependencies(sourceFile);
            const exports = this._extractExports(sourceFile);
            const imports = this._extractImports(sourceFile);

            const lines = content.split('\n').length;
            const functions = this._countFunctions(sourceFile);
            const classes = this._countClasses(sourceFile);
            const complexity = this._calculateCyclomaticComplexity(sourceFile);

            const moduleType = this._inferModuleType(fileName, relativePath, dependencies, exports);

            return {
                id: fileName,
                name: fileName,
                type: moduleType,
                filePath: relativePath,
                dependencies,
                exports,
                imports,
                complexity,
                lines,
                functions,
                classes
            };
        } catch (error) {
            console.warn(`Failed to parse ${filePath}:`, error);
            return null;
        }
    }

    private _extractDependencies(sourceFile: ts.SourceFile): string[] {
        const dependencies: string[] = [];

        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                const moduleName = node.moduleSpecifier.text;
                if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
                    // Local dependency
                    dependencies.push(path.basename(moduleName, path.extname(moduleName)));
                } else if (!moduleName.startsWith('@') && !moduleName.includes('/')) {
                    // External dependency (simplified)
                    dependencies.push(moduleName);
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return [...new Set(dependencies)];
    }

    private _extractExports(sourceFile: ts.SourceFile): string[] {
        const exports: string[] = [];

        const visit = (node: ts.Node) => {
            if (ts.isFunctionDeclaration(node) && node.name && (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
                exports.push(node.name.text);
            } else if (ts.isClassDeclaration(node) && node.name && (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))) {
                exports.push(node.name.text);
            } else if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                node.declarationList.declarations.forEach(decl => {
                    if (ts.isIdentifier(decl.name)) {
                        exports.push(decl.name.text);
                    }
                });
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return exports;
    }

    private _extractImports(sourceFile: ts.SourceFile): string[] {
        const imports: string[] = [];

        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node) && node.importClause) {
                if (node.importClause.name) {
                    imports.push(node.importClause.name.text);
                }
                if (node.importClause.namedBindings) {
                    if (ts.isNamedImports(node.importClause.namedBindings)) {
                        node.importClause.namedBindings.elements.forEach(elem => {
                            imports.push(elem.name.text);
                        });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return imports;
    }

    private _inferModuleType(fileName: string, filePath: string, dependencies: string[], exports: string[]): ModuleInfo['type'] {
        const name = fileName.toLowerCase();
        const path = filePath.toLowerCase();

        if (name.includes('service') || name.includes('api') || name.includes('client')) {
            return 'service';
        } else if (name.includes('util') || name.includes('helper') || name.includes('tool')) {
            return 'utility';
        } else if (name.includes('component') || name.includes('view') || path.includes('component')) {
            return 'presentation';
        } else if (name.includes('model') || name.includes('data') || name.includes('schema')) {
            return 'data';
        } else if (exports.length > dependencies.length && dependencies.length > 0) {
            return 'service';
        } else if (dependencies.length === 0 && exports.length > 0) {
            return 'utility';
        }

        return 'component';
    }

    private _countFunctions(sourceFile: ts.SourceFile): number {
        let count = 0;

        const visit = (node: ts.Node) => {
            if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
                count++;
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return count;
    }

    private _countClasses(sourceFile: ts.SourceFile): number {
        let count = 0;

        const visit = (node: ts.Node) => {
            if (ts.isClassDeclaration(node)) {
                count++;
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return count;
    }

    private _calculateCyclomaticComplexity(rootNode: ts.Node): number {
        let complexity = 1; // Base complexity

        const visit = (node: ts.Node) => {
            // Increment complexity for decision points
            if (ts.isIfStatement(node) ||
                ts.isWhileStatement(node) ||
                ts.isForStatement(node) ||
                ts.isForInStatement(node) ||
                ts.isForOfStatement(node) ||
                ts.isDoStatement(node) ||
                ts.isSwitchStatement(node) ||
                ts.isConditionalExpression(node) ||
                ts.isTryStatement(node)) {
                complexity++;
            } else if (ts.isCaseClause(node)) {
                complexity++;
            }

            ts.forEachChild(node, visit);
        };

        visit(rootNode);
        return Math.max(1, complexity);
    }

    private _extractClasses(sourceFile: ts.SourceFile, filePath: string): ClassInfo[] {
        console.log("Analyzing file:", filePath);
        const classes: ClassInfo[] = [];

        const visit = (node: ts.Node) => {
            if (ts.isClassDeclaration(node) && node.name) {
                console.log("Found class:", node.name.text);
                const methods: string[] = [];
                const properties: string[] = [];
                const inheritance: string[] = [];
                const implementedInterfaces: string[] = [];

                // Extract heritage clauses (extends, implements)
                if (node.heritageClauses) {
                    for (const clause of node.heritageClauses) {
                        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                            clause.types.forEach(type => {
                                if (ts.isIdentifier(type.expression)) {
                                    inheritance.push(type.expression.text);
                                    console.log("Class", node.name?.text, "extends", type.expression.text);
                                }
                            });
                        } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
                            clause.types.forEach(type => {
                                if (ts.isIdentifier(type.expression)) {
                                    implementedInterfaces.push(type.expression.text);
                                    console.log("Class", node.name?.text, "implements", type.expression.text);
                                }
                            });
                        }
                    }
                }

                // Extract members
                node.members.forEach(member => {
                    if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                        methods.push(member.name.text);
                        console.log("Class", node.name?.text, "has method", member.name.text);
                    } else if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                        properties.push(member.name.text);
                        console.log("Class", node.name?.text, "has property", member.name.text);
                    }
                });

                const complexity = this._calculateCyclomaticComplexity(node);
                console.log("Class", node.name?.text, "has complexity", complexity);

                classes.push({
                    name: node.name.text,
                    filePath: path.relative(this._workspaceRoot!, filePath),
                    methods,
                    properties,
                    inheritance,
                    implements: implementedInterfaces,
                    complexity
                });
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        console.log("Classes extracted from file:", filePath, classes);
        return classes.length > 0 ? classes : [];
    }

    private _analyzeRelationships(modules: ModuleInfo[]) {
        const relationships = [];

        for (const module of modules) {
            for (const dep of module.dependencies) {
                const target = modules.find(m => m.id === dep);
                if (target) {
                    relationships.push({
                        from: module.id,
                        to: target.id,
                        type: 'depends',
                        strength: this._calculateRelationshipStrength(module, target)
                    });
                }
            }
        }

        return relationships;
    }

    private _calculateRelationshipStrength(from: ModuleInfo, to: ModuleInfo): number {
        // Simple heuristic based on shared imports/exports
        const sharedElements = from.imports.filter(imp => to.exports.includes(imp));
        return Math.min(sharedElements.length / Math.max(to.exports.length, 1), 1);
    }

    private _calculateMetrics(modules: ModuleInfo[], relationships: any[]) {
        const totalFiles = modules.length;
        const totalLines = modules.reduce((sum, mod) => sum + mod.lines, 0);
        const averageComplexity = modules.reduce((sum, mod) => sum + mod.complexity, 0) / totalFiles;

        // Calculate dependency depth
        const dependencyDepth = this._calculateMaxDependencyDepth(modules, relationships);

        // Detect circular dependencies
        const circularDependencies = this._detectCircularDependencies(relationships);

        return {
            totalFiles,
            totalLines,
            averageComplexity,
            dependencyDepth,
            circularDependencies
        };
    }

    private _calculateMaxDependencyDepth(modules: ModuleInfo[], relationships: any[]): number {
        // Simplified depth calculation
        const maxDepth = Math.max(...modules.map(mod => mod.dependencies.length));
        return maxDepth;
    }

    private _detectCircularDependencies(relationships: any[]): number {
        // Simplified circular dependency detection
        const graph = new Map<string, string[]>();

        for (const rel of relationships) {
            if (!graph.has(rel.from)) {
                graph.set(rel.from, []);
            }
            graph.get(rel.from)!.push(rel.to);
        }

        let circularCount = 0;

        for (const [node, deps] of graph.entries()) {
            for (const dep of deps) {
                if (graph.get(dep)?.includes(node)) {
                    circularCount++;
                }
            }
        }

        return circularCount / 2; // Each circular dependency is counted twice
    }

    private _identifyDataFlowNodes(modules: ModuleInfo[]) {
        return modules.map(mod => ({
            id: mod.id,
            label: mod.name,
            type: this._getDataFlowNodeType(mod) as 'input' | 'process' | 'output' | 'store'
        }));
    }

    private _getDataFlowNodeType(module: ModuleInfo): string {
        switch (module.type) {
            case 'data':
                return 'store';
            case 'presentation':
                return 'output';
            case 'service':
                return 'process';
            default:
                return 'process';
        }
    }

    private _traceDataFlow(modules: ModuleInfo[], nodes: any[]) {
        const edges = [];

        for (const module of modules) {
            for (const dep of module.dependencies) {
                const target = modules.find(m => m.id === dep);
                if (target) {
                    edges.push({
                        from: dep,
                        to: module.id,
                        label: 'data flow',
                        data: 'processed data'
                    });
                }
            }
        }

        return edges;
    }

    private _calculateFileComplexity(content: string, filePath: string): ComplexityInfo {
        const lines = content.split('\n').length;

        try {
            const sourceFile = ts.createSourceFile(
                filePath,
                content,
                ts.ScriptTarget.Latest,
                true
            );

            const functions = this._countFunctions(sourceFile);
            const classes = this._countClasses(sourceFile);
            const complexity = this._calculateCyclomaticComplexity(sourceFile);

            // Calculate maintainability index (simplified)
            const maintainabilityIndex = Math.max(0, Math.min(100, 
                100 - (complexity * 2) - (lines / 100) + (functions * 5)
            ));

            return {
                file: path.relative(this._workspaceRoot!, filePath),
                complexity,
                lines,
                functions,
                classes,
                maintainabilityIndex
            };
        } catch (error) {
            // Fallback for non-TypeScript files
            const estimatedComplexity = Math.max(1, Math.floor(lines / 50));

            return {
                file: path.relative(this._workspaceRoot!, filePath),
                complexity: estimatedComplexity,
                lines,
                functions: 0,
                classes: 0,
                maintainabilityIndex: Math.max(0, 100 - estimatedComplexity * 10)
            };
        }
    }
}
