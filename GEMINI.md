# Scrappy Whiteboard — Antigravity CLI (`agy`) Workspace Rules

You are operating inside the **Scrappy Whiteboard** workspace (`/Users/munron/scrappy`). This project combines an interactive **React + SVG + HTML5 Canvas Whiteboard** with **ICM Option A (Node-per-file)** storage (`boards/<board-name>/`), a persistent **Interactive Control Library (`@scrappy/ui-library`)**, and a fast CLI (`npm run wb`).

## Permission-Friendly Command Execution (No Prompt Spam)
- Workspace permission allowlists are configured in [`.gemini/settings.json`](./.gemini/settings.json) and [`.claude/settings.local.json`](./.claude/settings.local.json).
- Always run `npm run wb -- <subcommand> ...` as a **single prefix-matchable command** (avoid `&&`, `;`, or `$(...)`) so once approved, `agy` executes all future whiteboard commands automatically without prompting.

## `/update-scrappy` Workflow (Right-Click `@scrappy` Prompts)

1. **How the User Creates Prompts:**
   - The user **right-clicks anywhere on the whiteboard canvas** (or inside a Focus Region / Scope Section, or clicks **⚡ Action Open w/ @scrappy** on a Checklist widget) to open the cursor-anchored popup dialog and types or voice-dictates a prompt addressed to **`@scrappy`**.
   - In **ICM Mode**, this writes the scoped prompt contract, Focus Region / Scope Section bounds, and target output `(x, y)` coordinates to `boards/launch-plan/_prompts/ACTIVE_PROMPT.md`.
2. **How to Run `/update-scrappy` in `agy`:**
   - Read `boards/launch-plan/_prompts/ACTIVE_PROMPT.md` and follow [.agents/skills/update-scrappy/SKILL.md](./.agents/skills/update-scrappy/SKILL.md):
     ```bash
     # Option A: One-shot execution via built-in spatial & UI widget engine:
     npm run wb -- update-scrappy --board launch-plan

     # Option B: Custom step-by-step execution using @scrappy/ui-library widgets:
     npm run wb -- presence --board launch-plan --x <x> --y <y> --status "Running /update-scrappy..."
     npm run wb -- add-node --board launch-plan --type checklist --title "Bug Triage" --items "Fix resize,Lock scope,[x] Colour picker" --x <x> --y <y> --section <sectionId>
     npm run wb -- add-node --board launch-plan --type mermaid --title "System Flow" --mermaid "flowchart LR\n  A[Canvas] --> B[ICM]" --x <x> --y <y> --section <sectionId>
     npm run wb -- connect --board launch-plan --from <fromNodeId> --to <toNodeId> --label "leads to" --style solid
     npm run wb -- update-edge --board launch-plan --id <edgeId> --label "persistent" --style solid
     npm run wb -- resolve-prompt --board launch-plan --summary "Fulfilled @scrappy prompt"
     ```
3. **Maintain ICM Token Discipline (2k–8k Tokens) & Respect Scope:**
   - Always place generated nodes inside the `Target Scope Section` and `Target Output Coordinates` specified in `ACTIVE_PROMPT.md`.
