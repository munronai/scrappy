---
id: slide-deck-gen
title: "Executive Slide & Narrative Deck Pipeline"
description: "Transforms whiteboard notes into a structured multi-slide narrative arc, slide cards, and an accompanying Mermaid visual summary."
triggers: ["slide","slides","deck","presentation","pitch","keynote","narrative"]
configs: ["_config/brand-guidelines.md"]
stages: ["01-narrative-arc","02-slide-breakdown","03-visual-mermaid"]
outputWidgetType: sticky
---
# ICM Pipeline: Executive Slide & Narrative Deck Pipeline

> Transforms whiteboard notes into a structured multi-slide narrative arc, slide cards, and an accompanying Mermaid visual summary.

## Shared Configuration Inputs (`_config/`)
- [`_config/brand-guidelines.md`](../../_config/brand-guidelines.md)

## Stage Sequence (Execution Order)
1. [`stages/01-narrative-arc/CONTEXT.md`](./stages/01-narrative-arc/CONTEXT.md)
2. [`stages/02-slide-breakdown/CONTEXT.md`](./stages/02-slide-breakdown/CONTEXT.md)
3. [`stages/03-visual-mermaid/CONTEXT.md`](./stages/03-visual-mermaid/CONTEXT.md)

## Cold-Agent Walk Contract
1. Read the shared `_config/` files listed above.
2. Execute each stage in `stages/01-...` through `stages/0N-...` sequentially.
3. Write each stage artifact to `stages/<stage>/output/result.md` and project the final deliverable onto the whiteboard scope.
