import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createSignedToken,
  hashPasscode,
  isOriginAllowed,
  verifyToken,
} from '../auth.js';
import { createServer } from '../index.js';
import type { ICMAdapter } from '../../icm/adapter.js';

interface TestResponse<T = any> {
  status: number;
  body: T;
}

/**
 * Invokes the Express application completely in memory without binding a TCP port.
 */
async function requestJson<T = any>(
  app: Express,
  method: string,
  url: string,
  payload?: unknown
): Promise<TestResponse<T>> {
  const socket = new PassThrough();
  const req = new http.IncomingMessage(socket as any);
  req.method = method.toUpperCase();
  req.url = `/api/v1${url}`;
  req.headers = { host: 'localhost:3000' };

  const bodyText = payload !== undefined ? JSON.stringify(payload) : undefined;
  if (bodyText !== undefined) {
    req.headers['content-type'] = 'application/json';
    req.headers['content-length'] = String(Buffer.byteLength(bodyText));
  }

  const res = new http.ServerResponse(req);
  const rawChunks: Buffer[] = [];
  const resSocket = new PassThrough();
  resSocket.on('data', (chunk: Buffer) => rawChunks.push(chunk));
  res.assignSocket(resSocket as any);

  const responsePromise = new Promise<TestResponse<T>>((resolve, reject) => {
    res.on('finish', () => {
      const full = Buffer.concat(rawChunks).toString('utf-8');
      const headerSepIdx = full.indexOf('\r\n\r\n');
      const jsonStr = headerSepIdx >= 0 ? full.slice(headerSepIdx + 4) : full;
      try {
        resolve({
          status: res.statusCode,
          body: (jsonStr ? JSON.parse(jsonStr) : {}) as T,
        });
      } catch (err) {
        reject(err);
      }
    });
    res.on('error', reject);
  });

  app(req, res);

  if (bodyText !== undefined) {
    req.push(bodyText);
  }
  req.push(null);

  return responsePromise;
}

