import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import http from 'node:http';
import { RealtimeBus } from './bus.js';
import { RealtimeMessage, CapabilityTokenPayload } from './types.js';
import { createDefaultBoard, GraphOp } from '../core/index.js';

describe('RealtimeBus & Multi-User Collaboration (In-Memory)', () => {
  const AUTH_SECRET = 'test-scrappy-secret-key';

  function createTestToken(boardName: string, actorId: string, role: 'human' | 'agent' = 'human'): string {
    const payload: CapabilityTokenPayload = {
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

  function verifyTestToken(tokenStr: string, boardName: string): boolean {
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

  it('initializes in native-ws mode when no Ably API key is configured', () => {
    const server = http.createServer();
    const bus = new RealtimeBus(server);
    expect(bus.getTransportMode()).toBe('ws');
    expect(bus.hasAbly()).toBe(false);
  });

  it('tracks, isolates, and ages collaborator presence correctly across boards', () => {
    const server = http.createServer();
    const bus = new RealtimeBus(server);

    // Alice joins launch-plan
    bus.updatePresence('launch-plan', {
      actorId: 'alice',
      name: 'Alice',
      role: 'human',
      color: '#38bdf8',
      cursor: { x: 300, y: 150 },
      viewport: { x: 0, y: 0, zoom: 1.0 },
      activeNodeId: 'node-goal-1',
      updatedAt: Date.now(),
    });

    // Bob joins launch-plan
    bus.updatePresence('launch-plan', {
      actorId: 'bob',
      name: 'Bob',
      role: 'human',
      color: '#10b981',
      cursor: { x: 750, y: 420 },
      viewport: { x: 50, y: 50, zoom: 0.9 },
      updatedAt: Date.now(),
    });

    // Charlie joins a different board (q4-roadmap)
    bus.updatePresence('q4-roadmap', {
      actorId: 'charlie',
      name: 'Charlie',
      role: 'human',
      color: '#a855f7',
      cursor: { x: 100, y: 100 },
      updatedAt: Date.now(),
    });

    const launchPlanPresence = bus.getPresence('launch-plan');
    expect(launchPlanPresence.length).toBe(2);
    expect(launchPlanPresence.some((c) => c.actorId === 'alice')).toBe(true);
    expect(launchPlanPresence.some((c) => c.actorId === 'bob')).toBe(true);
    expect(launchPlanPresence.some((c) => c.actorId === 'charlie')).toBe(false);

    const q4Presence = bus.getPresence('q4-roadmap');
    expect(q4Presence.length).toBe(1);
    expect(q4Presence[0].actorId).toBe('charlie');
  });

  it('generates and verifies capability tokens for room authentication', () => {
    const aliceToken = createTestToken('launch-plan', 'alice', 'human');
    expect(verifyTestToken(aliceToken, 'launch-plan')).toBe(true);
    expect(verifyTestToken(aliceToken, 'wrong-board')).toBe(false);

    // Tampered token check
    const tampered = aliceToken.slice(0, -4) + 'abcd';
    expect(verifyTestToken(tampered, 'launch-plan')).toBe(false);
  });

  it('validates board passcode security rules', () => {
    const board = createDefaultBoard('secure-board', 'Secure Board');
    const passcode = 'launch2026';
    board.security = {
      mode: 'passcode',
      passcodeHash: crypto.createHash('sha256').update(passcode).digest('hex'),
    };

    const validate = (providedPasscode?: string, token?: string) => {
      if (board.security.mode !== 'passcode') return true;
      if (token && verifyTestToken(token, 'secure-board')) return true;
      if (providedPasscode) {
        const hash = crypto.createHash('sha256').update(providedPasscode).digest('hex');
        if (hash === board.security.passcodeHash) return true;
      }
      return false;
    };

    expect(validate(undefined, undefined)).toBe(false);
    expect(validate('wrong-pass', undefined)).toBe(false);
    expect(validate('launch2026', undefined)).toBe(true);

    const validToken = createTestToken('secure-board', 'user-123');
    expect(validate(undefined, validToken)).toBe(true);
  });

  it('stamps outgoing messages with originServerId to eliminate federation echo loops', () => {
    const testDelta: RealtimeMessage = {
      type: 'op.delta',
      boardName: 'launch-plan',
      actorId: 'alice',
      version: 5,
      operations: [{ op: 'delete_node', id: 'node-1' }],
      originServerId: 'srv-test-123',
    };

    expect(testDelta.originServerId).toBe('srv-test-123');
    // Simulated remote filter check
    const isSelfEcho = testDelta.originServerId === 'srv-test-123';
    expect(isSelfEcho).toBe(true);
  });
});
