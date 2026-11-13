import { describe, expect, it } from 'vitest';
import {
  GraphOpSchema,
  GraphOpsBatchSchema,
  OpsBatchRequestSchema,
  validateGraphOpsBatch,
} from './validation.js';

describe('GraphOp Zod Validation', () => {
  it('accepts valid create_node, update_node, create_edge, and create_section ops', () => {
    const ops = [
      {
        op: 'create_section',
        section: {
          title: '01. Discovery',
          bounds: { x: 0, y: 0, width: 600, height: 500 },
        },
      },
      {
        op: 'create_node',
        node: {
          type: 'sticky',
          position: { x: 100, y: 120 },
          content: { title: 'Note', body: 'Hello' },
        },
      },
      {
        op: 'update_node',
        id: 'node-1',
        patch: { position: { x: 200 } },
      },
      {
        op: 'create_edge',
        edge: { fromNodeId: 'node-1', toNodeId: 'node-2', style: 'animated' },
      },
    ];

    const parsed = GraphOpsBatchSchema.safeParse(ops);
    expect(parsed.success).toBe(true);
  });

  it('preserves omitted fields on partial update_node content patches', () => {
    const parsed = GraphOpSchema.safeParse({
      op: 'update_node',
      id: 'node-1',
      patch: {
        content: { title: 'Updated Title Only' },
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.op === 'update_node') {
      expect(parsed.data.patch.content?.title).toBe('Updated Title Only');
      expect(parsed.data.patch.content?.body).toBeUndefined();
    }
  });

  it('accepts tableData.customCss on table nodes', () => {
    const parsed = GraphOpSchema.safeParse({
      op: 'create_node',
      node: {
        type: 'table',
        content: {
          title: 'Milestones',
          body: '| A |\n| --- |\n| 1 |',
          tableData: {
            columns: ['A'],
            rows: [['1']],
            stylePreset: 'sky',
            customCss: 'table { border-radius: 8px; }',
          },
        },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects malformed or non-finite coordinates and unknown ops', () => {
    expect(
      GraphOpSchema.safeParse({
        op: 'create_node',
        node: {
          position: { x: Number.NaN, y: 10 },
          content: { title: 'Bad' },
        },
      }).success
    ).toBe(false);

    expect(
      GraphOpSchema.safeParse({
        op: 'delete_node',
        id: '',
      }).success
    ).toBe(false);

    expect(
      GraphOpSchema.safeParse({
        op: 'unknown_op',
      }).success
    ).toBe(false);
  });

  it('validates OpsBatchRequestSchema defaults and rejects invalid autoLayout', () => {
    const valid = OpsBatchRequestSchema.safeParse({});
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.operations).toEqual([]);
      expect(valid.data.actorId).toBe('human');
      expect(valid.data.autoLayout).toBe('none');
    }

    const invalidLayout = OpsBatchRequestSchema.safeParse({
      operations: [],
      autoLayout: 'invalid-layout',
    });
    expect(invalidLayout.success).toBe(false);
  });

  it('returns structured error details from validateGraphOpsBatch', () => {
    const ok = validateGraphOpsBatch([{ op: 'delete_edge', id: 'edge-1' }]);
    expect(ok.success).toBe(true);

    const bad = validateGraphOpsBatch([{ op: 'delete_edge', id: '' }]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error).toContain('Invalid graph operation');
      expect(bad.issues.length).toBeGreaterThan(0);
    }
  });
});
