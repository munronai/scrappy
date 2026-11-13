---
name: scrappy-whiteboard
description: Collaborate with the user on a Scrappy Whiteboard using ICM Option A files (`boards/<name>/`), the `npm run wb` CLI, or REST API to brainstorm, group sticky notes, find gaps between steps, map flows, and export boards to docs.
---

# Scrappy Whiteboard Skill for Antigravity (`agy`)

Use this skill whenever the user asks you to brainstorm on a whiteboard, process a queued whiteboard prompt, reorganize cards, find missing gaps, or turn a board into a document.

## Step-by-Step Workflow

1. **Inspect Scoped Context (ICM Discipline):**
   - Read `boards/launch-plan/_prompts/ACTIVE_PROMPT.md` if the user submitted a prompt from the UI.
   - Or run:
     ```bash
     npm run wb -- context --board launch-plan --selected
     ```
2. **Announce Agent Presence on Canvas:**
   ```bash
   npm run wb -- presence --board launch-plan --status "Analyzing selected region..."
   ```
3. **Create / Update Cards & Arrows:**
   - Use `npm run wb -- add-node`, `npm run wb -- connect`, and `npm run wb -- layout`, OR POST a batch to `http://localhost:3000/api/v1/boards/launch-plan/ops`.
   - You can also directly edit `boards/launch-plan/sections/<slug>/nodes/<node-id>.md`.
4. **Resolve Queued Prompt (if applicable):**
   ```bash
   npm run wb -- resolve-prompt --board launch-plan --summary "Grouped cards and added missing validation step"
   ```
