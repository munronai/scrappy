import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyOperations, createEmptyBoard } from '../core/index.js';
import { ICMAdapter } from './adapter.js';
import { WriteQueue } from './writeQueue.js';

describe('WriteQueue & ICMAdapter Async Write-Behind', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces high-frequency writes for the same key after the 300ms idle threshold', async () => {
    vi.useFakeTimers();
    const queue = new WriteQueue({ debounceMs: 300 });
    const written: number[] = [];

    for (let i = 1; i <= 10; i++) {
      queue.enqueue('board-1', async () => {
        written.push(i);
      });
      await vi.advanceTimersByTimeAsync(50);
    }

    // Still within the 300ms idle window after the 10th enqueue
    expect(written).toEqual([]);
    expect(queue.hasPending('board-1')).toBe(true);

    // Advance past the 300ms idle threshold
    await vi.advanceTimersByTimeAsync(300);

    expect(written).toEqual([10]);
    expect(queue.hasPending('board-1')).toBe(false);
    expect(queue.getStats()).toMatchObject({
      enqueued: 10,
      executed: 1,
      coalesced: 9,
    });
  });

  it('isolates coalescing per key and flushes multiple keys cleanly', async () => {
    vi.useFakeTimers();
    const queue = new WriteQueue({ debounceMs: 300 });
    const writes: Record<string, string> = {};

    queue.enqueue('board-a', async () => {
      writes['board-a'] = 'v1';
    });
    queue.enqueue('board-a', async () => {
      writes['board-a'] = 'v2';
    });
    queue.enqueue('board-b', async () => {
      writes['board-b'] = 'b1';
    });

    await queue.flush();

    expect(writes).toEqual({
      'board-a': 'v2',
      'board-b': 'b1',
    });
    expect(queue.hasPending()).toBe(false);
  });

  it('serializes writes when a new enqueue arrives while an earlier write is in flight', async () => {
    const queue = new WriteQueue({ debounceMs: 10 });
    const order: string[] = [];

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    queue.enqueue('board-1', async () => {
      order.push('start-1');
      await firstGate;
      order.push('end-1');
    });

    // Wait for first write to start
    await new Promise((r) => setTimeout(r, 25));
    expect(order).toEqual(['start-1']);

    // Enqueue second write while first is still in flight
    queue.enqueue('board-1', async () => {
      order.push('run-2');
    });

    const flushPromise = queue.flush('board-1');
    releaseFirst();
    await flushPromise;

    expect(order).toEqual(['start-1', 'end-1', 'run-2']);
  });

  it('cancels pending debounced writes without executing them', async () => {
    vi.useFakeTimers();
    const queue = new WriteQueue({ debounceMs: 300 });
    const task = vi.fn(async () => {});

    queue.enqueue('deleted-board', task);
    expect(queue.hasPending('deleted-board')).toBe(true);

    queue.cancel('deleted-board');
    await vi.advanceTimersByTimeAsync(500);

    expect(task).not.toHaveBeenCalled();
    expect(queue.hasPending('deleted-board')).toBe(false);
  });

  it('persists coalesced drag bursts asynchronously via ICMAdapter.scheduleSaveBoard', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-wq-'));
    try {
      const icm = new ICMAdapter(tmpDir, { writeDebounceMs: 40 });
      const board = createEmptyBoard('drag-test', 'Drag Test');
      applyOperations(
        board,
        [
          {
            op: 'create_node',
            node: {
              id: 'node-drag',
              type: 'sticky',
              position: { x: 10, y: 10 },
              content: { title: 'Draggable', body: 'Drag me' },
            },
          },
        ],
        'alice'
      );

      // Simulate 5 rapid drag updates
      for (let step = 1; step <= 5; step++) {
        applyOperations(
          board,
          [
            {
              op: 'update_node',
              id: 'node-drag',
              patch: { position: { x: 10 + step * 40, y: 10 + step * 20 } },
            },
          ],
          'alice'
        );
        icm.scheduleSaveBoard(board);
      }

      await icm.flushPendingWrites('drag-test');

      const stats = icm.getWriteQueueStats();
      expect(stats.enqueued).toBe(5);
      expect(stats.executed).toBe(1);
      expect(stats.coalesced).toBe(4);

      const reloaded = icm.loadBoardFromDisk('drag-test');
      expect(reloaded.nodes['node-drag']?.position).toEqual({ x: 210, y: 110 });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
