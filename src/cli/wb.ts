import path from 'node:path';
import {
  applyOperations,
  AutoLayoutKind,
  extractSpatialSlice,
  extractTableFromMarkdown,
  formatTableToMarkdown,
  GraphOp,
  NodeType,
  synthesizeBoardToMarkdown,
  synthesizeBoardToMermaid,
  TableData,
} from '../core/index.js';
import { ICMAdapter } from '../icm/adapter.js';
import {
  compileCanvasToICMPipeline,
  ensureICMArchitectWorkspace,
  matchPipelinesForPrompt,
  runICMWalkTest,
} from '../icm/architect.js';
import { executeInstantAgentAction } from '../server/smartAgent.js';

const API_BASE = process.env.WB_API_URL || 'http://localhost:3000/api/v1';
const BOARDS_DIR = path.resolve(process.cwd(), 'boards');

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = { _: argv[0] || 'help' };
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function tryApiFetch(endpoint: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = String(args._);
  const boardName = String(args.board || 'launch-plan');
  const icm = new ICMAdapter(BOARDS_DIR);

  switch (command) {
    case 'context': {
      const selected = Boolean(args.selected);
      const sectionId = typeof args.section === 'string' ? args.section : undefined;
      const bboxStr = typeof args.bbox === 'string' ? args.bbox : undefined;

      const query = new URLSearchParams();
      if (selected) query.set('selected', 'true');
      if (sectionId) query.set('sectionId', sectionId);
      if (bboxStr) query.set('bbox', bboxStr);

      const apiRes = await tryApiFetch(`/boards/${boardName}/context?${query.toString()}`);
      const slice =
        apiRes?.slice ||
        extractSpatialSlice(icm.ensureBoardLoaded(boardName), {
          selectedOnly: selected,
          sectionId,
        });

      console.log(JSON.stringify(slice, null, 2));
      break;
    }

    case 'prompts': {
      const board = icm.ensureBoardLoaded(boardName);
      const pending = board.prompts.filter(
        (p) => p.status === 'pending' || p.status === 'processing'
      );
      console.log(
        JSON.stringify(
          {
            boardName,
            activePromptContractFile: `boards/${boardName}/_prompts/ACTIVE_PROMPT.md`,
            pendingCount: pending.length,
            prompts: pending,
          },
          null,
          2
        )
      );
      break;
    }

    case 'add-node': {
      const id = typeof args.id === 'string' ? args.id : undefined;
      const title = String(args.title || 'New Idea');
      let body = String(args.body || '').replace(/\\n/g, '\n');
      const type = (args.type as NodeType) || 'sticky';
      const sectionId = typeof args.section === 'string' ? args.section : undefined;
      const color = typeof args.color === 'string' ? args.color : '#fef08a';
      const tags =
        typeof args.tags === 'string'
          ? args.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : undefined;
      const x = args.x !== undefined ? Number(args.x) : undefined;
      const y = args.y !== undefined ? Number(args.y) : undefined;
      const width = args.width !== undefined ? Number(args.width) : undefined;
      const height = args.height !== undefined ? Number(args.height) : undefined;
      const mermaidCode =
        typeof args.mermaid === 'string' ? args.mermaid.replace(/\\n/g, '\n') : undefined;
      const imageUrl = typeof args.image === 'string' ? args.image : undefined;
      const svgCode = typeof args.svg === 'string' ? args.svg : undefined;
      const checklistItems =
        typeof args.items === 'string'
          ? args.items
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((itemText, idx) => {
                const checked = /^\[x\]\s*/i.test(itemText);
                return {
                  id: `chk-${Date.now().toString(36)}-${idx + 1}`,
                  text: itemText.replace(/^\[[ xX]\]\s*/, ''),
                  checked,
                };
              })
          : undefined;

      let tableData: TableData | undefined;
      if (type === 'table') {
        const columns =
          typeof args.columns === 'string'
            ? args.columns.split(',').map((c) => c.trim()).filter(Boolean)
            : undefined;
        const rows =
          typeof args.rows === 'string'
            ? args.rows
                .split(';')
                .map((r) => r.split(',').map((cell) => cell.trim()))
                .filter((r) => r.length > 0 && r[0] !== '')
            : undefined;
        const stylePreset = typeof args.preset === 'string' ? (args.preset as any) : undefined;
        const customStyleDescription =
          typeof args.styleDesc === 'string'
            ? args.styleDesc
            : typeof args.stylePrompt === 'string'
            ? args.stylePrompt
            : undefined;

        if (columns && rows) {
          tableData = {
            columns,
            rows,
            stylePreset: stylePreset || 'default',
            customStyleDescription,
          };
        } else if (body.includes('|')) {
          const parsed = extractTableFromMarkdown(body);
          if (parsed) {
            tableData = {
              ...parsed,
              stylePreset: stylePreset || 'default',
              customStyleDescription,
            };
          }
        }

        if (!tableData) {
          tableData = {
            columns: ['Item / Feature', 'Status', 'Owner'],
            rows: [
              ['Markdown Table', 'Done', 'Alex'],
              ['Visual Grid Editor', 'Done', 'Jordan'],
              ['Natural Language Styles', 'Done', 'Sam'],
            ],
            stylePreset: stylePreset || 'default',
            customStyleDescription,
          };
        }

        if (!body || !body.includes('|')) {
          body = formatTableToMarkdown(tableData);
        }
      }

      const op: GraphOp = {
        op: 'create_node',
        node: {
          id,
          type,
          sectionId,
          position: x !== undefined && y !== undefined ? { x, y } : undefined,
          size: width !== undefined && height !== undefined ? { width, height } : undefined,
          content: {
            title,
            body,
            tags,
            checklistItems,
            mermaidCode,
            imageUrl,
            svgCode,
            tableData,
          },
          style: { color },
        },
      };

      const apiRes = await tryApiFetch(`/boards/${boardName}/ops`, {
        method: 'POST',
        body: JSON.stringify({
          actorId: 'antigravity-cli',
          operations: [op],
        }),
      });

      if (!apiRes) {
        const board = icm.ensureBoardLoaded(boardName);
        applyOperations(board, [op], 'antigravity-cli');
        icm.saveBoardToDisk(board);
      }

      console.log(`✅ Created ${type} node "${title}" on board "${boardName}".`);
      break;
    }

    case 'delete-node': {
      const id = String(args.id || '');
      if (!id) {
        console.error('Error: --id <nodeId> is required.');
        process.exit(1);
      }

      const op: GraphOp = { op: 'delete_node', id };
      const apiRes = await tryApiFetch(`/boards/${boardName}/ops`, {
        method: 'POST',
        body: JSON.stringify({
          actorId: 'antigravity-cli',
          operations: [op],
        }),
      });

      if (!apiRes) {
        const board = icm.ensureBoardLoaded(boardName);
        applyOperations(board, [op], 'antigravity-cli');
        icm.saveBoardToDisk(board);
      }

      console.log(`🗑️ Deleted node "${id}" from board "${boardName}".`);
      break;
    }

    case 'connect': {
      const fromNodeId = String(args.from || '');
      const toNodeId = String(args.to || '');
      const label = typeof args.label === 'string' ? args.label : undefined;
      const style =
        args.style === 'solid' || args.style === 'dashed' || args.style === 'animated'
          ? args.style
          : 'animated';

      if (!fromNodeId || !toNodeId) {
        console.error('Error: --from <nodeId> and --to <nodeId> are required.');
        process.exit(1);
      }

      const op: GraphOp = {
        op: 'create_edge',
        edge: { fromNodeId, toNodeId, label, style, directed: true },
      };

      const apiRes = await tryApiFetch(`/boards/${boardName}/ops`, {
        method: 'POST',
        body: JSON.stringify({
          actorId: 'antigravity-cli',
          operations: [op],
        }),
      });

      if (!apiRes) {
        const board = icm.ensureBoardLoaded(boardName);
        applyOperations(board, [op], 'antigravity-cli');
        icm.saveBoardToDisk(board);
      }

      console.log(`✅ Connected ${fromNodeId} -> ${toNodeId} (${style}) on board "${boardName}".`);
      break;
    }

    case 'update-edge': {
      const id = String(args.id || '');
      if (!id) {
        console.error('Error: --id <edgeId> is required.');
        process.exit(1);
      }
      const label = typeof args.label === 'string' ? args.label : undefined;
      const style =
        args.style === 'solid' || args.style === 'dashed' || args.style === 'animated'
          ? args.style
          : undefined;

      const op: GraphOp = {
        op: 'update_edge',
        id,
        patch: {
          ...(label !== undefined ? { label } : {}),
          ...(style !== undefined ? { style } : {}),
        },
      };

      const apiRes = await tryApiFetch(`/boards/${boardName}/ops`, {
        method: 'POST',
        body: JSON.stringify({
          actorId: 'antigravity-cli',
          operations: [op],
        }),
      });

      if (!apiRes) {
        const board = icm.ensureBoardLoaded(boardName);
        applyOperations(board, [op], 'antigravity-cli');
        icm.saveBoardToDisk(board);
      }

      console.log(`✅ Updated connector edge "${id}" on board "${boardName}".`);
      break;
    }

    case 'layout': {
      const kind = (args.kind as AutoLayoutKind) || 'sections';
      const op: GraphOp = { op: 'auto_layout', layout: kind };

      const apiRes = await tryApiFetch(`/boards/${boardName}/ops`, {
        method: 'POST',
        body: JSON.stringify({
          actorId: 'antigravity-cli',
          operations: [op],
        }),
      });

      if (!apiRes) {
        const board = icm.ensureBoardLoaded(boardName);
        applyOperations(board, [op], 'antigravity-cli');
        icm.saveBoardToDisk(board);
      }

      console.log(`✅ Applied "${kind}" auto-layout to board "${boardName}".`);
      break;
    }

    case 'presence': {
      const statusText = String(args.status || 'Antigravity CLI is working on the board...');
      const x = Number(args.x || 920);
      const y = Number(args.y || 240);

      await tryApiFetch(`/boards/${boardName}/presence`, {
        method: 'POST',
        body: JSON.stringify({
          actorId: 'antigravity-cli',
          name: 'Antigravity CLI (agy)',
          role: 'agent',
          color: '#38bdf8',
          cursor: { x, y },
          statusText,
        }),
      });
      console.log(`📡 Broadcasted Antigravity CLI presence: "${statusText}"`);
      break;
    }

    case 'update-scrappy':
    case 'resolve-prompt': {
      const promptId = String(args['prompt-id'] || '');
      const summary = String(args.summary || 'Resolved @scrappy prompt via /update-scrappy');
      const autoExecute = command === 'update-scrappy' ? true : Boolean(args.auto);

      const board = icm.ensureBoardLoaded(boardName);
      const targetId =
        promptId ||
        [...board.prompts].reverse().find((p) => p.status === 'pending')?.id;

      if (!targetId) {
        console.log('ℹ️ No pending @scrappy prompt found in ACTIVE_PROMPT.md.');
        break;
      }

      const apiRes = await tryApiFetch(
        `/boards/${boardName}/prompts/${targetId}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({
            summary,
            runInstantFallback: autoExecute,
          }),
        }
      );

      if (!apiRes) {
        const target = board.prompts.find((p) => p.id === targetId);
        if (target) {
          if (autoExecute) {
            const res = executeInstantAgentAction(board, target);
            target.agentResponseSummary = res.summary;
          } else {
            target.agentResponseSummary = summary;
          }
          target.status = 'completed';
          target.completedAt = new Date().toISOString();
          board.version += 1;
          icm.saveBoardToDisk(board);
        }
      }

      console.log(`✅ Executed /update-scrappy for prompt ${targetId}: ${summary}`);
      break;
    }

    case 'export': {
      const format = String(args.format || 'markdown');
      const board = icm.ensureBoardLoaded(boardName);
      if (format === 'mermaid') {
        console.log(synthesizeBoardToMermaid(board));
      } else {
        console.log(synthesizeBoardToMarkdown(board));
      }
      break;
    }

    case 'pipelines': {
      const board = icm.ensureBoardLoaded(boardName);
      const boardDir = icm.getBoardDir(boardName);
      const meta = ensureICMArchitectWorkspace(boardDir, board);
      const promptQuery = typeof args.prompt === 'string' ? args.prompt : '';
      const matched = promptQuery ? matchPipelinesForPrompt(promptQuery, meta.pipelines) : [];
      console.log(
        JSON.stringify(
          {
            boardName,
            rootRoutingFile: meta.rootRoutingFile,
            configFiles: meta.configFiles,
            walkTest: meta.lastWalkTest,
            pipelines: meta.pipelines,
            ...(promptQuery ? { matchedPipelines: matched } : {}),
          },
          null,
          2
        )
      );
      break;
    }

    case 'build-pipeline': {
      const title = typeof args.title === 'string' ? args.title : undefined;
      const sectionId = typeof args.section === 'string' ? args.section : undefined;
      const triggers =
        typeof args.triggers === 'string'
          ? args.triggers.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;
      const outputWidgetType = (args.type as NodeType) || undefined;

      const apiRes = await tryApiFetch(`/boards/${boardName}/icm/build-pipeline`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          sectionId,
          triggerIntents: triggers,
          outputWidgetType,
          reflectOnCanvas: true,
        }),
      });

      if (apiRes?.compiled) {
        console.log(
          `🏗️ Built ICM Pipeline "${apiRes.compiled.pipeline.title}" (${apiRes.compiled.pipeline.routingPath}) | ${apiRes.compiled.walkTest.summary}`
        );
      } else {
        const board = icm.ensureBoardLoaded(boardName);
        const boardDir = icm.getBoardDir(boardName);
        const compiled = compileCanvasToICMPipeline(boardDir, board, {
          title,
          sectionId,
          triggerIntents: triggers,
          outputWidgetType,
          reflectOnCanvas: true,
        });
        board.version += 1;
        icm.saveBoardToDisk(board);
        console.log(
          `🏗️ Built ICM Pipeline "${compiled.pipeline.title}" (${compiled.pipeline.routingPath}) | ${compiled.walkTest.summary}`
        );
      }
      break;
    }

    case 'walk-test': {
      const board = icm.ensureBoardLoaded(boardName);
      const boardDir = icm.getBoardDir(boardName);
      const walkTest = runICMWalkTest(boardDir, board.icmWorkspace?.pipelines);
      console.log(JSON.stringify(walkTest, null, 2));
      break;
    }

    default: {
      console.log(`
Scrappy Whiteboard CLI (Antigravity CLI / ICM Bridge)
Usage:
  npm run wb -- context [--board launch-plan] [--selected] [--section <secId>]
  npm run wb -- prompts [--board launch-plan]
  npm run wb -- pipelines [--board launch-plan] [--prompt "image"]
  npm run wb -- build-pipeline --board launch-plan [--section <secId>] [--title "Brand Pipeline"] [--triggers "image,hero"]
  npm run wb -- walk-test [--board launch-plan]
  npm run wb -- add-node --board launch-plan --title "Title" [--body "Markdown"] [--type sticky|shape|checklist|mermaid|image|svg_graphic|table] [--columns "Col1,Col2"] [--rows "A,B;C,D"] [--preset sky|zebra|emerald|amber|purple|minimal|rounded] [--styleDesc "zebra stripes with sky blue header"] [--items "Item 1,Item 2"] [--mermaid "flowchart LR..."] [--section <secId>] [--x <x> --y <y>]
  npm run wb -- connect --board launch-plan --from <nodeId1> --to <nodeId2> [--label "leads to"] [--style solid|dashed|animated]
  npm run wb -- update-edge --board launch-plan --id <edgeId> [--label "new label"] [--style solid|dashed|animated]
  npm run wb -- layout --board launch-plan [--kind sections|grid|flowchart-lr|flowchart-tb]
  npm run wb -- presence --board launch-plan --status "Grouping sticky notes..."
  npm run wb -- update-scrappy --board launch-plan
  npm run wb -- resolve-prompt --board launch-plan [--prompt-id <id>] [--summary "Done"] [--auto]
  npm run wb -- export --board launch-plan [--format markdown|mermaid]
      `);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
