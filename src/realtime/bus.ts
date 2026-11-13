import { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  BoardDocument,
  CollaboratorPresence,
  GraphOp,
  isValidBoardSlug,
  validateGraphOpsBatch,
} from '../core/index.js';
import { RealtimeMessage, TransportMode } from './types.js';
import { AblyFederationBridge } from './ablyBridge.js';

export * from './types.js';
export * from './ablyBridge.js';

export interface RealtimeBusOptions {
  server: HttpServer;
  ablyApiKey?: string;
  onRemoteDelta?: (boardName: string, operations: GraphOp[], actorId: string, version: number) => void;
  validateConnection?: (boardName: string, reqUrl: URL) => { allowed: boolean; error?: string };
}

export class RealtimeBus {
  private wss: WebSocketServer;
  private originServerId: string;
  private ablyBridge?: AblyFederationBridge;
  private clientsByBoard = new Map<string, Set<WebSocket>>();
  private socketMeta = new Map<WebSocket, { boardName: string; actorId?: string }>();
  private presenceByBoard = new Map<string, Map<string, CollaboratorPresence>>();
  private onRemoteDeltaHandler?: (
    boardName: string,
    operations: GraphOp[],
    actorId: string,
    version: number
  ) => void;
  private validateConnectionHandler?: (boardName: string, reqUrl: URL) => { allowed: boolean; error?: string };

  constructor(options: RealtimeBusOptions | HttpServer) {
    const opts: RealtimeBusOptions =
      'server' in options ? options : { server: options };

    this.originServerId = `srv-${Math.random().toString(36).slice(2, 9)}`;
    this.wss = new WebSocketServer({ server: opts.server, path: '/ws' });
    this.wss.on('error', (err) => {
      // Prevent unhandled error if port is in use
    });
    this.onRemoteDeltaHandler = opts.onRemoteDelta;
    this.validateConnectionHandler = opts.validateConnection;

    const apiKey = opts.ablyApiKey || process.env.ABLY_API_KEY;
    if (apiKey) {
      try {
        this.ablyBridge = new AblyFederationBridge({
          apiKey,
          originServerId: this.originServerId,
        });
        console.log(`[RealtimeBus] Ably Federation Bridge initialized with originId ${this.originServerId}`);
      } catch (err) {
        console.warn('[RealtimeBus] Failed to initialize Ably Federation Bridge, falling back to Native WS:', err);
      }
    } else {
      console.log('[RealtimeBus] Native WebSocket transport active. (Set ABLY_API_KEY to enable Ably Cloud pub/sub & federation).');
    }

    this.setupWebSocketServer();
  }

  public getTransportMode(): TransportMode {
    if (this.ablyBridge && this.ablyBridge.getConnected()) {
      return 'federated';
    }
    return 'ws';
  }

  public getAblyBridge(): AblyFederationBridge | undefined {
    return this.ablyBridge;
  }

  public hasAbly(): boolean {
    return !!(this.ablyBridge && this.ablyBridge.getConnected());
  }

  public setOnRemoteDelta(
    handler: (boardName: string, operations: GraphOp[], actorId: string, version: number) => void
  ): void {
    this.onRemoteDeltaHandler = handler;
  }

  public setValidateConnection(
    handler: (boardName: string, reqUrl: URL) => { allowed: boolean; error?: string }
  ): void {
    this.validateConnectionHandler = handler;
  }

  public ensureBoardAttached(boardName: string): void {
    if (this.ablyBridge) {
      this.ablyBridge.attachBoard(boardName, (msg) => {
        this.handleInboundAblyMessage(boardName, msg);
      });
    }
  }

  private handleInboundAblyMessage(boardName: string, msg: RealtimeMessage): void {
    if (msg.type === 'op.delta') {
      const validation = validateGraphOpsBatch(msg.operations);
      if (!validation.success) {
        console.warn(`[RealtimeBus] Dropped invalid remote op.delta for "${boardName}":`, validation.error);
        return;
      }
      this.broadcastToLocal(boardName, msg);
      if (this.onRemoteDeltaHandler) {
        this.onRemoteDeltaHandler(boardName, validation.operations, msg.actorId, msg.version);
      }
      return;
    }

    // Forward non-delta message from Ably to all local WebSocket clients
    this.broadcastToLocal(boardName, msg);

    if (msg.type === 'presence.update' && msg.presence) {
      this.updateLocalPresence(boardName, msg.presence);
    }
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '/ws', 'http://localhost');
      const boardName = url.searchParams.get('board') || 'launch-plan';

      if (!isValidBoardSlug(boardName)) {
        ws.close(1008, 'Invalid board name');
        return;
      }

      // Security / passcode validation if configured
      if (this.validateConnectionHandler) {
        const check = this.validateConnectionHandler(boardName, url);
        if (!check.allowed) {
          ws.close(1008, check.error || 'Authentication required');
          return;
        }
      }

