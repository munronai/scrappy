import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  applyOperations,
  AutoLayoutKind,
  AutoLayoutKindSchema,
  extractSpatialSlice,
  synthesizeBoardToMarkdown,
  synthesizeBoardToMermaid,
  validateGraphOpsBatch,
} from '../core/index.js';
import { ICMAdapter } from '../icm/adapter.js';

const BOARDS_DIR = path.resolve(process.cwd(), 'boards');
const API_BASE = process.env.WB_API_URL || 'http://localhost:3000/api/v1';
const icm = new ICMAdapter(BOARDS_DIR);

async function tryApiFetch(endpoint: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const server = new Server(
  {
    name: 'scrappy-whiteboard-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'wb_get_context',
        description:
          'Fetch token-scoped spatial context from a Scrappy Whiteboard (full board, user selection, or specific section).',
        inputSchema: {
          type: 'object',
          properties: {
            boardName: { type: 'string', default: 'launch-plan' },
            selectedOnly: { type: 'boolean', default: false },
            sectionId: { type: 'string' },
          },
        },
      },
      {
        name: 'wb_mutate_batch',
        description:
          'Apply a batch of whiteboard graph operations (create_node, update_node, create_edge, create_section, auto_layout) and sync live to the React canvas and ICM files.',
        inputSchema: {
          type: 'object',
          properties: {
            boardName: { type: 'string', default: 'launch-plan' },
            operations: { type: 'array', items: { type: 'object' } },
            autoLayout: {
              type: 'string',
              enum: ['none', 'grid', 'flowchart-lr', 'flowchart-tb', 'sections'],
              default: 'none',
            },
          },
          required: ['operations'],
        },
      },
      {
        name: 'wb_export_doc',
        description:
          'Turn a whiteboard or section into a structured Markdown document or Mermaid diagram.',
        inputSchema: {
          type: 'object',
          properties: {
            boardName: { type: 'string', default: 'launch-plan' },
            format: { type: 'string', enum: ['markdown', 'mermaid'], default: 'markdown' },
            sectionId: { type: 'string' },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const boardName = String(args.boardName || 'launch-plan');

  if (name === 'wb_get_context') {
    const board = icm.ensureBoardLoaded(boardName);
    const slice = extractSpatialSlice(board, {
      selectedOnly: Boolean(args.selectedOnly),
      sectionId: typeof args.sectionId === 'string' ? args.sectionId : undefined,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(slice, null, 2) }],
    };
  }

  if (name === 'wb_mutate_batch') {
    const validation = validateGraphOpsBatch(args.operations ?? []);
    if (!validation.success) {
      return {
        isError: true,
        content: [{ type: 'text', text: validation.error }],
      };
    }

    const layoutResult = AutoLayoutKindSchema.safeParse(args.autoLayout ?? 'none');
    if (!layoutResult.success) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Invalid autoLayout: ${String(args.autoLayout)}` }],
      };
    }

    const operations = validation.operations;
    const autoLayout = layoutResult.data as AutoLayoutKind;

    const apiRes = await tryApiFetch(`/boards/${boardName}/ops`, {
      method: 'POST',
      body: JSON.stringify({
        actorId: 'antigravity-mcp',
        operations,
        autoLayout,
      }),
    });

    if (!apiRes) {
      const board = icm.ensureBoardLoaded(boardName);
      applyOperations(board, operations, 'antigravity-mcp', autoLayout);
      icm.saveBoardToDisk(board);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Applied ${operations.length} operations to board "${boardName}" (autoLayout: ${autoLayout}).`,
        },
      ],
    };
  }

  if (name === 'wb_export_doc') {
    const board = icm.ensureBoardLoaded(boardName);
    const format = String(args.format || 'markdown');
    const sectionId = typeof args.sectionId === 'string' ? args.sectionId : undefined;
    const output =
      format === 'mermaid'
        ? synthesizeBoardToMermaid(board, sectionId)
        : synthesizeBoardToMarkdown(board, sectionId);
    return {
      content: [{ type: 'text', text: output }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  console.error('MCP Server error:', err);
  process.exit(1);
});
