# Codemap — Visualize and Understand Your Codebase

Map your codebase with Codemap — Visualize Architecture, Accelerate Understanding, and ship with confidence.

## Quick overview

Codemap is a VS Code extension that scans your workspace to build a dependency graph, surfaces cycles, and helps you generate quick API docs. It ships with a sidebar webview for exploration and is designed to be extended with interactive diagrams and AI-driven analysis.

## Features

- Sidebar webview for interactive exploration
- Dependency graph from static analysis of imports/require
- Cycle detection and degree-based impact highlighting
- Quick API docs generation (`CODEMAP_API_DOCS.md`)
- Extensible architecture for AI-powered flow analysis and diagrams

## Development (quick start)

1. Install dependencies and build

```bash
cd /Users/aditya/codemap/codemap
npm install
npm run compile
```

2. Run in Extension Development Host

- Open this folder in VS Code and press `F5` to run the Extension Development Host.
- Command Palette (Cmd+Shift+P) -> `Codemap: Open` to reveal the sidebar.

## Structure

- `src/` — TypeScript sources
	- `extension.ts` — activation and command wiring
	- `codemapView.ts` — webview provider, analysis, docs generator
- `resources/` — icons and static assets (create as needed)
- `plan.md` — short-term plan and progress
- `DESIGN.md` — detailed design and architecture (added)
- `docs/architecture.md` — mermaid architecture diagram (added)

## Next steps (recommended)

1. Interactive graph rendering using `cytoscape.js` or `vis-network`.
2. Replace regex parsing with `ts-morph` or TS language service for robust resolution.
3. Add unit tests for parsing, graph building, and cycle detection.
4. Add optional AI integration (user-provided API keys) for flow-chart generation.

Contributions welcome — open issues or PRs.

---

Generated on 2025-08-15.