      this.ensureBoardAttached(boardName);

      if (!this.clientsByBoard.has(boardName)) {
        this.clientsByBoard.set(boardName, new Set());
      }
      this.clientsByBoard.get(boardName)!.add(ws);
      this.socketMeta.set(ws, { boardName });

      // Send initial presence list to new joiner
      ws.send(
        JSON.stringify({
          type: 'presence.sync',
          boardName,
          collaborators: this.getPresence(boardName),
        } satisfies RealtimeMessage)
      );

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'presence.update' && msg.presence) {
            this.socketMeta.set(ws, { boardName, actorId: msg.presence.actorId });
            this.updatePresence(boardName, {
              ...msg.presence,
              updatedAt: Date.now(),
            });
          } else if (msg.type === 'join' && msg.actorId) {
            this.socketMeta.set(ws, { boardName, actorId: msg.actorId });
          }
        } catch {
          // Ignore malformed WS message
        }
      });

      ws.on('close', () => {
        const meta = this.socketMeta.get(ws);
        this.clientsByBoard.get(boardName)?.delete(ws);
        this.socketMeta.delete(ws);

        if (meta?.actorId) {
          const boardPresence = this.presenceByBoard.get(boardName);
          if (boardPresence) {
            boardPresence.delete(meta.actorId);
            this.broadcast(boardName, {
              type: 'presence.leave',
              boardName,
              actorId: meta.actorId,
            });
            this.broadcast(boardName, {
              type: 'presence.sync',
              boardName,
              collaborators: this.getPresence(boardName),
            });
          }
        }
      });
    });
  }

  /**
   * Broadcasts a lightweight delta operation batch to all room subscribers
   * (local WebSockets and Ably Cloud federation).
   */
  public broadcastDelta(
    boardName: string,
    operations: GraphOp[],
    version: number,
    actorId = 'api',
    source = 'delta',
    excludeWs?: WebSocket
  ): void {
    this.broadcast(
      boardName,
      {
        type: 'op.delta',
        boardName,
        actorId,
        version,
        operations,
        source,
        originServerId: this.originServerId,
      },
      excludeWs
    );
  }

  /**
   * Full board state broadcast (used on initial connect, template reset, or disk reload).
   */
  public broadcastBoardSync(
    boardName: string,
    board: BoardDocument,
    source = 'api',
    excludeWs?: WebSocket
  ): void {
    this.broadcast(
      boardName,
      {
        type: 'board.sync',
        boardName,
        board,
        source,
        originServerId: this.originServerId,
      },
      excludeWs
    );
  }

  public updatePresence(boardName: string, presence: CollaboratorPresence): void {
    this.updateLocalPresence(boardName, presence);

    // Relay to local WS clients
    this.broadcastToLocal(boardName, {
      type: 'presence.sync',
      boardName,
      collaborators: this.getPresence(boardName),
    });

    // Relay to Ably Cloud
    if (this.ablyBridge) {
      this.ablyBridge.publish(boardName, {
        type: 'presence.update',
        boardName,
        presence,
        originServerId: this.originServerId,
      });
    }
  }

  private updateLocalPresence(boardName: string, presence: CollaboratorPresence): void {
    if (!this.presenceByBoard.has(boardName)) {
      this.presenceByBoard.set(boardName, new Map());
    }
    const boardPresence = this.presenceByBoard.get(boardName)!;
    boardPresence.set(presence.actorId, {
      ...presence,
      updatedAt: Date.now(),
    });
  }

  public broadcastAgentActivity(boardName: string, actorId: string, statusText: string): void {
    this.broadcast(boardName, {
      type: 'agent.activity',
      boardName,
      actorId,
      statusText,
      timestamp: new Date().toISOString(),
      originServerId: this.originServerId,
    });
  }

  public getPresence(boardName: string): CollaboratorPresence[] {
    const map = this.presenceByBoard.get(boardName);
    if (!map) return [];
    const now = Date.now();
    const active: CollaboratorPresence[] = [];
    for (const [id, p] of map.entries()) {
      // 45s stale presence timeout
      if (now - p.updatedAt > 45_000) {
        map.delete(id);
      } else {
        active.push(p);
      }
    }
    return active;
  }

  /**
   * Universal broadcast: sends message to local WebSocket clients AND publishes to Ably Cloud.
   */
  private broadcast(boardName: string, message: RealtimeMessage, excludeWs?: WebSocket): void {
    this.broadcastToLocal(boardName, message, excludeWs);

    if (this.ablyBridge) {
      this.ablyBridge.publish(boardName, message);
    }
  }

  /**
   * Local WebSocket broadcast only.
   */
  private broadcastToLocal(boardName: string, message: RealtimeMessage, excludeWs?: WebSocket): void {
    const clients = this.clientsByBoard.get(boardName);
    if (!clients) return;
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
