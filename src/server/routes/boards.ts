import { Router } from 'express';
import { BoardDocument, isValidBoardSlug } from '../../core/index.js';
import { attachBoardParamValidation, ServerContext } from '../context.js';

/**
 * Router handling board lifecycle CRUD, duplication, disk reload, room security,
 * and capability token exchange.
 */
export function createBoardsRouter(ctx: ServerContext): Router {
  const router = attachBoardParamValidation(Router());
  const { icm, bus, boardsCache, getBoard, persistAndBroadcast, createSignedToken, hashPasscode } = ctx;

  // List boards
  router.get('/boards', (_req, res) => {
    res.json({ boards: icm.listBoards() });
  });

  // Create or clone board
  router.post('/boards', (req, res) => {
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
  router.post('/boards/:name/duplicate', (req, res) => {
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
  router.post('/boards/:name/reload', (req, res) => {
    const name = req.params.name;
    const board = icm.loadBoardFromDisk(name);
    boardsCache.set(name, board);
    bus.broadcastBoardSync(name, board, 'reload-disk');
    res.json({ board });
  });

  // Delete a non-default board
  router.delete('/boards/:name', (req, res) => {
    const name = req.params.name;
    if (name === 'launch-plan') {
      return res.status(400).json({ error: 'Cannot delete default launch-plan board' });
    }
    boardsCache.delete(name);
    const deleted = icm.deleteBoard(name);
    res.json({ success: deleted });
  });

  // Get full board state
  router.get('/boards/:name', (req, res) => {
    const board = getBoard(req.params.name);
    res.json({
      board,
      collaborators: bus.getPresence(board.name),
    });
  });

  // Unified Auth & Token Exchange (Native WS & Ably TokenRequest)
  router.post(['/auth/token', '/boards/:name/auth'], async (req, res) => {
    const boardName = (req.params.name || req.body?.boardName || 'launch-plan').toLowerCase();
    if (!isValidBoardSlug(boardName)) {
      return res.status(400).json({ error: 'Invalid board name.' });
    }

    const board = getBoard(boardName);
    const { passcode, actorId = `user-${Math.random().toString(36).slice(2, 7)}`, role = 'human' } =
      req.body || {};

    if (board.security.mode === 'passcode') {
      const expectedHash = board.security.passcodeHash;
      if (expectedHash) {
        const providedHash = passcode ? hashPasscode(String(passcode)) : '';
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
  router.post('/boards/:name/security', (req, res) => {
    const board = getBoard(req.params.name);
    const { mode, passcode, allowedGroups } = req.body || {};

    if (mode === 'passcode') {
      if (passcode) {
        board.security = {
          mode: 'passcode',
          passcodeHash: hashPasscode(String(passcode)),
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
  router.get('/realtime/info', (_req, res) => {
    res.json({
      transport: bus.getTransportMode(),
      hasAbly: bus.hasAbly(),
      collaboratorCount: bus.getPresence('launch-plan').length,
    });
  });

  return router;
}
