---
stage: 2
slug: 02-slide-breakdown
pipeline: slide-deck-gen
---
# Stage 2: Slide Breakdown

## 1. Role & Objective
Execute stage **Slide Breakdown** for pipeline **Executive Slide & Narrative Deck Pipeline**.

## 2. Required Inputs
- Shared Config: `../../../../_config/brand-guidelines.md`
- Previous Stage Output: `../01-narrative-arc/output/result.md`

## 3. Process & Instructions
- Maintain ICM token discipline (read only the inputs listed above).
- Apply brand & visual rules from `_config/` where applicable.
- Produce a structured artifact ready for Stage 3 (`03-visual-mermaid`).

## 4. Output Contract & Gate Check
- **Output File:** `./output/result.md`
- **Next Handoff:** `../03-visual-mermaid/CONTEXT.md`
