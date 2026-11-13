---
stage: 3
slug: 03-production-checklist
pipeline: video-content-gen
---
# Stage 3: Production Checklist

## 1. Role & Objective
Execute stage **Production Checklist** for pipeline **Video Script & Storyboard Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Shared Config: `../../../../_config/visual-style.md`
- Previous Stage Output: `../02-scene-storyboard/output/result.md`

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for final whiteboard rendering (`checklist`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** Project final deliverable card onto the active Whiteboard Scope Section.
