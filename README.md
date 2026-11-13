# Scrappy Whiteboard (`scrappy-whiteboard`)

> **The Visual Spatial Control Plane & Architect Studio for Interpretable Context Methodology (ICM)**
> *Modular, API-First, Collaborative & Agentic Whiteboard with `RinDig/icm-architect` Integration*

Scrappy Whiteboard bridges **freeform visual canvas ideation** (inspired by Claude Whiteboards, FigJam, and Miro) with **[Interpretable Context Methodology (ICM)](https://github.com/RinDig/Interpretable-Context-Methodology)**, **[`RinDig/icm-architect`](https://github.com/RinDig/icm-architect)**, and **[ICM-CCTV](https://github.com/munronai/icm-cctv)**.

While it runs as a **standalone app** with direct Model APIs (Gemini, Claude, OpenAI), Scrappy Whiteboard's primary product differentiator is its **native, bi-directional symbiosis with ICM workspaces**:
1. **Whiteboard Overlay on Any ICM Workspace:** Mount the visual canvas on top of any existing ICM repository (`CONTEXT.md`, numbered stage folders, `_config/`) using `_layout.json` as a non-invasive spatial sidecar.
2. **Brainstorm-to-ICM Pipeline Compiler (`icm-architect`):** Brainstorm ideas, checklists, and flows on the canvas, then compile them into structured, multi-stage ICM pipelines verified by the automated **Cold-Agent Walk Test**.
3. **Top-Level Routing & Pipeline-Aware `@scrappy`:** Discovers specialized pipelines registered in the root `CONTEXT.md` (e.g. brand-aligned image generation, executive slide decks, video scripts, bug triage). When summoning `@scrappy`, choose between running a governed ICM pipeline (enforcing brand/style rules in `_config/`) or letting the agent decide ad-hoc.
4. **Persistent Interactive UI Library (`@scrappy/ui-library`):** Ready-made interactive controls (`checklist`, `mermaid`, `table`, `image`, `svg_graphic`, `text`) that survive server restarts via YAML frontmatter and task-list synchronization.
5. **Dual Operation (Harness-Native & Standalone):** Works with **Antigravity CLI (`agy`)**, **Claude Code**, or **Codex** via prefix-matchable CLI commands and MCP, *or* directly with LLM provider APIs.

---

## ⚡ 60-Second Quickstart

### 1. Install & Start Server
```bash
cd /Users/munron/scrappy
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 2. Right-Click `@scrappy` & Choose Your Execution Route
1. **Right-click anywhere on the canvas** (or inside a Scope Section or card) to summon `@scrappy` directly at your cursor.
2. Type or click **`🎙️`** to voice-dictate your prompt (e.g., `@scrappy generate a hero image for our launch` or `@scrappy action the open bugs in this checklist`).
3. Notice the **`🧭 ICM Top-Level Routing (CONTEXT.md)`** selector:
   - **`🎯 Run ICM Pipeline`**: Auto-matched to a governed pipeline (e.g., `brand-image-gen`) enforcing `_config/brand-guidelines.md`.
   - **`🧠 Let Agent Decide`**: Freeform ad-hoc agent decision.
   - **`🏗️ Build Pipeline`**: Compile the current prompt and scope into a reusable ICM pipeline.
4. Click **`Write ICM ↵`** (in ICM Mode) or **`Run API ↵`** (in Standalone Model API Mode).

### 3. Run `/update-scrappy` in Antigravity CLI (`agy`)
When running in ICM Mode, execute the queued prompt using the `update-scrappy` skill or CLI:
```bash
# Execute the active prompt contract:
npm run wb -- update-scrappy --board launch-plan

# Or inspect top-level ICM pipelines & run the Walk Test:
npm run wb -- pipelines --board launch-plan
npm run wb -- walk-test --board launch-plan
```

👉 **For a step-by-step walkthrough, read [USER_GUIDE.md](./USER_GUIDE.md).**

---

## 🗂️ Named Multi-Board Storage & Canvas Tools (Phase 4)

- **Board Switcher in Top Bar:** Header dropdown displaying all existing boards (`boards/launch-plan`, `boards/sprint-4-retro`, `boards/q1-roadmap`). Switch between boards with 1 click.
- **Clean Board Initializer:** Start a 100% clean canvas with 0 objects via **`✨ Start Clean Board...`** without deleting existing boards.
- **Architectural Template Gallery:** 1-click generation from Clean Board, Product Launch Plan (3 stages), ICM Pipeline (4 stages), or Sprint Retrospective (3 columns).
- **Save Board As / Duplicate:** Clone any active board into a new folder under `boards/<new-slug>/` with all cards and layouts preserved.
- **Auto-Detection on Existing ICM Workspaces:** Mount Scrappy Whiteboard on any directory with `stages/` or `sections/` without `_layout.json` and it automatically builds the spatial layout!
- **Pointer Tool (`↖` / `V` / `1`):** Left-click and drag across canvas draws an animated selection marquee box to multi-select nodes.
- **Hand Tool (`✋` / `H` / `2`):** Left-click and drag to pan the viewport smoothly (or hold `Spacebar`).
- **Freeform Text Box (`T`):** Direct text object on canvas without borders or sticky backgrounds.
- **"Ask @scrappy" Bar (`Cmd+K`):** Floating prompt bar directly docked with quick suggestion chips.

---

## 🎨 Interactive Control Library (`@scrappy/ui-library` — `M8`)

Unlike basic whiteboards that revert custom agent outputs to static markdown on restart, Scrappy Whiteboard includes a ready-made, stateful React widget library persisted in YAML frontmatter and `_layout.json`:

| Widget Type | Toolbar Action | Description & Persistence Model |
| :--- | :--- | :--- |
| **`text`** | **`T` Freeform Text** | Frameless, flat text object directly on the canvas surface without a card border or sticky background. Supports full inline Markdown rendering (`# Headers`, `**bold**`, lists) and double-click inline editing. |
| **`checklist`** | **`☑️ + Checklist`** | Interactive bug and task tracker with checkboxes, inline add/remove, progress counter, and a **`⚡ Action Open w/ @scrappy`** button. Persists `checklistItems` in YAML frontmatter and auto-hydrates `- [ ]` / `- [x]` markdown task lists on server restart. |
| **`table`** | **`📋 + Table`** | Interactive HTML table with 4 view modes: **View** (dark mode board styling by default or themed), **Visual Grid Editor** (`+ Col`, `+ Row`, inline cell editing), **Markdown Editor** (parses and formats standard `| Col 1 | Col 2 |` tables), and **Natural Language Style Designer** (translates plain English like *"zebra stripes with sky blue header, compact font, and rounded borders"* into CSS and tokens without knowing CSS). Dual-persisted in YAML frontmatter and standard Markdown table text. |
| **`mermaid`** | **`📊 + Mermaid`** | In-place Mermaid diagram shape. Renders crisp live SVG diagrams (`flowchart`, `sequenceDiagram`, `stateDiagram`, etc.) on the canvas. Double-click or click **`✏️ Edit Mermaid`** to switch to the markdown editor; save to re-render. |
| **`image`** | **`🖼️ + Image`** / `Cmd+V` | Paste images directly from your clipboard (`Cmd+V` / `Ctrl+V`) or upload/link images. Persisted as data URIs or asset references across restarts. |
| **`svg_graphic`** | **Generated via `@scrappy`** | Bespoke vector illustrations, hub-and-spoke architectures, and visual metaphors generated dynamically by the agent (via right-click `@scrappy` prompt or the `brand-image-gen` pipeline). Scalable vector graphics stored in frontmatter `svgCode`. |
| **`data_card`** | **`⚡ Webhook Card`** | Structured key-value integration cards from Zapier, webhooks, or MCP tools with an in-card **`{ } JSON`** payload inspector. |

---

## 🏗️ ICM Architect Integration (`RinDig/icm-architect` — `M9`)

Scrappy Whiteboard incorporates the core conventions of [`RinDig/icm-architect`](https://github.com/RinDig/icm-architect):

1. **Top-Level Routing Map (`boards/<name>/CONTEXT.md`):**
   - Serves as the central umbrella router for agents.
   - Links global shared configuration (`_config/brand-guidelines.md`, `_config/visual-style.md`), registered sub-pipelines, and spatial Scope Sections.
2. **Starter ICM Pipelines Out-of-the-Box:**
   - `pipelines/brand-image-gen/` — Brand-consistent hero graphics & illustrations.
   - `pipelines/slide-deck-gen/` — Executive slide decks and narrative arcs.
   - `pipelines/video-content-gen/` — High-retention video scripts & storyboards.
   - `pipelines/bug-triage-fix/` — Systematic bug triage, root-cause analysis & verified QA.
3. **Explicit "Build ICM Pipeline" Compiler:**
   - Click **`🏗️ Build ICM Pipeline`** in the toolbar or **`🏗️ → ICM Pipeline`** on any Scope Section header.
   - Automatically orders the cards, scaffolds numbered stage directories (`stages/01-.../CONTEXT.md`), links `_config/brand-guidelines.md`, registers the new pipeline in the root `CONTEXT.md`, and renders the stages back onto the canvas.
4. **Automated Cold-Agent "Walk Test":**
   - Validates that a cold agent starting at `CONTEXT.md` can navigate every stage, resolve all config references, and execute the workflow with zero broken links.
   - Displays a live **`✅ Walk Test Passed`** badge on the whiteboard and in the UI modal.

---

## 📐 Modular System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Clients & Agent Interfaces                      │
│   Web Canvas UI (React/SVG)  •  Antigravity CLI (agy)  •  MCP Tools   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / WebSocket / CLI
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Scrappy Whiteboard Engine                        │
│  M1: Canonical Scene Graph     M2: REST API Gateway   M3: Realtime Bus │
│  M6: Smart Agent Engine        M7: Canvas UI (React)  M8: UI Library   │
│  M9: ICM Architect Bridge (RinDig/icm-architect & Cold-Agent Walk)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Bi-Directional File Sync (chokidar)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    ICM Option A Filesystem Workspace                   │
│  CONTEXT.md (Root Router)  •  _config/  •  pipelines/  •  sections/    │
└────────────────────────────────────────────────────────────────────────┘
```

| Module | Location | Description |
| :--- | :--- | :--- |
| **`M1` Core Engine** | `src/core/engine.ts` | Scene graph operations, auto-layout (dagre/grid/sections), spatial context slicing (`bbox`), table styling parser, and document state. |
| **`M2` REST API** | `src/server/index.ts` | `/api/v1/boards/:name`, `/ops`, `/prompts`, `/ingest`, `/files`, and `/export`. |
| **`M3` Realtime Bus** | `src/realtime/bus.ts` | Pluggable pub/sub & presence transport (`ws` native + Ably readiness). |
| **`M4` CLI & MCP** | `src/cli/wb.ts` & `src/mcp/server.ts` | Antigravity CLI integration (`npm run wb`) and MCP tool endpoints. |
| **`M5` ICM Adapter** | `src/icm/adapter.ts` | Option A file mapper (`sections/*/nodes/*.md`), `_layout.json` persistence, and `chokidar` watcher. |
| **`M6` Smart Agent** | `src/server/smartAgent.ts` | Instant agent actions (graphics, checklists, tables, suggestions) and Model API integration. |
| **`M7` Canvas UI** | `src/client/App.tsx` | Infinite HTML5 canvas grid + SVG connectors + React cards & inspectors. |
| **`M8` UI Library** | `src/client/widgets/` | Stateful, persistent widgets (`ChecklistWidget`, `MermaidWidget`, `TableWidget`, `SvgGraphicWidget`). |
| **`M9` ICM Architect** | `src/icm/architect.ts` | Compiler for `RinDig/icm-architect`, root `CONTEXT.md` router, and Walk Test verifier. |

---

## 🧪 Testing & Verification

Run the full automated test suite:
```bash
npm test
```
Build production client bundle:
```bash
npm run build
```

---

## 📄 License
MIT
