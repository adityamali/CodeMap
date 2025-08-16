// Architecture Visualizer Webview Script
(function() {
    'use strict';

    // Get the VS Code API
    const vscode = acquireVsCodeApi();

    // Detect D3
    const hasD3 = typeof window !== 'undefined' && typeof window.d3 !== 'undefined';
    if (hasD3) {
        console.log('D3 detected');
    }

    // State management
    let currentVisualization = null;
    let d3State = { svg: null, g: null, simulation: null, zoom: null };
    let heatmapInstance = null;
    let isAuthenticated = false;
    // Note: zoom is handled via D3 zoom

    // DOM elements
    const loadingOverlay = document.getElementById('loadingOverlay');
    const vizContainer = document.getElementById('vizContainer');
    const vizTitle = document.getElementById('vizTitle');
    const authIndicator = document.getElementById('authIndicator');
    const authText = document.getElementById('authText');
    const authButton = document.getElementById('authButton');
    const analyzeButton = document.getElementById('analyzeButton');
    const suggestionsPanel = document.getElementById('suggestionsPanel');

    // Initialize the interface
    function init() {
    console.log('CodeMap webview initialized');

        // Set up event listeners
        setupEventListeners();

        // Check authentication status
        checkAuthStatus();

        // Add some interactive effects
        addInteractiveEffects();
    }

    function setupEventListeners() {
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log("Event : ", event);
            handleExtensionMessage(message);
        });

    // Wire buttons instead of inline handlers (CSP-friendly)
    const $ = (id) => document.getElementById(id);
        const on = (id, ev, fn) => {
            const el = $(id);
            if (el) {
                el.addEventListener(ev, fn);
            }
        };
    on('btnArchitecture', 'click', () => window.generateVisualization('architecture'));
    on('btnDataflow', 'click', () => window.generateVisualization('dataflow'));
    on('btnClass', 'click', () => window.generateVisualization('class'));
    on('btnHeatmap', 'click', () => window.generateVisualization('heatmap'));
    on('authButton', 'click', () => window.authenticateOpenAI());
    on('analyzeButton', 'click', () => window.analyzeWithAI());
    on('btnZoomIn', 'click', () => window.zoomIn());
    on('btnZoomOut', 'click', () => window.zoomOut());
    on('btnResetZoom', 'click', () => window.resetZoom());
    on('btnExport', 'click', () => window.exportViz());

    // Handle window resize
        window.addEventListener('resize', () => {
            // D3 will auto-handle on resize; optional: re-fit
        });
    }

    function handleExtensionMessage(message) {
        switch (message.command) {
            case 'showVisualization':
                showVisualization(message.type, message.data);
                break;
            case 'showAISuggestions':
                showAISuggestions(message.suggestions);
                break;
            case 'updateAuthStatus':
                updateAuthStatus(message.authenticated);
                break;
            case 'showError':
                showError(message.error);
                break;
        }
    }

    // Visualization generation functions
    window.generateVisualization = function(type) {
        showLoading(true);
        vizTitle.textContent = `Generating ${getVisualizationName(type)}...`;

        vscode.postMessage({
            command: 'generateVisualization',
            type: type
        });
    };

    function showVisualization(type, data) {
        console.log("showVisualization called with type:", type, "and data:", data);
        showLoading(false);
        currentVisualization = { type, data };
        vizTitle.textContent = getVisualizationName(type);

        // Clear previous visualization
        vizContainer.innerHTML = '';

        switch (type) {
            case 'architecture':
            case 'dataflow':
            case 'class':
                console.log("Rendering network visualization for type:", type);
                renderNetworkVisualization(data);
                break;
            case 'heatmap':
                console.log("Rendering heatmap visualization for type:", type);
                renderHeatmapVisualization(data);
                break;
            default:
                console.error("Unknown visualization type:", type);
                showError(`Unknown visualization type: ${type}`);
        }
    }

    function renderNetworkVisualization(data) {
        console.log("Renderer received data:", data);
        if (!data || !data.nodes || data.nodes.length === 0) {
            console.warn("No nodes found in data. Cannot render visualization.");
            showError("No data available to render the visualization.");
            return;
        }

        // Create container
        console.log("Renderer Recieved Data: ", data);
        const container = document.createElement('div');
        container.id = 'network';
        container.style.width = '100%';
        container.style.height = '100%';
        vizContainer.appendChild(container);

        try {
            if (hasD3) {
                const d3 = window.d3;
                const width = container.clientWidth;
                const height = container.clientHeight;

                const svg = d3.select(container).append('svg')
                    .attr('width', '100%')
                    .attr('height', '100%');

                const g = svg.append('g');

                const zoom = d3.zoom().on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });
                svg.call(zoom);

                const nodes = (data.nodes || []).map(n => ({
                    id: n.data?.id || n.id || n,
                    label: n.data?.label || n.label || String(n.data?.id || n.id || n),
                    color: n.style?.['background-color'] || '#6c63ff'
                }));

                const links = (data.edges || []).map(e => ({
                    id: e.data?.id || `${e.data?.source}-${e.data?.target}` || e.id,
                    source: e.data?.source || e.from || e.source,
                    target: e.data?.target || e.to || e.target,
                    label: e.data?.label || e.label,
                    color: e.style?.['line-color'] || '#999'
                }));

                const simulation = d3.forceSimulation(nodes)
                    .force('link', d3.forceLink(links).id(d => d.id).distance(120))
                    .force('charge', d3.forceManyBody().strength(-400))
                    .force('center', d3.forceCenter(width / 2, height / 2));

                const link = g.append('g')
                    .attr('stroke', '#999')
                    .attr('stroke-opacity', 0.6)
                    .selectAll('line')
                    .data(links)
                    .enter().append('line')
                    .attr('stroke', d => d.color)
                    .attr('marker-end', 'url(#arrow)');

                const node = g.append('g')
                    .selectAll('g')
                    .data(nodes)
                    .enter().append('g')
                    .call(d3.drag()
                        .on('start', dragstarted)
                        .on('drag', dragged)
                        .on('end', dragended));

                node.append('circle')
                    .attr('r', 20)
                    .attr('fill', d => d.color);

                node.append('text')
                    .attr('x', 24)
                    .attr('y', 5)
                    .attr('fill', '#ccc')
                    .style('font-size', '12px')
                    .text(d => d.label);

                // Arrow defs
                const defs = svg.append('defs');
                defs.append('marker')
                    .attr('id', 'arrow')
                    .attr('viewBox', '0 -5 10 10')
                    .attr('refX', 22)
                    .attr('refY', 0)
                    .attr('markerWidth', 6)
                    .attr('markerHeight', 6)
                    .attr('orient', 'auto')
                    .append('path')
                    .attr('d', 'M0,-5L10,0L0,5')
                    .attr('fill', '#999');

                simulation.on('tick', () => {
                    link
                        .attr('x1', d => d.source.x)
                        .attr('y1', d => d.source.y)
                        .attr('x2', d => d.target.x)
                        .attr('y2', d => d.target.y);

                    node.attr('transform', d => `translate(${d.x},${d.y})`);
                });

                function dragstarted(event, d) {
                    if (!event.active) { simulation.alphaTarget(0.3).restart(); }
                    d.fx = d.x; d.fy = d.y;
                }
                function dragged(event, d) {
                    d.fx = event.x; d.fy = event.y;
                }
                function dragended(event, d) {
                    if (!event.active) { simulation.alphaTarget(0); }
                    d.fx = null; d.fy = null;
                }

                // Click handlers
                node.on('click', (event, d) => {
                    showNodeInfo({ id: d.id, label: d.label });
                });
                link.on('click', (event, d) => {
                    showEdgeInfo({ source: d.source.id, target: d.target.id, label: d.label });
                });

                console.log('Network visualization rendered successfully (D3)');
                d3State = { svg, g, simulation, zoom };
                return;
            }

            // Fallback notice
            showError('No graph library available. Please ensure D3 is loaded.');
        } catch (error) {
            console.error('Failed to render network visualization:', error);
            showError(`Failed to render visualization: ${error.message}`);
        }
    }

    function renderHeatmapVisualization(data) {
        // Create containers for both treemap and heatmap
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.height = '100%';
        container.style.gap = '16px';

    // Treemap container (using simple tiles)
        const treemapContainer = document.createElement('div');
    treemapContainer.id = 'treemap';
        treemapContainer.style.height = '60%';
        treemapContainer.style.width = '100%';
        treemapContainer.style.borderRadius = '12px';
        treemapContainer.style.background = 'rgba(0, 0, 0, 0.1)';
    treemapContainer.style.display = 'flex';
    treemapContainer.style.flexWrap = 'wrap';
    treemapContainer.style.alignContent = 'flex-start';
    treemapContainer.style.gap = '8px';

        // Heatmap container
        const heatmapContainer = document.createElement('div');
        heatmapContainer.id = 'heatmap-container';
        heatmapContainer.style.height = '40%';
        heatmapContainer.style.width = '100%';
        heatmapContainer.style.position = 'relative';

        container.appendChild(treemapContainer);
        container.appendChild(heatmapContainer);
        vizContainer.appendChild(container);

        try {
            // Render simple treemap tiles without Cytoscape
            (data.nodes || []).forEach(n => {
                const tile = document.createElement('div');
                const w = Number(n.style?.width) || 80;
                const h = Number(n.style?.height) || 60;
                tile.style.width = `${Math.round(w)}px`;
                tile.style.height = `${Math.round(h)}px`;
                tile.style.background = n.style?.['background-color'] || 'rgba(255,255,255,0.06)';
                tile.style.border = `1px solid ${n.style?.['border-color'] || 'rgba(255,255,255,0.15)'}`;
                tile.style.borderRadius = '10px';
                tile.style.color = n.style?.color || '#ddd';
                tile.style.fontSize = '11px';
                tile.style.padding = '6px';
                tile.style.boxSizing = 'border-box';
                tile.style.display = 'flex';
                tile.style.alignItems = 'center';
                tile.style.justifyContent = 'center';
                tile.style.textAlign = 'center';
                tile.style.cursor = 'pointer';
                tile.textContent = n.data?.label || n.data?.id || 'node';
                tile.title = `${n.data?.label || n.data?.id}\nComplexity: ${n.data?.complexity ?? ''}  Lines: ${n.data?.lines ?? ''}`;
                tile.addEventListener('click', () => showComplexityInfo(n.data || {}));
                treemapContainer.appendChild(tile);
            });

            // Render heatmap if heatmap.js is available
            if (typeof h337 !== 'undefined') {
                renderHeatmap(heatmapContainer, data.data);
            } else {
                renderFallbackHeatmap(heatmapContainer, data.data);
            }

            console.log('Heatmap visualization rendered successfully');

        } catch (error) {
            console.error('Failed to render heatmap visualization:', error);
            showError(`Failed to render heatmap: ${error.message}`);
        }
    }

    function renderHeatmap(container, heatmapData) {
        try {
            heatmapInstance = h337.create({
                container: container,
                maxOpacity: heatmapData.config.maxOpacity,
                minOpacity: heatmapData.config.minOpacity,
                radius: heatmapData.config.radius,
                blur: heatmapData.config.blur,
                gradient: heatmapData.config.gradient
            });

            heatmapInstance.setData({
                max: heatmapData.maxComplexity,
                data: heatmapData.heatmapPoints
            });
        } catch (error) {
            console.warn('Heatmap.js failed, using fallback:', error);
            renderFallbackHeatmap(container, heatmapData);
        }
    }

    function renderFallbackHeatmap(container, heatmapData) {
        // Fallback grid visualization
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(60px, 1fr))';
        grid.style.gap = '2px';
        grid.style.padding = '16px';
        grid.style.height = '100%';
        grid.style.overflow = 'auto';

        heatmapData.heatmapPoints.forEach(point => {
            const cell = document.createElement('div');
            cell.style.backgroundColor = getHeatmapColor(point.intensity);
            cell.style.borderRadius = '6px';
            cell.style.padding = '8px';
            cell.style.fontSize = '10px';
            cell.style.color = point.intensity > 0.7 ? '#ffffff' : '#000000';
            cell.style.cursor = 'pointer';
            cell.style.transition = 'transform 0.2s ease';
            cell.textContent = point.file.split('/').pop();
            cell.title = `${point.file}\nComplexity: ${point.value}\nLines: ${point.lines}`;

            cell.addEventListener('mouseenter', () => {
                cell.style.transform = 'scale(1.05)';
            });

            cell.addEventListener('mouseleave', () => {
                cell.style.transform = 'scale(1)';
            });

            grid.appendChild(cell);
        });

        container.appendChild(grid);
    }

    function getHeatmapColor(intensity) {
        const colors = [
            '#3498db', // Blue - very low
            '#2ecc71', // Green - low  
            '#f1c40f', // Yellow - medium
            '#e67e22', // Orange - high
            '#e74c3c'  // Red - very high
        ];

        const index = Math.floor(intensity * (colors.length - 1));
        return colors[Math.min(index, colors.length - 1)];
    }

    // Info panels
    function showNodeInfo(nodeData) {
        const info = createInfoPanel();
        info.innerHTML = `
            <h4>${nodeData.label || nodeData.id}</h4>
            <div class="info-content">
                ${nodeData.type ? `<p><strong>Type:</strong> ${nodeData.type}</p>` : ''}
                ${nodeData.complexity ? `<p><strong>Complexity:</strong> ${nodeData.complexity}</p>` : ''}
                ${nodeData.lines ? `<p><strong>Lines:</strong> ${nodeData.lines}</p>` : ''}
                ${nodeData.functions ? `<p><strong>Functions:</strong> ${nodeData.functions}</p>` : ''}
                ${nodeData.classes ? `<p><strong>Classes:</strong> ${nodeData.classes}</p>` : ''}
            </div>
        `;

        showInfoPanel(info);
    }

    function showEdgeInfo(edgeData) {
        const info = createInfoPanel();
        info.innerHTML = `
            <h4>Relationship</h4>
            <div class="info-content">
                <p><strong>From:</strong> ${edgeData.source}</p>
                <p><strong>To:</strong> ${edgeData.target}</p>
                ${edgeData.label ? `<p><strong>Type:</strong> ${edgeData.label}</p>` : ''}
                ${edgeData.strength ? `<p><strong>Strength:</strong> ${(edgeData.strength * 100).toFixed(1)}%</p>` : ''}
            </div>
        `;

        showInfoPanel(info);
    }

    function showComplexityInfo(nodeData) {
        const info = createInfoPanel();
        info.innerHTML = `
            <h4>${nodeData.label}</h4>
            <div class="info-content">
                <p><strong>Complexity:</strong> ${nodeData.complexity}</p>
                <p><strong>Lines:</strong> ${nodeData.lines}</p>
                ${nodeData.maintainabilityIndex ? `<p><strong>Maintainability:</strong> ${nodeData.maintainabilityIndex.toFixed(1)}</p>` : ''}
            </div>
        `;

        showInfoPanel(info);
    }

    function createInfoPanel() {
        const panel = document.createElement('div');
        panel.className = 'info-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(45, 45, 48, 0.95) 100%);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            max-width: 300px;
            color: #cccccc;
            animation: slideIn 0.3s ease-out;
        `;

        return panel;
    }

    function showInfoPanel(panel) {
        // Remove existing info panels
        document.querySelectorAll('.info-panel').forEach(p => p.remove());

        // Add click outside to close
        const closePanel = () => {
            panel.remove();
            document.removeEventListener('click', closePanel);
        };

        setTimeout(() => {
            document.addEventListener('click', closePanel);
        }, 100);

        // Prevent panel click from closing
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.body.appendChild(panel);

        // Auto close after 5 seconds
        setTimeout(() => {
            if (panel.parentNode) {
                panel.remove();
            }
        }, 5000);
    }

    // AI Suggestions
    function showAISuggestions(suggestions) {
        const suggestionsList = document.getElementById('suggestionsList');
        suggestionsPanel.style.display = 'block';

        suggestionsList.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item">
                <div class="suggestion-header">
                    <div class="suggestion-type ${suggestion.type}">${suggestion.type}</div>
                    <div class="suggestion-title">${suggestion.title}</div>
                    <div class="suggestion-priority">${suggestion.priority}</div>
                </div>
                <div class="suggestion-description">${suggestion.description}</div>
            </div>
        `).join('');
    }

    // Authentication functions
    window.authenticateOpenAI = function() {
        vscode.postMessage({
            command: 'authenticateOpenAI'
        });
    };

    window.analyzeWithAI = function() {
        if (!isAuthenticated) {
            showError('Please configure your OpenAI API key first');
            return;
        }

        vscode.postMessage({
            command: 'analyzeWithAI'
        });
    };

    function updateAuthStatus(authenticated) {
        isAuthenticated = authenticated;

        if (authenticated) {
            authIndicator.className = 'auth-indicator online';
            authText.textContent = 'Authenticated';
            authButton.textContent = '🔑 Reconfigure Key';
            analyzeButton.disabled = false;
        } else {
            authIndicator.className = 'auth-indicator offline';
            authText.textContent = 'Not authenticated';
            authButton.textContent = '🔑 Configure API Key';
            analyzeButton.disabled = true;
        }
    }

    function checkAuthStatus() {
        // This would be handled by the extension
        vscode.postMessage({
            command: 'checkAuthStatus'
        });
    }

    // Visualization controls
    window.zoomIn = function() {
        if (d3State.svg && d3State.zoom) {
            const svg = d3State.svg;
            const current = window.d3.zoomTransform(svg.node());
            const k = current.k * 1.2;
            svg.transition().duration(200).call(d3State.zoom.scaleTo, k);
        }
    };

    window.zoomOut = function() {
        if (d3State.svg && d3State.zoom) {
            const svg = d3State.svg;
            const current = window.d3.zoomTransform(svg.node());
            const k = current.k * 0.8;
            svg.transition().duration(200).call(d3State.zoom.scaleTo, k);
        }
    };

    window.resetZoom = function() {
        if (d3State.svg && d3State.zoom) {
            const svg = d3State.svg;
            svg.transition().duration(200).call(d3State.zoom.transform, window.d3.zoomIdentity);
        }
    };

    window.exportViz = function() {
        if (!currentVisualization) {
            showError('No visualization to export');
            return;
        }

        vscode.postMessage({
            command: 'exportVisualization',
            type: currentVisualization.type,
            data: currentVisualization.data
        });
    };

    // Utility functions
    function getVisualizationName(type) {
        const names = {
            'architecture': 'Architecture Diagram',
            'dataflow': 'Data Flow Diagram',
            'class': 'Class Diagram',
            'heatmap': 'Complexity Heatmap'
        };
        return names[type] || 'Visualization';
    }

    function showLoading(show) {
        if (show) {
            loadingOverlay.classList.add('active');
        } else {
            loadingOverlay.classList.remove('active');
        }
    }

    function showError(message) {
        console.error('Webview error:', message);

        const errorPanel = createInfoPanel();
        errorPanel.innerHTML = `
            <h4 style="color: #e74c3c;">⚠️ Error</h4>
            <div class="info-content">
                <p style="color: #cccccc;">${message}</p>
            </div>
        `;
        errorPanel.style.borderColor = '#e74c3c';

        showInfoPanel(errorPanel);
    }

    function addInteractiveEffects() {
        // Add ripple effect to buttons
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('glass-button')) {
                createRipple(e.target, e);
            }
        });
    }

    function createRipple(button, event) {
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        // Ensure container is positioned for absolute children without inline styles elsewhere
        const prevPos = getComputedStyle(button).position;
        if (prevPos === 'static' || !prevPos) {
            button.style.position = 'relative';
        }
        button.style.overflow = 'hidden';

        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
    }

    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export functions for testing
    window.architectureVisualizer = {
        showVisualization,
        showAISuggestions,
        updateAuthStatus,
        showError
    };

})();
