# Architecture Diagram

```mermaid
flowchart TD
  subgraph VSCode Extension Host
    A[extension.ts] --> B[CodemapViewProvider]
    B --> C[Analyzer]
    B --> D[Webview UI]
  end

  subgraph Analyzer
    C --> E[File Scanner]
    E --> F[Import Extractor]
    F --> G[Graph Builder]
    G --> H[Cycle Detector]
  end

  subgraph Webview
    D --> I[Graph Renderer]
    D --> J[Controls (Refresh, Docs)]
  end

  H --> D
  G --> D
```

Notes:
- `Analyzer` reads workspace files and emits the graph to the webview.
- `Webview` renders using client-side graph library (future: cytoscape/vis).
