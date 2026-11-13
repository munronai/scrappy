---
stage: 2
slug: 02-scene-storyboard
pipeline: video-content-gen
---
# Stage 2: Scene Storyboard

## 1. Role & Objective
Execute stage **Scene Storyboard** for pipeline **Video Script & Storyboard Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Shared Config: `../../../../_config/visual-style.md`
- Previous Stage Output: `../01-hook-and-angle/output/result.md`

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for Stage 3 (`03-production-checklist`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** `../03-production-checklist/CONTEXT.md`
