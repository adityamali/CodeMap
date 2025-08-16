# Codemap — Design Document

Purpose
-------
Codemap helps developers quickly understand repository architecture by producing dependency graphs, detecting cycles, and generating summarized docs and diagrams.

Goals
-----
- Provide a responsive developer-focused sidebar UI inside VS Code.
- Produce accurate module-level dependency graphs.
- Surface cycles and hotspots with clear visual cues.
- Be extensible for AI-based higher-level analysis (flow diagrams, user journeys).

Architecture Overview
---------------------
- Extension Host (TypeScript): activation, commands, provider registration.
- Webview UI: single-page web app inside the sidebar, renders graph and controls.
- Analyzer: workspace scanner that extracts import relationships and produces a graph.
- Doc generator: simple markdown output, later extended to mermaid diagrams.

Core components
---------------
1. `extension.ts`
   - Registers `CodemapViewProvider`.
   - Registers commands (`open`, `refresh`, `generateDocs`).

2. `codemapView.ts`
   - Implements `WebviewViewProvider`.
   - Runs workspace analysis when requested or on resolve.
   - Posts graph data to the webview.
   - Implements `generateDocs()` which writes a markdown file.

3. Webview UI
   - Lightweight glassy UI (CSS) with controls.
   - Receives graph data via `postMessage`.
   - Renders in a compact, developer-centric layout.

Data model
----------
- Graph
  - nodes: string[] (module/file identifiers)
  - edges: Array<{ from: string, to: string }>

Analysis details
----------------
- Initial analysis uses regex-based extraction of `import` and `require` statements (fast, best-effort).
- For production, replace with `ts-morph` to fully resolve module specifiers, support path mappings, and correctly handle index files and extensions.

UI and interactions
-------------------
- Controls: Refresh, Generate Docs.
- Graph interactions (future): click node to open file, hover for quick details, filter by file type, focus on subtree.

AI integration (future)
-----------------------
- Add an LLM provider interface to generate flow-charts and natural-language summaries from selected code contexts.
- Keep AI integration optional and behind explicit user consent and settings.

Security and privacy
--------------------
- No external network calls by default.
- For AI features: prompt/usage must be opt-in; user provides API keys; user chooses which files to send.

Testing
-------
- Unit tests for import extraction and cycle detection.
- Integration tests to ensure webview messages are sent and files are written.

Roadmap (short-term)
--------------------
- Interactive graph renderer
- ts-morph based resolution
- File open-on-click
- Basic unit tests

Roadmap (mid-term)
------------------
- Impact heatmaps (git-based / coverage-based weighting)
- AI-based flow diagrams and step-throughs

