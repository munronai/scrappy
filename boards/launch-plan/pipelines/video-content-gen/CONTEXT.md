---
id: video-content-gen
title: "Video Script & Storyboard Pipeline"
description: "Produces a high-retention video hook, scene-by-scene visual storyboard, and an interactive production checklist."
triggers: ["video","youtube","reel","storyboard","script","shorts","demo video"]
configs: ["_config/brand-guidelines.md","_config/visual-style.md"]
stages: ["01-hook-and-angle","02-scene-storyboard","03-production-checklist"]
outputWidgetType: checklist
---
# ICM Pipeline: Video Script & Storyboard Pipeline

> Produces a high-retention video hook, scene-by-scene visual storyboard, and an interactive production checklist.

## Shared Configuration Inputs (`_config/`)
- [`_config/brand-guidelines.md`](../../_config/brand-guidelines.md)
- [`_config/visual-style.md`](../../_config/visual-style.md)

## Stage Sequence (Execution Order)
1. [`stages/01-hook-and-angle/CONTEXT.md`](./stages/01-hook-and-angle/CONTEXT.md)
2. [`stages/02-scene-storyboard/CONTEXT.md`](./stages/02-scene-storyboard/CONTEXT.md)
3. [`stages/03-production-checklist/CONTEXT.md`](./stages/03-production-checklist/CONTEXT.md)

## Cold-Agent Walk Contract
1. Read the shared `_config/` files listed above.
2. Execute each stage in `stages/01-...` through `stages/0N-...` sequentially.
3. Write each stage artifact to `stages/<stage>/output/result.md` and project the final deliverable onto the whiteboard scope.
