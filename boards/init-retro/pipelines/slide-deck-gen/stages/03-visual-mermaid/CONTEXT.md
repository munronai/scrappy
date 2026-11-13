---
stage: 3
slug: 03-visual-mermaid
pipeline: slide-deck-gen
---
# Stage 3: Visual Mermaid

## 1. Role & Objective
Execute stage **Visual Mermaid** for pipeline **Executive Slide & Narrative Deck Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Previous Stage Output: `../02-slide-breakdown/output/result.md`

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for final whiteboard rendering (`sticky`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** Project final deliverable card onto the active Whiteboard Scope Section.
