# Scrappy Whiteboard — ICM Storage, Architect & AI Agents

> **Parent Map:** [ARCHITECTURE.md](../ARCHITECTURE.md)  
> **Primary Source Files:** [src/icm/adapter.ts](../src/icm/adapter.ts), [src/icm/architect.ts](../src/icm/architect.ts), [src/server/smartAgent.ts](../src/server/smartAgent.ts)

---

## 1. Overview

Scrappy implements **Interpretable Context Methodology (ICM) Option A (Node-per-File)** so every visual board is simultaneously a live canvas and a structured, Git-diffable directory of small Markdown contracts (`boards/<board-name>/`).

```
boards/<board-name>/
├── CONTEXT.md                 # Top-level ICM routing file (RinDig/icm-architect)
├── BOARD_MAP.md               # Human/agent readable board & section index
├── _layout.json               # Geometry, viewport, edges, pins, registered pipelines
├── _prompts/
│   └── ACTIVE_PROMPT.md       # Scoped contract for /update-scrappy
└── sections/
    └── <section-slug>/
        ├── CONTEXT.md         # Section purpose & contract
        ├── _section.json      # Section metadata & bounding box
        └── nodes/
            └── <node-id>.md   # YAML frontmatter + Markdown body
```

---

## 2. `ICMAdapter` (`src/icm/adapter.ts`)

- **Path Containment (`getBoardDir`):** Validates board slugs with `isValidBoardSlug` and enforces `resolved.startsWith(rootResolved + path.sep)` to block directory traversal. Sanitizes section slugs and node IDs via `sanitizePathSlug`.
- **Deterministic SHA-256 Echo Cancellation (`writeTrackedFile`, `fileContentHashes`):** Computes SHA-256 hashes of every file written by the server. When Chokidar (`watchBoard`) fires on disk changes, identical hashes are ignored (preventing echo loops) while external edits from agents or editors trigger `loadBoardFromDisk` and `bus.broadcastBoardSync`.
- **Markdown Round-Tripping:** Serializes and parses node frontmatter (`type`, `title`, `tags`, `checklistItems`, `mermaidCode`, `tableData`, `imageUrl`, `svgCode`, `sourceMeta`, `structuredData`) alongside Markdown headings and bodies.
- **Prompt Contract Generation (`writeActivePromptContract`):** Writes `boards/<name>/_prompts/ACTIVE_PROMPT.md` with target Scope Section bounds, clamped output `(x, y)` coordinates, matched ICM pipelines, and a token-scoped node/edge summary.
- **Workspace Seeding (`detectAndSeedExistingICMWorkspace`):** Automatically imports pre-existing ICM `sections/` or `stages/` directories into a visual board layout.

---

## 3. `ICMArchitect` (`src/icm/architect.ts`)

Compiles visual whiteboard brainstorms into structured **RinDig/icm-architect** pipelines:
- `ensureICMArchitectWorkspace`: Initializes top-level `CONTEXT.md` routing and `_config/` metadata.
- `compileCanvasToICMPipeline`: Converts a Scope Section or node selection into multi-stage ICM pipeline contracts with trigger intents and output widget bindings, optionally reflecting the compiled pipeline back onto the canvas.
- `matchPipelinesForPrompt`: Matches incoming `@scrappy` prompt intents against registered pipelines.
- `runICMWalkTest`: Verifies that a cold agent can traverse `CONTEXT.md` $\to$ stage contracts $\to$ outputs without broken links or missing context.

---

## 4. `SmartAgent` (`src/server/smartAgent.ts`)

Handles **Standalone API Mode** and local heuristic fallbacks:
- `executeStandaloneModelPrompt`: Extracts a scoped `SpatialContextSlice`, resolves scoped output coordinates (`resolveScopedPlacement`), dispatches structured JSON prompts to **Gemini** (`gemini-2.5-flash`), **Anthropic** (`claude-3-7-sonnet-latest`), or **OpenAI**, and validates returned `operations` via `validateGraphOpsBatch` (`GraphOpsBatchSchema`) before calling `applyOperations`.
- `executeInstantAgentAction`: Deterministic, zero-key heuristic fallback that synthesizes checklists, Mermaid diagrams, artistic SVG graphics (`generateArtisticSvgGraphic`), or sticky notes when no external LLM key is configured.

---

## 5. Planned ICM & Agent Evolution

1. **Async Write-Behind Debounce Queue:** Migrate `ICMAdapter` from synchronous `node:fs` calls (`writeFileSync`, `readFileSync`) to `node:fs/promises` behind a ~300ms debounced write queue so continuous drag bursts do not block the Node.js event loop.
2. **Structured Pipeline Registry:** Deepen integration between `ICMArchitect` walk-tests and the client `PipelineStudioModal`.
