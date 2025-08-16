import * as vscode from 'vscode';
import OpenAI from 'openai';

export interface ArchitectureAnalysis {
    modules: Array<{
        id: string;
        name: string;
        type: string;
        dependencies: string[];
        complexity: number;
        lines: number;
        functions: number;
    }>;
    relationships: Array<{
        from: string;
        to: string;
        type: string;
        strength: number;
    }>;
    metrics: {
        totalFiles: number;
        totalLines: number;
        averageComplexity: number;
        dependencyDepth: number;
        circularDependencies: number;
    };
}

export interface AISuggestion {
    type: 'improvement' | 'warning' | 'optimization';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    category: string;
}

export class OpenAIService {
    private _openai: OpenAI | null = null;
    private _apiKey: string | null = null;

    constructor() {
        // Initialize with API key from configuration if available
        const config = vscode.workspace.getConfiguration('architectureVisualizer');
        const apiKey = config.get<string>('openaiApiKey');
        if (apiKey) {
            this.setApiKey(apiKey);
        }
    }

    public setApiKey(apiKey: string) {
        this._apiKey = apiKey;
        this._openai = new OpenAI({
            apiKey: apiKey
        });
    }

    public isAuthenticated(): boolean {
        return this._openai !== null;
    }

    public async analyzeArchitecture(analysis: ArchitectureAnalysis): Promise<AISuggestion[]> {
        if (!this._openai) {
            throw new Error('OpenAI API key not configured');
        }

        const prompt = this._buildAnalysisPrompt(analysis);

        try {
            const response = await this._openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert software architect. Analyze the provided codebase architecture and provide specific, actionable suggestions for improvement. Focus on:
                        1. Design patterns and architectural best practices
                        2. Code organization and modularity
                        3. Dependency management
                        4. Performance considerations
                        5. Maintainability and scalability

                        Return your response as a JSON array of suggestions with the following structure:
                        {
                            "type": "improvement" | "warning" | "optimization",
                            "title": "Brief title",
                            "description": "Detailed description with actionable steps",
                            "priority": "high" | "medium" | "low",
                            "category": "architecture" | "performance" | "maintainability" | "testing"
                        }`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            // Parse the JSON response
            try {
                const suggestions = JSON.parse(content) as AISuggestion[];
                return suggestions;
            } catch (parseError) {
                // Fallback: create suggestions from text response
                return this._parseTextResponse(content);
            }

        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error(`AI analysis failed: ${error}`);
        }
    }

    public async generateArchitectureInsights(analysis: ArchitectureAnalysis): Promise<string> {
        if (!this._openai) {
            throw new Error('OpenAI API key not configured');
        }

        const prompt = `Provide a comprehensive analysis of this software architecture:

        ${this._buildAnalysisPrompt(analysis)}

        Please provide insights on:
        1. Overall architecture quality
        2. Key strengths and weaknesses  
        3. Recommendations for improvement
        4. Potential technical debt areas`;

        try {
            const response = await this._openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert software architect providing detailed analysis of codebases.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1500
            });

            return response.choices[0]?.message?.content || 'No analysis generated';

        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error(`AI insights generation failed: ${error}`);
        }
    }

    private _buildAnalysisPrompt(analysis: ArchitectureAnalysis): string {
        const modulesInfo = analysis.modules.map(mod => 
            `Module: ${mod.name} (${mod.type})
            - Lines of code: ${mod.lines}
            - Complexity: ${mod.complexity}
            - Functions: ${mod.functions}
            - Dependencies: ${mod.dependencies.join(', ') || 'None'}`
        ).join('\n\n');

        const relationshipsInfo = analysis.relationships.map(rel =>
            `${rel.from} -> ${rel.to} (${rel.type}, strength: ${rel.strength})`
        ).join('\n');

        return `
Architecture Analysis Data:

MODULES:
${modulesInfo}

RELATIONSHIPS:
${relationshipsInfo}

METRICS:
- Total files: ${analysis.metrics.totalFiles}
- Total lines: ${analysis.metrics.totalLines}
- Average complexity: ${analysis.metrics.averageComplexity.toFixed(2)}
- Dependency depth: ${analysis.metrics.dependencyDepth}
- Circular dependencies: ${analysis.metrics.circularDependencies}
        `;
    }

    private _parseTextResponse(content: string): AISuggestion[] {
        // Fallback method to extract suggestions from text response
        const suggestions: AISuggestion[] = [];
        const lines = content.split('\n');

        let currentSuggestion: Partial<AISuggestion> = {};

        for (const line of lines) {
            if (line.includes('WARNING:') || line.includes('⚠️')) {
                if (currentSuggestion.title) {
                    suggestions.push(currentSuggestion as AISuggestion);
                }
                currentSuggestion = {
                    type: 'warning',
                    title: line.replace(/WARNING:|⚠️/g, '').trim(),
                    priority: 'high',
                    category: 'architecture'
                };
            } else if (line.includes('IMPROVEMENT:') || line.includes('💡')) {
                if (currentSuggestion.title) {
                    suggestions.push(currentSuggestion as AISuggestion);
                }
                currentSuggestion = {
                    type: 'improvement',
                    title: line.replace(/IMPROVEMENT:|💡/g, '').trim(),
                    priority: 'medium',
                    category: 'improvement'
                };
            } else if (line.includes('OPTIMIZATION:') || line.includes('🚀')) {
                if (currentSuggestion.title) {
                    suggestions.push(currentSuggestion as AISuggestion);
                }
                currentSuggestion = {
                    type: 'optimization',
                    title: line.replace(/OPTIMIZATION:|🚀/g, '').trim(),
                    priority: 'low',
                    category: 'performance'
                };
            } else if (line.trim() && currentSuggestion.title && !currentSuggestion.description) {
                currentSuggestion.description = line.trim();
            }
        }

        if (currentSuggestion.title) {
            suggestions.push(currentSuggestion as AISuggestion);
        }

        return suggestions.length > 0 ? suggestions : [{
            type: 'improvement',
            title: 'AI Analysis Complete',
            description: content.substring(0, 200) + '...',
            priority: 'medium',
            category: 'general'
        }];
    }
}