describe('Modular Express API v1 Routers & Auth', () => {
  let tmpDir: string;
  let server: http.Server;
  let app: Express;
  let icm: ICMAdapter;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-routes-'));
    const created = await createServer({
      boardsDir: tmpDir,
      skipClientMiddleware: true,
    });
    app = created.app;
    server = created.server;
    icm = created.icm;
  });

  afterAll(async () => {
    icm.deleteBoard('launch-plan');
    icm.deleteBoard('alpha-board');
    icm.deleteBoard('alpha-board-copy');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Auth & CORS helpers', () => {
    it('creates and verifies board-scoped HMAC tokens', () => {
      const token = createSignedToken('alpha-board', 'alice', 'human', 'unit-secret');
      expect(verifyToken(token, 'alpha-board', 'unit-secret')).toBe(true);
      expect(verifyToken(token, 'other-board', 'unit-secret')).toBe(false);
      expect(verifyToken(token, 'alpha-board', 'wrong-secret')).toBe(false);
    });

    it('validates CORS origins against localhost and explicit allowlist', () => {
      expect(isOriginAllowed(undefined, [])).toBe(true);
      expect(isOriginAllowed('http://localhost:5173', [])).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:3000', [])).toBe(true);
      expect(isOriginAllowed('https://evil.example', [])).toBe(false);
      expect(isOriginAllowed('https://trusted.example', ['https://trusted.example'])).toBe(true);
    });
  });

  describe('boards.ts router', () => {
    it('supports list, create, duplicate, reload, security/auth, and delete', async () => {
      // List default board
      const listRes = await requestJson<{ boards: Array<{ name: string }> }>(
        app,
        'GET',
        '/boards'
      );
      expect(listRes.status).toBe(200);
      expect(listRes.body.boards.some((b) => b.name === 'launch-plan')).toBe(true);

      // Create clean board
      const createRes = await requestJson(app, 'POST', '/boards', {
        name: 'alpha-board',
        title: 'Alpha Board',
        template: 'clean',
      });
      expect(createRes.status).toBe(201);

      // Duplicate board
      const dupRes = await requestJson(app, 'POST', '/boards/alpha-board/duplicate', {
        targetName: 'alpha-board-copy',
        title: 'Alpha Copy',
      });
      expect(dupRes.status).toBe(201);

      // Configure passcode security & authenticate
      const secRes = await requestJson(app, 'POST', '/boards/alpha-board/security', {
        mode: 'passcode',
        passcode: 's3cret',
      });
      expect(secRes.status).toBe(200);

      const badAuthRes = await requestJson(app, 'POST', '/boards/alpha-board/auth', {
        passcode: 'wrong',
        actorId: 'alice',
      });
      expect(badAuthRes.status).toBe(401);

      const okAuthRes = await requestJson<{ token: string }>(
        app,
        'POST',
        '/boards/alpha-board/auth',
        { passcode: 's3cret', actorId: 'alice' }
      );
      expect(okAuthRes.status).toBe(200);
      expect(typeof okAuthRes.body.token).toBe('string');

      // Reload & delete copy
      const reloadRes = await requestJson(app, 'POST', '/boards/alpha-board/reload');
      expect(reloadRes.status).toBe(200);

      const delRes = await requestJson<{ success: boolean }>(
        app,
        'DELETE',
        '/boards/alpha-board-copy'
      );
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it('rejects path traversal and invalid board slugs across routers', async () => {
      const res = await requestJson(app, 'POST', '/boards/bad$slug/ops', {
        operations: [],
      });
      expect(res.status).toBe(400);
    });
  });

  describe('ops.ts, prompts.ts, ingest.ts, and icm.ts routers', () => {
    it('validates and applies ops, slices context, exports docs, and broadcasts presence', async () => {
      // Invalid op rejected by Zod
      const badOpsRes = await requestJson(app, 'POST', '/boards/launch-plan/ops', {
        operations: [{ op: 'delete_node', id: '' }],
      });
      expect(badOpsRes.status).toBe(400);

      // Valid op
      const goodOpsRes = await requestJson(app, 'POST', '/boards/launch-plan/ops', {
        actorId: 'test-runner',
        operations: [
          {
            op: 'create_node',
            node: {
              id: 'node-router-test',
              type: 'sticky',
              position: { x: 120, y: 140 },
              content: { title: 'Router Card', body: 'Created via modular ops router' },
            },
          },
        ],
      });
      expect(goodOpsRes.status).toBe(200);

      const ctxRes = await requestJson(app, 'GET', '/boards/launch-plan/context');
      expect(ctxRes.status).toBe(200);

      const exportRes = await requestJson<{ format: string; content: string }>(
        app,
        'GET',
        '/boards/launch-plan/export?format=mermaid'
      );
      expect(exportRes.status).toBe(200);
      expect(exportRes.body.format).toBe('mermaid');

      const presRes = await requestJson(app, 'POST', '/boards/launch-plan/presence', {
        actorId: 'bot-1',
        statusText: 'Online',
      });
      expect(presRes.status).toBe(200);
    });

    it('submits and resolves prompts via prompts.ts', async () => {
      const submitRes = await requestJson<{ prompt: { id: string; status: string } }>(
        app,
        'POST',
        '/boards/launch-plan/prompts',
        { prompt: 'Summarize sprint tasks', mode: 'icm' }
      );
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.prompt.status).toBe('pending');

      const resolveRes = await requestJson<{ prompt: { status: string } }>(
        app,
        'POST',
        `/boards/launch-plan/prompts/${submitRes.body.prompt.id}/resolve`,
        { summary: 'Done' }
      );
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.prompt.status).toBe('completed');
    });

    it('ingests idempotent external events via ingest.ts', async () => {
      const first = await requestJson<{ board: { nodes: Record<string, any> } }>(
        app,
        'POST',
        '/boards/launch-plan/ingest',
        {
          source: 'github',
          externalId: 'pr-99',
          title: 'Initial PR',
          body: 'Opened',
        }
      );
      expect(first.status).toBe(201);
      const matches1 = Object.values(first.body.board.nodes).filter(
        (n: any) => n.content.sourceMeta?.externalId === 'pr-99'
      );
      expect(matches1).toHaveLength(1);

      const second = await requestJson<{ board: { nodes: Record<string, any> } }>(
        app,
        'POST',
        '/boards/launch-plan/ingest',
        {
          source: 'github',
          externalId: 'pr-99',
          title: 'Merged PR',
          body: 'Merged',
        }
      );
      expect(second.status).toBe(201);
      const matches2 = Object.values(second.body.board.nodes).filter(
        (n: any) => n.content.sourceMeta?.externalId === 'pr-99'
      );
      expect(matches2).toHaveLength(1);
      expect(matches2[0].content.title).toBe('Merged PR');
    });

    it('inspects ICM files, builds pipelines, and runs walk test via icm.ts', async () => {
      const filesRes = await requestJson(app, 'GET', '/boards/launch-plan/files');
      expect(filesRes.status).toBe(200);

      const listRes = await requestJson(app, 'GET', '/boards/launch-plan/icm/pipelines');
      expect(listRes.status).toBe(200);

      const buildRes = await requestJson(app, 'POST', '/boards/launch-plan/icm/build-pipeline', {
        title: 'Router Test Pipeline',
        triggerIntents: ['router', 'test'],
        reflectOnCanvas: false,
      });
      expect(buildRes.status).toBe(201);

      const walkRes = await requestJson<{ walkTest: { passed: boolean } }>(
        app,
        'POST',
        '/boards/launch-plan/icm/walk-test'
      );
      expect(walkRes.status).toBe(200);
      expect(typeof walkRes.body.walkTest.passed).toBe('boolean');
    });
  });

  it('hashes passcodes deterministically', () => {
    expect(hashPasscode('abc')).toBe(hashPasscode('abc'));
    expect(hashPasscode('abc')).not.toBe(hashPasscode('xyz'));
  });
});
