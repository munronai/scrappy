import type { NextFunction, Request, Response, Router } from 'express';
import { BoardDocument, GraphOp, isValidBoardSlug } from '../core/index.js';
import type { ICMAdapter } from '../icm/adapter.js';
import type { RealtimeBus } from '../realtime/bus.js';

/**
 * Shared server dependency context injected into all `/api/v1` Express routers.
 */
export interface ServerContext {
  icm: ICMAdapter;
  bus: RealtimeBus;
  boardsCache: Map<string, BoardDocument>;
  getBoard: (name: string) => BoardDocument;
  persistAndBroadcast: (board: BoardDocument, source?: string, deltaOps?: GraphOp[]) => void;
  verifyToken: (tokenStr: string, boardName: string) => boolean;
  createSignedToken: (boardName: string, actorId: string, role?: string) => string;
  hashPasscode: (passcode: string) => string;
}

/**
 * Express param middleware blocking invalid board slugs and directory traversal attempts.
 */
export function validateBoardNameParam(
  _req: Request,
  res: Response,
  next: NextFunction,
  name: string
): void {
  if (!isValidBoardSlug(name)) {
    res.status(400).json({
      error:
        'Invalid board name: must be 1-64 alphanumeric, dash, or underscore characters without path traversal.',
    });
    return;
  }
  next();
}

/**
 * Registers `:name` slug validation on a domain router so each router is self-contained.
 */
export function attachBoardParamValidation(router: Router): Router {
  router.param('name', validateBoardNameParam);
  return router;
}
