import { BoardDocument, CollaboratorPresence, GraphOp } from '../core/index.js';

export type TransportMode = 'ws' | 'ably' | 'federated';

export type CapabilityScope = 'read' | 'write' | 'agent' | 'admin';

export interface CapabilityTokenPayload {
  boardName: string;
  actorId: string;
  role: 'human' | 'agent';
  capabilities: CapabilityScope[];
  iat: number;
  exp: number;
}

export type RealtimeMessage =
  | {
      type: 'board.sync';
      boardName: string;
      board: BoardDocument;
      source: string;
      originServerId?: string;
    }
  | {
      type: 'op.delta';
      boardName: string;
      actorId: string;
      version: number;
      operations: GraphOp[];
      source?: string;
      originServerId?: string;
    }
  | {
      type: 'presence.update';
      boardName: string;
      presence: CollaboratorPresence;
      originServerId?: string;
    }
  | {
      type: 'presence.sync';
      boardName: string;
      collaborators: CollaboratorPresence[];
      originServerId?: string;
    }
  | {
      type: 'presence.leave';
      boardName: string;
      actorId: string;
      originServerId?: string;
    }
  | {
      type: 'agent.activity';
      boardName: string;
      actorId: string;
      statusText: string;
      timestamp: string;
      originServerId?: string;
    };
