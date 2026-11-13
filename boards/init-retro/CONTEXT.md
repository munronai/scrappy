# Initial Retro — Top-Level ICM Routing Map (`CONTEXT.md`)

> **ICM Architect Workspace Router (`RinDig/icm-architect` Compatible)**
> A cold agent with zero prior memory can start at this file, identify the right pipeline or spatial section, load only the scoped `_config/` and stage `CONTEXT.md` files (maintaining 2k–8k token discipline), and execute the task.

## 1. Global Shared Context (`_config/`)
- [`_config/brand-guidelines.md`](./_config/brand-guidelines.md) — Core brand voice, principles, and output quality gates.
- [`_config/visual-style.md`](./_config/visual-style.md) — Color palette, typography, and SVG/graphic styling rules.

## 2. Registered ICM Pipelines (`@scrappy` Routing Table)
When `@scrappy` is invoked on the whiteboard, match the user request against these specialized ICM pipelines before falling back to ad-hoc agent execution:

| Pipeline ID | Pipeline Name | Trigger Intents | Stages | Shared `_config/` | Entry Point |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `brand-image-gen` | **Brand-Aligned Image & Graphic Pipeline** | `image`, `graphic`, `illustration`, `hero`, `visual`, `draw` | 3 stages (`01-prompt-spec` → `03-render-visual`) | `_config/brand-guidelines.md`, `_config/visual-style.md` | [`pipelines/brand-image-gen/CONTEXT.md`](./pipelines/brand-image-gen/CONTEXT.md) |
| `bug-triage-fix` | **ICM Bug Triage & Resolution Pipeline** | `bug`, `bugs`, `fix`, `triage`, `issue`, `broken` | 3 stages (`01-reproduce-and-scope` → `03-verification-checklist`) | `_config/brand-guidelines.md` | [`pipelines/bug-triage-fix/CONTEXT.md`](./pipelines/bug-triage-fix/CONTEXT.md) |
| `slide-deck-gen` | **Executive Slide & Narrative Deck Pipeline** | `slide`, `slides`, `deck`, `presentation`, `pitch`, `keynote` | 3 stages (`01-narrative-arc` → `03-visual-mermaid`) | `_config/brand-guidelines.md` | [`pipelines/slide-deck-gen/CONTEXT.md`](./pipelines/slide-deck-gen/CONTEXT.md) |
| `video-content-gen` | **Video Script & Storyboard Pipeline** | `video`, `youtube`, `reel`, `storyboard`, `script`, `shorts` | 3 stages (`01-hook-and-angle` → `03-production-checklist`) | `_config/brand-guidelines.md`, `_config/visual-style.md` | [`pipelines/video-content-gen/CONTEXT.md`](./pipelines/video-content-gen/CONTEXT.md) |

## 3. Active Whiteboard Scope Sections (`sections/`)
| Section Slug | Title | Nodes | Context Contract |
| :--- | :--- | :--- | :--- |
| `01_discovery` | **01. Discovery & Goals** | 3 cards | [`sections/01_discovery/CONTEXT.md`](./sections/01_discovery/CONTEXT.md) |
| `02_architecture` | **02. Architecture & Flow** | 4 cards | [`sections/02_architecture/CONTEXT.md`](./sections/02_architecture/CONTEXT.md) |
| `03_launch_plan` | **03. Launch Checklist & Integrations** | 1 cards | [`sections/03_launch_plan/CONTEXT.md`](./sections/03_launch_plan/CONTEXT.md) |

## 4. Spatial Geometry & Prompt Queue Sidecars
- **Spatial Layout Sidecar:** [`_layout.json`](./_layout.json) (stores 2D canvas coordinates, sizes, colors, and connector styles without polluting Markdown files).
- **Active `@scrappy` Prompt Queue:** [`_prompts/ACTIVE_PROMPT.md`](./_prompts/ACTIVE_PROMPT.md).
