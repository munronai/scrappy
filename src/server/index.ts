import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import {
  applyOperations,
  BoardDocument,
  GraphOp,
} from '../core/index.js';
import { ICMAdapter } from '../icm/adapter.js';
import { RealtimeBus } from '../realtime/bus.js';
import {
  createSignedToken as issueSignedToken,
  getAuthSecret,
  hashPasscode,
  isOriginAllowed,
  verifyToken as verifySignedToken,
} from './auth.js';
import { ServerContext } from './context.js';
import { createBoardsRouter } from './routes/boards.js';
import { createOpsRouter } from './routes/ops.js';
import { createPromptsRouter } from './routes/prompts.js';
import { createIngestRouter } from './routes/ingest.js';
import { createIcmRouter } from './routes/icm.js';

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_BOARDS_DIR = path.resolve(process.cwd(), 'boards');

export interface CreateServerOptions {
  /** Override the root directory for ICM board storage (useful in automated tests). */
  boardsDir?: string;
  /** Skip mounting Vite dev middleware / static assets (useful for API-only tests). */
  skipClientMiddleware?: boolean;
}

/**
 * Bootstraps the Express application, RealtimeBus, ICM storage adapter, and modular `/api/v1` routers.
 */
export async function createServer(options: CreateServerOptions = {}) {
  const boardsDir = options.boardsDir || DEFAULT_BOARDS_DIR;
  const app = express();

  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, allowedOrigins)) {
          return callback(null, true);
        }
        callback(new Error(`CORS policy does not allow access from origin ${origin}`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '5mb' }));

  const server = http.createServer(app);
  const icm = new ICMAdapter(boardsDir);
  const boardsCache = new Map<string, BoardDocument>();
  const authSecret = getAuthSecret();

  const verifyToken = (tokenStr: string, boardName: string): boolean =>
    verifySignedToken(tokenStr, boardName, authSecret);

  const createSignedToken = (boardName: string, actorId: string, role = 'human'): string =>
    issueSignedToken(boardName, actorId, role, authSecret);

  const bus = new RealtimeBus({
    server,
    onRemoteDelta: (boardName, operations, actorId) => {
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
      if (passcode && hashPasscode(String(passcode)) === board.security.passcodeHash) {
        return { allowed: true };
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
    icm.saveBoardToDisk(board);
    if (deltaOps && deltaOps.length > 0) {
      bus.broadcastDelta(board.name, deltaOps, board.version, source, source);
    } else {
      bus.broadcastBoardSync(board.name, board, source);
    }
  }

  // Ensure default "launch-plan" board is initialized on startup
  getBoard('launch-plan');

  // --- Mount Modular REST API v1 Routers ---
  const ctx: ServerContext = {
    icm,
    bus,
    boardsCache,
    getBoard,
    persistAndBroadcast,
    verifyToken,
    createSignedToken,
    hashPasscode,
  };

  app.use('/api/v1', createBoardsRouter(ctx));
  app.use('/api/v1', createOpsRouter(ctx));
  app.use('/api/v1', createPromptsRouter(ctx));
  app.use('/api/v1', createIngestRouter(ctx));
  app.use('/api/v1', createIcmRouter(ctx));

  // Vite dev middleware or production static serving
  if (!options.skipClientMiddleware) {
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
  }

  return { app, server, icm, bus };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().then(({ server }) => {
    const startListen = (port: number) => {
      server
        .listen(port, () => {
          console.log(`\n🚀 Scrappy Whiteboard running at:`);
          console.log(`   👉 Web Canvas UI:   http://localhost:${port}`);
          console.log(`   👉 REST API v1:     http://localhost:${port}/api/v1/boards/launch-plan`);
          console.log(`   👉 ICM Files Dir:   ${DEFAULT_BOARDS_DIR}/launch-plan/\n`);
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
