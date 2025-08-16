import { ModuleInfo, ClassInfo, DataFlowInfo, ComplexityInfo } from './ProjectAnalyzer';

export interface VisualizationData {
    type: 'architecture' | 'dataflow' | 'class' | 'heatmap';
    nodes: any[];
    edges?: any[];
    data?: any;
    config?: any;
}

export class VisualizationGenerator {

    public async generateArchitectureDiagram(analysis: {
        modules: ModuleInfo[],
        relationships: any[],
        metrics: any
    }): Promise<VisualizationData> {

        const nodes = analysis.modules.map(module => ({
            data: {
                id: module.id,
                label: module.name,
                type: module.type,
                complexity: module.complexity,
                lines: module.lines,
                functions: module.functions,
                classes: module.classes
            },
            classes: `node-${module.type}`,
            style: {
                'background-color': this._getTypeColor(module.type),
                'border-color': this._getComplexityColor(module.complexity),
                'border-width': Math.max(2, Math.min(6, module.complexity / 2)),
                'width': Math.max(60, Math.min(120, module.lines / 10)),
                'height': Math.max(60, Math.min(120, module.lines / 10)),
                'font-size': '12px',
                'color': '#ffffff',
                'text-outline-color': '#000000',
                'text-outline-width': '1px'
            }
        }));

        const edges = analysis.relationships.map(rel => ({
            data: {
                id: `${rel.from}-${rel.to}`,
                source: rel.from,
                target: rel.to,
                label: rel.type,
                strength: rel.strength
            },
            style: {
                'width': Math.max(1, rel.strength * 4),
                'line-color': this._getRelationshipColor(rel.type),
                'target-arrow-color': this._getRelationshipColor(rel.type),
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'opacity': Math.max(0.3, rel.strength)
            }
        }));

        return {
            type: 'architecture',
            nodes,
            edges,
            config: {
                layout: {
                    name: 'cose',
                    idealEdgeLength: 100,
                    nodeOverlap: 20,
                    refresh: 20,
                    fit: true,
                    padding: 30,
                    randomize: false,
                    componentSpacing: 100,
                    nodeRepulsion: 400000,
                    edgeElasticity: 100,
                    nestingFactor: 5,
                    gravity: 80,
                    numIter: 1000,
                    initialTemp: 200,
                    coolingFactor: 0.95,
                    minTemp: 1.0
                },
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'shape': 'round-rectangle'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'curve-style': 'bezier',
                            'target-arrow-shape': 'triangle'
                        }
                    },
                    {
                        selector: '.node-service',
                        style: {
                            'shape': 'hexagon'
                        }
                    },
                    {
                        selector: '.node-data',
                        style: {
                            'shape': 'barrel'
                        }
                    },
                    {
                        selector: '.node-presentation',
                        style: {
                            'shape': 'round-tag'
                        }
                    }
                ]
            }
        };
    }

    public async generateDataFlowDiagram(dataFlow: DataFlowInfo): Promise<VisualizationData> {
        const nodes = dataFlow.nodes.map(node => ({
            data: {
                id: node.id,
                label: node.label,
                type: node.type
            },
            classes: `dataflow-${node.type}`,
            style: {
                'background-color': this._getDataFlowColor(node.type),
                'shape': this._getDataFlowShape(node.type),
                'width': 80,
                'height': 60,
                'color': '#ffffff',
                'font-size': '11px',
                'text-outline-color': '#000000',
                'text-outline-width': '1px'
            }
        }));

        const edges = dataFlow.edges.map(edge => ({
            data: {
                id: `${edge.from}-${edge.to}`,
                source: edge.from,
                target: edge.to,
                label: edge.label,
                data: edge.data
            },
            style: {
                'width': 3,
                'line-color': '#4A90E2',
                'target-arrow-color': '#4A90E2',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'label': 'data(label)',
                'font-size': '10px',
                'text-rotation': 'autorotate',
                'edge-text-rotation': 'autorotate'
            }
        }));

        return {
            type: 'dataflow',
            nodes,
            edges,
            config: {
                layout: {
                    name: 'dagre',
                    rankDir: 'TB',
                    spacingFactor: 1.5,
                    padding: 30,
                    nodeDimensionsIncludeLabels: true
                },
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'curve-style': 'bezier',
                            'target-arrow-shape': 'triangle'
                        }
                    }
                ]
            }
        };
    }

    public async generateClassDiagram(classes: ClassInfo[]): Promise<VisualizationData> {
        const nodes = classes.map(cls => {
            const methodsText = cls.methods.slice(0, 5).join('\n') + (cls.methods.length > 5 ? '\n...' : '');
            const propertiesText = cls.properties.slice(0, 3).join('\n') + (cls.properties.length > 3 ? '\n...' : '');

            return {
                data: {
                    id: cls.name,
                    label: cls.name,
                    methods: cls.methods,
                    properties: cls.properties,
                    complexity: cls.complexity,
                    fullLabel: `${cls.name}\n\nProperties:\n${propertiesText}\n\nMethods:\n${methodsText}`
                },
                style: {
                    'background-color': this._getComplexityColor(cls.complexity),
                    'border-color': '#2c3e50',
                    'border-width': 2,
                    'width': Math.max(120, cls.name.length * 8 + 40),
                    'height': Math.max(80, (cls.methods.length + cls.properties.length) * 8 + 60),
                    'shape': 'rectangle',
                    'color': '#ffffff',
                    'font-size': '10px',
                    'text-valign': 'top',
                    'text-halign': 'center',
                    'text-outline-color': '#000000',
                    'text-outline-width': '1px'
                }
            };
        });

        const edges = [];

        // Create inheritance relationships
        for (const cls of classes) {
            for (const parent of cls.inheritance) {
                const parentClass = classes.find(c => c.name === parent);
                if (parentClass) {
                    edges.push({
                        data: {
                            id: `${cls.name}-extends-${parent}`,
                            source: cls.name,
                            target: parent,
                            relationship: 'extends'
                        },
                        style: {
                            'width': 2,
                            'line-color': '#e74c3c',
                            'target-arrow-color': '#e74c3c',
                            'target-arrow-shape': 'triangle',
                            'line-style': 'solid'
                        }
                    });
                }
            }

            // Create implementation relationships
            for (const iface of cls.implements) {
                const ifaceClass = classes.find(c => c.name === iface);
                if (ifaceClass) {
                    edges.push({
                        data: {
                            id: `${cls.name}-implements-${iface}`,
                            source: cls.name,
                            target: iface,
                            relationship: 'implements'
                        },
                        style: {
                            'width': 2,
                            'line-color': '#3498db',
                            'target-arrow-color': '#3498db',
                            'target-arrow-shape': 'triangle',
                            'line-style': 'dashed'
                        }
                    });
                }
            }
        }

        return {
            type: 'class',
            nodes,
            edges,
            config: {
                layout: {
                    name: 'dagre',
                    rankDir: 'TB',
                    spacingFactor: 2,
                    padding: 50,
                    nodeDimensionsIncludeLabels: true
                },
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(fullLabel)',
                            'text-valign': 'top',
                            'text-halign': 'center',
                            'text-wrap': 'wrap',
                            'text-max-width': '200px'
                        }
                    },
                    {
                        selector: 'edge',
                        style: {
                            'curve-style': 'bezier'
                        }
                    }
                ]
            }
        };
    }

    public async generateHeatmap(complexityData: ComplexityInfo[]): Promise<VisualizationData> {
        // Prepare data for heatmap visualization
        const maxComplexity = Math.max(...complexityData.map(d => d.complexity));
        const maxLines = Math.max(...complexityData.map(d => d.lines));

        const heatmapPoints = complexityData.map((data, index) => ({
            x: Math.floor(index % 10) * 100 + 50, // Grid layout
            y: Math.floor(index / 10) * 100 + 50,
            value: data.complexity,
            intensity: data.complexity / maxComplexity,
            file: data.file,
            lines: data.lines,
            functions: data.functions,
            classes: data.classes,
            maintainabilityIndex: data.maintainabilityIndex
        }));

        // Also create a treemap-style representation
        const treemapData = complexityData.map(data => ({
            data: {
                id: data.file,
                label: data.file.split('/').pop() || data.file,
                complexity: data.complexity,
                lines: data.lines,
                maintainabilityIndex: data.maintainabilityIndex
            },
            style: {
                'background-color': this._getHeatmapColor(data.complexity, maxComplexity),
                'border-color': '#2c3e50',
                'border-width': 1,
                'width': Math.max(60, Math.sqrt(data.lines) * 2),
                'height': Math.max(40, Math.sqrt(data.lines) * 1.5),
                'shape': 'rectangle',
                'color': data.complexity > maxComplexity * 0.7 ? '#ffffff' : '#000000',
                'font-size': '10px',
                'text-valign': 'center',
                'text-halign': 'center'
            }
        }));

        return {
            type: 'heatmap',
            nodes: treemapData,
            data: {
                heatmapPoints,
                maxComplexity,
                maxLines,
                config: {
                    radius: 40,
                    maxOpacity: 0.8,
                    minOpacity: 0.1,
                    blur: 0.75,
                    gradient: {
                        0.0: '#3498db',
                        0.3: '#2ecc71',
                        0.5: '#f1c40f',
                        0.7: '#e67e22',
                        1.0: '#e74c3c'
                    }
                }
            },
            config: {
                layout: {
                    name: 'grid',
                    rows: Math.ceil(Math.sqrt(complexityData.length)),
                    cols: Math.ceil(Math.sqrt(complexityData.length)),
                    padding: 10
                },
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'text-wrap': 'wrap',
                            'text-max-width': '80px'
                        }
                    }
                ]
            }
        };
    }

    private _getTypeColor(type: string): string {
        const colors = {
            'service': '#3498db',
            'utility': '#2ecc71',
            'component': '#9b59b6',
            'data': '#e67e22',
            'presentation': '#e74c3c'
        };
        return colors[type as keyof typeof colors] || '#34495e';
    }

    private _getComplexityColor(complexity: number): string {
        if (complexity <= 3) return '#2ecc71'; // Green - low complexity
        if (complexity <= 6) return '#f1c40f'; // Yellow - medium complexity
        if (complexity <= 10) return '#e67e22'; // Orange - high complexity
        return '#e74c3c'; // Red - very high complexity
    }

    private _getRelationshipColor(type: string): string {
        const colors = {
            'depends': '#3498db',
            'implements': '#2ecc71',
            'extends': '#e74c3c',
            'uses': '#9b59b6'
        };
        return colors[type as keyof typeof colors] || '#7f8c8d';
    }

    private _getDataFlowColor(type: string): string {
        const colors = {
            'input': '#3498db',
            'process': '#2ecc71',
            'output': '#e67e22',
            'store': '#9b59b6'
        };
        return colors[type as keyof typeof colors] || '#34495e';
    }

    private _getDataFlowShape(type: string): string {
        const shapes = {
            'input': 'ellipse',
            'process': 'rectangle',
            'output': 'ellipse',
            'store': 'barrel'
        };
        return shapes[type as keyof typeof shapes] || 'rectangle';
    }

    private _getHeatmapColor(complexity: number, maxComplexity: number): string {
        const ratio = complexity / maxComplexity;

        if (ratio <= 0.2) return '#3498db'; // Blue - very low
        if (ratio <= 0.4) return '#2ecc71'; // Green - low
        if (ratio <= 0.6) return '#f1c40f'; // Yellow - medium
        if (ratio <= 0.8) return '#e67e22'; // Orange - high
        return '#e74c3c'; // Red - very high
    }
}
