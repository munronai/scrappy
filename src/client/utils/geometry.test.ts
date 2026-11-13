import { describe, expect, it } from 'vitest';
import {
  computeConnectorBezier,
  computeResizedBounds,
  doBoundsOverlap,
  findNearestAvailablePosition,
} from './geometry.js';
import { BoundingBox } from '../../core/types.js';

describe('geometry utils', () => {
  describe('computeResizedBounds', () => {
    const orig: BoundingBox = { x: 100, y: 100, width: 200, height: 150 };

    it('resizes from south-east corner', () => {
      const result = computeResizedBounds(orig, 'se', 50, 40, 100, 100);
      expect(result).toEqual({ x: 100, y: 100, width: 250, height: 190 });
    });

    it('enforces minWidth and minHeight on south-east resize', () => {
      const result = computeResizedBounds(orig, 'se', -180, -100, 100, 80);
      expect(result).toEqual({ x: 100, y: 100, width: 100, height: 80 });
    });

    it('resizes from north-west corner and updates position', () => {
      const result = computeResizedBounds(orig, 'nw', 30, 20, 100, 80);
      expect(result).toEqual({ x: 130, y: 120, width: 170, height: 130 });
    });
  });

  describe('computeConnectorBezier', () => {
    it('computes smooth bezier curve path and midpoint', () => {
      const curve = computeConnectorBezier(100, 100, 300, 200);
      expect(curve.midX).toBe(200);
      expect(curve.midY).toBe(150);
      expect(curve.pathD).toContain('M 100 100 C');
      expect(curve.pathD).toContain('300 200');
    });
  });

  describe('doBoundsOverlap', () => {
    const b1: BoundingBox = { x: 100, y: 100, width: 200, height: 200 };

    it('detects overlapping bounding boxes', () => {
      const b2: BoundingBox = { x: 150, y: 150, width: 200, height: 200 };
      expect(doBoundsOverlap(b1, b2)).toBe(true);
    });

    it('detects non-overlapping bounding boxes with margin', () => {
      const b2: BoundingBox = { x: 350, y: 100, width: 200, height: 200 };
      expect(doBoundsOverlap(b1, b2, 20)).toBe(false);
    });

    it('detects collisions within margin distance', () => {
      // Distance between b1 right edge (300) and b2 left edge (320) is 20px
      const b2: BoundingBox = { x: 320, y: 100, width: 200, height: 200 };
      expect(doBoundsOverlap(b1, b2, 30)).toBe(true);
      expect(doBoundsOverlap(b1, b2, 10)).toBe(false);
    });
  });

  describe('findNearestAvailablePosition', () => {
    it('returns centered position when board has no sections', () => {
      const center = { x: 500, y: 400 };
      const pos = findNearestAvailablePosition(center, 600, 500, []);
      expect(pos).toEqual({
        x: 200, // 500 - 300
        y: 150, // 400 - 250
        width: 600,
        height: 500,
      });
    });

    it('places directly in view when visible area has no section collisions', () => {
      const existing: BoundingBox[] = [
        { x: 100, y: 100, width: 600, height: 500 },
      ];
      // User is looking far away at x=1500, y=1000
      const center = { x: 1500, y: 1000 };
      const pos = findNearestAvailablePosition(center, 600, 500, existing, 40);
      expect(pos).toEqual({
        x: 1200, // 1500 - 300
        y: 750,  // 1000 - 250
        width: 600,
        height: 500,
      });
    });

    it('places adjacent to existing section when view center overlaps it', () => {
      const existing: BoundingBox[] = [
        { x: 100, y: 100, width: 600, height: 500 },
      ];
      // User is looking right at the center of the existing section
      const center = { x: 400, y: 350 };
      const pos = findNearestAvailablePosition(center, 600, 500, existing, 40);

      // Primary candidate (x=100, y=100) overlaps existing.
      // Candidate to right: x = 100 + 600 + 40 = 740, y = 100.
      // Candidate to left: x = 100 - 600 - 40 = -540, y = 100.
      // Candidate below: x = 100, y = 100 + 500 + 40 = 640.
      // Candidate above: x = 100, y = 100 - 500 - 40 = -440.
      expect(doBoundsOverlap(pos, existing[0], 40)).toBe(false);
      expect(pos.width).toBe(600);
      expect(pos.height).toBe(500);

      // Verify that it selected a valid non-overlapping space near the user view
      const dist = Math.hypot(pos.x + 300 - center.x, pos.y + 250 - center.y);
      expect(dist).toBeLessThan(1000);
    });

    it('correctly avoids multiple clustered sections and picks nearest open space', () => {
      const existing: BoundingBox[] = [
        { x: 0, y: 100, width: 600, height: 500 },
        { x: 640, y: 100, width: 600, height: 500 },
      ];
      // User is viewing the gap/first section at x=300, y=350
      const center = { x: 300, y: 350 };
      const pos = findNearestAvailablePosition(center, 600, 500, existing, 40);

      // Must not collide with either section
      expect(doBoundsOverlap(pos, existing[0], 40)).toBe(false);
      expect(doBoundsOverlap(pos, existing[1], 40)).toBe(false);
    });
  });
});
