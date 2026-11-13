import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import {
  applyOperations,
  AutoLayoutKind,
  BoardDocument,
  extractSpatialSlice,
  GraphOp,
  isValidBoardSlug,
  OpsBatchRequestSchema,
  PromptRequest,
  synthesizeBoardToMarkdown,
  synthesizeBoardToMermaid,
} from '../core/index.js';
import { ICMAdapter } from '../icm/adapter.js';
import {
  compileCanvasToICMPipeline,
  ensureICMArchitectWorkspace,
  matchPipelinesForPrompt,
  runICMWalkTest,
} from '../icm/architect.js';
import { RealtimeBus } from '../realtime/bus.js';
import {
  executeInstantAgentAction,
  executeStandaloneModelPrompt,
} from './smartAgent.js';

const PORT = Number(process.env.PORT || 3000);
const BOARDS_DIR = path.resolve(process.cwd(), 'boards');

export async function createServer() {
  const app = express();

  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, CLI, or same-origin)
        if (!origin) return callback(null, true);

        // Allow localhost and 127.0.0.1 on any port (for local dev and vite)
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }

        // Allow explicitly configured origins (e.g. Tailscale or custom domain)
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        callback(new Error(`CORS policy does not allow access from origin ${origin}`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '5mb' }));

  // Validate all :name board slug parameters against path traversal and invalid characters
  app.param('name', (req, res, next, name) => {
    if (!isValidBoardSlug(name)) {
      return res.status(400).json({
        error:
          'Invalid board name: must be 1-64 alphanumeric, dash, or underscore characters without path traversal.',
      });
    }
    next();
  });

  const server = http.createServer(app);
  const icm = new ICMAdapter(BOARDS_DIR);
  const boardsCache = new Map<string, BoardDocument>();
  const AUTH_SECRET = process.env.SCRAPPY_AUTH_SECRET || 'scrappy-token-secret-key-default';

  function verifyToken(tokenStr: string, boardName: string): boolean {
    try {
      const [payloadB64, signature] = tokenStr.split('.');
      if (!payloadB64 || !signature) return false;
      const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('hex');
      if (signature !== expectedSig) return false;
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      if (payload.boardName !== boardName) return false;
      if (payload.exp && Date.now() > payload.exp) return false;
      return true;
    } catch {
      return false;
    }
  }

  function createSignedToken(boardName: string, actorId: string, role = 'human'): string {
    const payload = {
      boardName,
      actorId,
      role,
      capabilities: ['read', 'write', 'agent', 'admin'],
      iat: Date.now(),
      exp: Date.now() + 24 * 3600 * 1000,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('hex');
    return `${payloadB64}.${signature}`;
  }

  const bus = new RealtimeBus({
    server,
    onRemoteDelta: (boardName, operations, actorId, version) => {
      const board = getBoard(boardName);
      applyOperations(board, operations, actorId);
      icm.saveBoardToDisk(board);
    },
    validateConnection: (boardName, reqUrl) => {
      const board = getBoard(boardName);
      if (board.security.mode !== 'passcode') {
        return { allowed: true };
      }
      const token = reqUrl.searchParams.get('token');
      if (token && verifyToken(token, boardName)) {
        return { allowed: true };
      }
      const passcode = reqUrl.searchParams.get('passcode');
      if (passcode) {
        const hash = crypto.createHash('sha256').update(String(passcode)).digest('hex');
        if (hash === board.security.passcodeHash) {
          return { allowed: true };
        }
      }
      return { allowed: false, error: 'Passcode or valid token required' };
    },
  });

  function getBoard(name: string): BoardDocument {
    if (!boardsCache.has(name)) {
      const loaded = icm.ensureBoardLoaded(name);
      boardsCache.set(name, loaded);
      icm.watchBoard(name, (updatedBoard, changedFile) => {
        boardsCache.set(name, updatedBoard);
        bus.broadcastBoardSync(name, updatedBoard, `icm-file:${changedFile}`);
        bus.broadcastAgentActivity(
          name,
          'icm-watcher',
          `Synced ICM file change: ${changedFile}`
        );
      });
    }
    return boardsCache.get(name)!;
  }

  function persistAndBroadcast(
    board: BoardDocument,
    source = 'api',
    deltaOps?: GraphOp[]
  ): void {
    boardsCache.set(board.name, board);
    icm.scheduleSaveBoard(board);
    if (deltaOps && deltaOps.length > 0) {
      bus.broadcastDelta(board.name, deltaOps, board.version, source, source);
    } else {
      bus.broadcastBoardSync(board.name, board, source);
    }
  }

  // Ensure default "launch-plan" board is initialized on startup
  getBoard('launch-plan');

  // --- REST API v1 ---

  // 1. List or create boards
  app.get('/api/v1/boards', (_req, res) => {
    res.json({ boards: icm.listBoards() });
  });

  app.post('/api/v1/boards', (req, res) => {
    const { name, title, template, cloneFrom } = req.body || {};
    if (cloneFrom && !isValidBoardSlug(cloneFrom)) {
      return res.status(400).json({ error: 'Invalid cloneFrom board name.' });
    }
    const slug = (name || (cloneFrom ? `${cloneFrom}-copy` : 'new-board'))
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!isValidBoardSlug(slug)) {
      return res.status(400).json({ error: 'Invalid board name.' });
    }

    let board: BoardDocument;
    if (cloneFrom) {
      board = icm.duplicateBoard(cloneFrom, slug, title);
    } else {
      board = icm.ensureBoardLoaded(slug, title || name || slug, template || 'default');
    }
    boardsCache.set(slug, board);
    bus.broadcastBoardSync(slug, board, 'board-created');
    res.status(201).json({ board });
  });

  // Duplicate an existing board
  app.post('/api/v1/boards/:name/duplicate', (req, res) => {
    const sourceName = req.params.name;
    const { targetName, title } = req.body || {};
    const slug = (targetName || `${sourceName}-copy`)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!isValidBoardSlug(slug)) {
      return res.status(400).json({ error: 'Invalid target board name.' });
    }
    const board = icm.duplicateBoard(sourceName, slug, title);
    boardsCache.set(slug, board);
    bus.broadcastBoardSync(slug, board, 'board-duplicated');
    res.status(201).json({ board });
  });

  // Force reload board from disk files
  app.post('/api/v1/boards/:name/reload', (req, res) => {
    const name = req.params.name;
    const board = icm.loadBoardFromDisk(name);
    boardsCache.set(name, board);
    bus.broadcastBoardSync(name, board, 'reload-disk');
    res.json({ board });
  });

  // Delete a non-default board
  app.delete('/api/v1/boards/:name', (req, res) => {
    const name = req.params.name;
    if (name === 'launch-plan') {
      return res.status(400).json({ error: 'Cannot delete default launch-plan board' });
    }
    boardsCache.delete(name);
    const deleted = icm.deleteBoard(name);
    res.json({ success: deleted });
  });

  // 2. Get full board state
  app.get('/api/v1/boards/:name', (req, res) => {
    const board = getBoard(req.params.name);
    res.json({
      board,
      collaborators: bus.getPresence(board.name),
    });
  });

  // Unified Auth & Token Exchange (Native WS & Ably TokenRequest)
  app.post(['/api/v1/auth/token', '/api/v1/boards/:name/auth'], async (req, res) => {
    const boardName = (req.params.name || req.body?.boardName || 'launch-plan').toLowerCase();
    const board = getBoard(boardName);
    const { passcode, actorId = `user-${Math.random().toString(36).slice(2, 7)}`, role = 'human' } =
      req.body || {};

    if (board.security.mode === 'passcode') {
      const expectedHash = board.security.passcodeHash;
      if (expectedHash) {
        const providedHash = passcode
          ? crypto.createHash('sha256').update(String(passcode)).digest('hex')
          : '';
        if (providedHash !== expectedHash) {
          return res.status(401).json({ error: 'Invalid room passcode.' });
        }
      }
    }

    const token = createSignedToken(boardName, actorId, role);
    let ablyTokenRequest: any = null;

    if (bus.hasAbly() && bus.getAblyBridge()) {
      try {
        ablyTokenRequest = await bus.getAblyBridge()!.createTokenRequest(boardName, actorId);
      } catch (err) {
        console.warn('[Server] Failed to create Ably TokenRequest:', err);
      }
    }

    res.json({
      ok: true,
      boardName,
      actorId,
      token,
      mode: board.security.mode,
      capabilities: ['read', 'write', 'agent', 'admin'],
      transport: bus.getTransportMode(),
      hasAbly: bus.hasAbly(),
      ablyTokenRequest,
    });
  });

  // Update Board Security Settings (Public vs Passcode)
  app.post('/api/v1/boards/:name/security', (req, res) => {
    const board = getBoard(req.params.name);
    const { mode, passcode, allowedGroups } = req.body || {};

    if (mode === 'passcode') {
      if (passcode) {
        board.security = {
          mode: 'passcode',
          passcodeHash: crypto.createHash('sha256').update(String(passcode)).digest('hex'),
          allowedGroups,
        };
      } else if (board.security.passcodeHash) {
        board.security.mode = 'passcode';
      } else {
        return res.status(400).json({ error: 'Passcode is required to enable passcode protection.' });
      }
    } else {
      board.security = {
        mode: 'public',
      };
    }

    persistAndBroadcast(board, 'security-update');
    res.json({
      ok: true,
      security: {
        mode: board.security.mode,
        hasPasscode: !!board.security.passcodeHash,
      },
    });
  });

  // Realtime Diagnostics & Transport Info
  app.get('/api/v1/realtime/info', (_req, res) => {
    res.json({
      transport: bus.getTransportMode(),
      hasAbly: bus.hasAbly(),
      collaboratorCount: bus.getPresence('launch-plan').length,
    });
  });

  // 3. Get scoped spatial context slice (ICM Token Discipline)
  app.get('/api/v1/boards/:name/context', (req, res) => {
    const board = getBoard(req.params.name);
    const selectedOnly = req.query.selected === 'true';
    const sectionId = req.query.sectionId as string | undefined;
    let bbox: { x: number; y: number; width: number; height: number } | undefined;
    if (typeof req.query.bbox === 'string') {
      const parts = req.query.bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
        bbox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
      }
    }
    const slice = extractSpatialSlice(board, {
      selectedOnly,
      sectionId,
      bbox,
    });
    res.json({ slice });
  });

  // 4. Apply batch of graph operations
  app.post('/api/v1/boards/:name/ops', (req, res) => {
    const board = getBoard(req.params.name);
    const parsed = OpsBatchRequestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid graph operations payload',
        details: parsed.error.issues,
      });
      return;
    }

    const operations = parsed.data.operations as GraphOp[];
    const actorId = parsed.data.actorId;
    const autoLayout = parsed.data.autoLayout as AutoLayoutKind;

    applyOperations(board, operations, actorId, autoLayout);
    persistAndBroadcast(board, actorId, operations);

    if (actorId !== 'human') {
      bus.broadcastAgentActivity(
        board.name,
        actorId,
        `Applied ${operations.length} operation(s) to board`
      );
    }

    res.json({ board, version: board.version });
  });

  // 5. Submit or queue a @scrappy prompt (ICM Mode -> ACTIVE_PROMPT.md, Standalone Mode -> Model API)
  app.post('/api/v1/boards/:name/prompts', async (req, res) => {
    const board = getBoard(req.params.name);
    const {
      prompt,
      mode = 'icm',
      executionRoute,
      selectedPipelineId,
      anchorPosition,
      targetNodeId,
      selectedNodeIds,
      selectedSectionId,
      boundingBox,
      apiConfig,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    const normalizedMode: 'icm' | 'standalone_api' =
      mode === 'standalone_api' || mode === 'instant_local' ? 'standalone_api' : 'icm';

    const activeNodeIds = Array.isArray(selectedNodeIds)
      ? selectedNodeIds
      : board.activeSelection.nodeIds;

    const slice = extractSpatialSlice(board, {
      selectedOnly: activeNodeIds.length > 0,
      sectionId: selectedSectionId || board.activeSelection.sectionId,
      bbox: boundingBox || board.activeSelection.boundingBox,
    });

    const formattedPrompt = prompt.trim().toLowerCase().startsWith('@scrappy')
      ? prompt.trim()
      : `@scrappy ${prompt.trim()}`;

    const promptReq: PromptRequest = {
      id: `prompt-${Date.now().toString(36)}`,
      boardName: board.name,
      prompt: formattedPrompt,
      mode: normalizedMode,
      executionRoute: executionRoute || (selectedPipelineId ? 'pipeline' : 'adhoc'),
      selectedPipelineId,
      status: normalizedMode === 'standalone_api' ? 'processing' : 'pending',
      anchorPosition,
      targetNodeId,
      selectedNodeIds: activeNodeIds,
      selectedSectionId: selectedSectionId || board.activeSelection.sectionId,
      boundingBox: boundingBox || board.activeSelection.boundingBox,
      tokenEstimate: slice.tokenEstimate,
      createdAt: new Date().toISOString(),
    };

    board.prompts.push(promptReq);

    if (normalizedMode === 'standalone_api') {
      bus.updatePresence(board.name, {
        actorId: '@scrappy-api',
        name: '@scrappy (Model API)',
        role: 'agent',
        color: '#38bdf8',
        cursor: anchorPosition || {
          x: slice.nodes[0]?.position.x || 400,
          y: slice.nodes[0]?.position.y || 250,
        },
        statusText: `Processing: ${promptReq.prompt.slice(0, 38)}...`,
        updatedAt: Date.now(),
      });

      const result = await executeStandaloneModelPrompt(board, promptReq, apiConfig);
      promptReq.status = 'completed';
      promptReq.completedAt = new Date().toISOString();
      promptReq.agentResponseSummary = `${result.summary} [${result.usedProvider}]`;

      bus.broadcastAgentActivity(board.name, '@scrappy-api', promptReq.agentResponseSummary);
    } else {
      bus.broadcastAgentActivity(
        board.name,
        '@scrappy-icm',
        `Wrote "${promptReq.prompt}" to boards/${board.name}/_prompts/ACTIVE_PROMPT.md — run /update-scrappy in agy`
      );
    }

    board.version += 1;
    persistAndBroadcast(board, 'prompt-engine');
    res.status(201).json({ prompt: promptReq, board });
  });

  // 6. Resolve a pending prompt (called by Antigravity CLI `npm run wb -- resolve-prompt`)
  app.post('/api/v1/boards/:name/prompts/:promptId/resolve', (req, res) => {
    const board = getBoard(req.params.name);
    const { summary = 'Completed by Antigravity CLI', runInstantFallback = false } = req.body || {};
    const target = board.prompts.find((p) => p.id === req.params.promptId);

    if (!target) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    if (runInstantFallback) {
      const result = executeInstantAgentAction(board, target);
      target.agentResponseSummary = result.summary;
    } else {
      target.agentResponseSummary = summary;
    }

    target.status = 'completed';
    target.completedAt = new Date().toISOString();
    board.version += 1;
    persistAndBroadcast(board, 'antigravity-cli');
    bus.broadcastAgentActivity(board.name, 'antigravity-cli', target.agentResponseSummary!);

    res.json({ prompt: target, board });
  });

  // 7. Ingest external data (Webhooks / Zapier / MCP Integrations -> Data Cards)
  app.post('/api/v1/boards/:name/ingest', (req, res) => {
    const board = getBoard(req.params.name);
    const {
      source = 'external-webhook',
      externalId,
      title,
      body = '',
      structuredData = {},
      status = 'active',
      url,
      sectionId,
    } = req.body || {};

    // Check idempotency if externalId already exists on board
    const existingNode = externalId
      ? Object.values(board.nodes).find(
          (n) => n.content.sourceMeta?.externalId === externalId
        )
      : undefined;

    const pin = Object.values(board.pins)[0];
    const targetSectionId =
      sectionId || pin?.targetSectionId || Object.keys(board.sections)[0];

    if (existingNode) {
      applyOperations(
        board,
        [
          {
            op: 'update_node',
            id: existingNode.id,
            patch: {
              content: {
                title: title || existingNode.content.title,
                body: body || existingNode.content.body,
                structuredData: {
                  ...existingNode.content.structuredData,
                  ...structuredData,
                },
                sourceMeta: {
                  provider: source,
                  externalId,
                  status,
                  url: url || existingNode.content.sourceMeta?.url,
                },
              },
            },
          },
        ],
        `ingest:${source}`
      );
    } else {
      applyOperations(
        board,
        [
          {
            op: 'create_node',
            node: {
              type: 'data_card',
              sectionId: targetSectionId,
              size: { width: 280, height: 185 },
              content: {
                title: title || `${source.toUpperCase()} Event`,
                body,
                structuredData,
                sourceMeta: {
                  provider: source,
                  externalId: externalId || `evt-${Date.now().toString(36)}`,
                  status,
                  url,
                },
              },
              style: { color: '#a7f3d0' },
            },
          },
        ],
        `ingest:${source}`
      );
    }

    persistAndBroadcast(board, `ingest:${source}`);
    bus.broadcastAgentActivity(
      board.name,
      `ingest:${source}`,
      `Rendered data card "${title || externalId || source}" onto board`
    );

    res.status(201).json({ board });
  });

  // 8. Announce Agent / Collaborator Presence over HTTP (for CLI / MCP calls)
  app.post('/api/v1/boards/:name/presence', (req, res) => {
    const board = getBoard(req.params.name);
    const {
      actorId = 'antigravity-cli',
      name = 'Antigravity CLI',
      role = 'agent',
      color = '#38bdf8',
      cursor = { x: 880, y: 220 },
      statusText = 'Inspecting whiteboard context...',
    } = req.body || {};

    bus.updatePresence(board.name, {
      actorId,
      name,
      role,
      color,
      cursor,
      statusText,
      updatedAt: Date.now(),
    });
    bus.broadcastAgentActivity(board.name, actorId, statusText);
    res.json({ ok: true, collaborators: bus.getPresence(board.name) });
  });

  // 9. Export board to Markdown Doc or Mermaid diagram
  app.get('/api/v1/boards/:name/export', (req, res) => {
    const board = getBoard(req.params.name);
    const format = (req.query.format as string) || 'markdown';
    const sectionId = req.query.sectionId as string | undefined;

    if (format === 'mermaid') {
      res.json({
        format: 'mermaid',
        content: synthesizeBoardToMermaid(board, sectionId),
      });
      return;
    }

    res.json({
      format: 'markdown',
      content: synthesizeBoardToMarkdown(board, sectionId),
    });
  });

  // 10. Inspect live ICM Option A files on disk (for the Glass-Box ICM-CCTV Drawer)
  app.get('/api/v1/boards/:name/files', (req, res) => {
    const board = getBoard(req.params.name);
    res.json({
      boardDir: `boards/${board.name}`,
      files: icm.listBoardFiles(board.name),
    });
  });

  // 11. ICM Architect: List Top-Level Routing File (`CONTEXT.md`), `_config/`, and Registered Pipelines
  app.get('/api/v1/boards/:name/icm/pipelines', (req, res) => {
    const board = getBoard(req.params.name);
    const boardDir = icm.getBoardDir(board.name);
    const meta = ensureICMArchitectWorkspace(boardDir, board);
    const queryPrompt = typeof req.query.prompt === 'string' ? req.query.prompt : '';
    const matched = queryPrompt ? matchPipelinesForPrompt(queryPrompt, meta.pipelines) : [];
    res.json({
      icmWorkspace: meta,
      matchedPipelines: matched,
    });
  });

  // 12. ICM Architect: Explicitly Build / Compile an ICM Pipeline from Whiteboard Brainstorm
  app.post('/api/v1/boards/:name/icm/build-pipeline', (req, res) => {
    const board = getBoard(req.params.name);
    const boardDir = icm.getBoardDir(board.name);
    const {
      pipelineId,
      title,
      description,
      triggerIntents,
      sectionId,
      nodeIds,
      outputWidgetType,
      reflectOnCanvas = true,
    } = req.body || {};

    const compiled = compileCanvasToICMPipeline(boardDir, board, {
      pipelineId,
      title,
      description,
      triggerIntents: Array.isArray(triggerIntents)
        ? triggerIntents
        : typeof triggerIntents === 'string'
          ? triggerIntents.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      sectionId,
      nodeIds,
      outputWidgetType,
      reflectOnCanvas,
    });

    board.version += 1;
    persistAndBroadcast(board, 'icm-architect');
    bus.broadcastAgentActivity(
      board.name,
      'icm-architect',
      `🏗️ Built ICM Pipeline "${compiled.pipeline.title}" (${compiled.pipeline.stages.length} stages) — ${compiled.walkTest.summary}`
    );

    res.status(201).json({
      compiled,
      board,
    });
  });

  // 13. ICM Architect: Run Cold-Agent Walk Test Verification
  app.post('/api/v1/boards/:name/icm/walk-test', (req, res) => {
    const board = getBoard(req.params.name);
    const boardDir = icm.getBoardDir(board.name);
    const walkTest = runICMWalkTest(boardDir, board.icmWorkspace?.pipelines);
    if (board.icmWorkspace) {
      board.icmWorkspace.lastWalkTest = walkTest;
    }
    res.json({ walkTest });
  });

  // Vite dev middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist/client');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return { app, server, icm, bus };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().then(({ server, icm }) => {
    const handleShutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}, flushing pending ICM writes...`);
      await icm.flushPendingWrites();
      server.close(() => process.exit(0));
    };
    process.once('SIGINT', () => void handleShutdown('SIGINT'));
    process.once('SIGTERM', () => void handleShutdown('SIGTERM'));

    const startListen = (port: number) => {
      server
        .listen(port, () => {
          console.log(`\n🚀 Scrappy Whiteboard running at:`);
          console.log(`   👉 Web Canvas UI:   http://localhost:${port}`);
          console.log(`   👉 REST API v1:     http://localhost:${port}/api/v1/boards/launch-plan`);
          console.log(`   👉 ICM Files Dir:   ${BOARDS_DIR}/launch-plan/\n`);
        })
        .on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.warn(`[Server] Port ${port} is in use, trying port ${port + 1}...`);
            startListen(port + 1);
          } else {
            throw err;
          }
        });
    };
    startListen(PORT);
  });
}
