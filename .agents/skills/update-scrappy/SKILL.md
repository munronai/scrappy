---
name: update-scrappy
description: >-
  Use this skill when the user invokes `/update-scrappy` or asks to process the
  active `@scrappy` whiteboard prompt stored in `boards/<board-name>/_prompts/ACTIVE_PROMPT.md`.
---

# `/update-scrappy` — Execute Queued `@scrappy` Whiteboard Prompts

When the user right-clicks on the Scrappy Whiteboard canvas and addresses `@scrappy ...` in **ICM Mode**, the scoped prompt contract, Focus Region / Scope Section bounds, and right-click anchor coordinates `(x, y)` are written to `boards/launch-plan/_prompts/ACTIVE_PROMPT.md`.

## Important Permission & Command Rules (Zero Prompt Spam)
- **Always invoke `npm run wb -- ...` as a single standalone command** (do NOT chain with `&&`, `;`, or `$(...)`) so Antigravity prefix-matching auto-approves every whiteboard CLI action.
- **Respect the Focus Region / Scope Section:** Always pass `--section <sectionId>` and `--x <outputX> --y <outputY>` from `ACTIVE_PROMPT.md` so generated cards stay locked inside the user's target scope or focus region.
- **Use Ready-Made `@scrappy/ui-library` Controls (`M8`):** Prefer `--type checklist`, `--type mermaid`, `--type svg_graphic`, or `--type image` instead of generating raw Markdown when the user asks for interactive checklists, diagrams, or visual illustrations.

## Steps to Run `/update-scrappy`

1. **Read the Active `@scrappy` Prompt Contract:**
   Read [`boards/launch-plan/_prompts/ACTIVE_PROMPT.md`](../../../boards/launch-plan/_prompts/ACTIVE_PROMPT.md) to inspect:
   - The user's `@scrappy` instruction
   - The **Target Output Coordinates (`--x`, `--y`)** and **Target Scope Section (`--section`)** (respecting any active Focus Region or Scope Section)
   - The token-scoped spatial context (including any interactive `checklist` bug items)

2. **Broadcast Live `@scrappy` Agent Presence at the Cursor Anchor:**
   ```bash
   npm run wb -- presence --board launch-plan --x <anchorX> --y <anchorY> --status "Running /update-scrappy..."
   ```

3. **Fulfill the `@scrappy` Instruction:**
   - **Option A (One-Shot Built-In Spatial & UI Library Engine):** Run the built-in spatial engine (which automatically generates interactive `checklist` widgets, in-place `mermaid` diagrams, artistic `svg_graphic` visuals, or actions open bugs from a checklist inside the target Focus Region / Scope Section):
     ```bash
     npm run wb -- update-scrappy --board launch-plan
     ```
   - **Option B (Custom Agent Actions via `@scrappy/ui-library`):**
     - Create an interactive checklist card:
       ```bash
       npm run wb -- add-node --board launch-plan --type checklist --title "Bug Triage Checklist" --items "Fix scope resize,Lock child cards,[x] Add color picker" --x <outputX> --y <outputY> --section <sectionId>
       ```
     - Create an in-place Mermaid diagram card:
       ```bash
       npm run wb -- add-node --board launch-plan --type mermaid --title "Architecture Flow" --mermaid "flowchart LR\n  A[Canvas] --> B[ICM Option A]" --x <outputX> --y <outputY> --section <sectionId>
       ```
     - Connect nodes or update connector line style (`solid` | `dashed` | `animated`) and label:
       ```bash
       npm run wb -- connect --board launch-plan --from <fromId> --to <toId> --label "triggers" --style solid
       ```
       ```bash
       npm run wb -- update-edge --board launch-plan --id <edgeId> --label "persistent" --style solid
       ```
     - Mark the prompt resolved (`ACTIVE_PROMPT.md` resets to `IDLE`):
       ```bash
       npm run wb -- resolve-prompt --board launch-plan --summary "Fulfilled @scrappy prompt via /update-scrappy"
       ```
