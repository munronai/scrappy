import { BoundingBox } from '../../core/types.js';
import { ResizeCorner } from '../types.js';

/**
 * Computes a new bounding box when resizing a node or section via corner handles.
 * Enforces minimum width and height constraints.
 */
export function computeResizedBounds(
  orig: BoundingBox,
  corner: ResizeCorner,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number
): BoundingBox {
  let x = orig.x;
  let y = orig.y;
  let width = orig.width;
  let height = orig.height;

  if (corner === 'se') {
    width = Math.max(minWidth, Math.round(orig.width + dx));
    height = Math.max(minHeight, Math.round(orig.height + dy));
  } else if (corner === 'sw') {
    const possibleWidth = Math.round(orig.width - dx);
    if (possibleWidth >= minWidth) {
      width = possibleWidth;
      x = Math.round(orig.x + dx);
    } else {
      width = minWidth;
      x = Math.round(orig.x + orig.width - minWidth);
    }
    height = Math.max(minHeight, Math.round(orig.height + dy));
  } else if (corner === 'ne') {
    width = Math.max(minWidth, Math.round(orig.width + dx));
    const possibleHeight = Math.round(orig.height - dy);
    if (possibleHeight >= minHeight) {
      height = possibleHeight;
      y = Math.round(orig.y + dy);
    } else {
      height = minHeight;
      y = Math.round(orig.y + orig.height - minHeight);
    }
  } else if (corner === 'nw') {
    const possibleWidth = Math.round(orig.width - dx);
    if (possibleWidth >= minWidth) {
      width = possibleWidth;
      x = Math.round(orig.x + dx);
    } else {
      width = minWidth;
      x = Math.round(orig.x + orig.width - minWidth);
    }
    const possibleHeight = Math.round(orig.height - dy);
    if (possibleHeight >= minHeight) {
      height = possibleHeight;
      y = Math.round(orig.y + dy);
    } else {
      height = minHeight;
      y = Math.round(orig.y + orig.height - minHeight);
    }
  }

  return { x, y, width, height };
}

/**
 * Generates a smooth SVG cubic Bezier curve connecting two node bounding centers.
 */
export function computeConnectorBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { pathD: string; midX: number; midY: number } {
  const dx = Math.max(60, Math.abs(x2 - x1) * 0.5);
  const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return { pathD, midX, midY };
}

/**
 * Checks whether two 2D bounding boxes overlap, accounting for an optional margin.
 */
export function doBoundsOverlap(
  b1: BoundingBox,
  b2: BoundingBox,
  margin = 30
): boolean {
  return !(
    b1.x + b1.width + margin <= b2.x ||
    b1.x >= b2.x + b2.width + margin ||
    b1.y + b1.height + margin <= b2.y ||
    b1.y >= b2.y + b2.height + margin
  );
}

/**
 * Finds the nearest available unoccupied position for a new section or card relative to the user's view.
 * 
 * If the center of the current view is empty, it places the element directly at the center of view.
 * If occupied by existing sections, it checks adjacent candidate positions (right, below, left, above)
 * and returns the valid non-overlapping bounding box with the minimum Euclidean distance to the user's view center.
 */
export function findNearestAvailablePosition(
  center: { x: number; y: number },
  width: number,
  height: number,
  existingSections: BoundingBox[],
  margin = 40
): BoundingBox {
  const primaryCandidate: BoundingBox = {
    x: Math.round(center.x - width / 2),
    y: Math.round(center.y - height / 2),
    width,
    height,
  };

  if (existingSections.length === 0) {
    return primaryCandidate;
  }

  // Check if primary center candidate has any collisions
  const hasCollision = existingSections.some((s) => doBoundsOverlap(primaryCandidate, s, margin));
  if (!hasCollision) {
    return primaryCandidate;
  }

  // Generate candidate positions adjacent to existing sections
  const candidates: BoundingBox[] = [];

  for (const s of existingSections) {
    // 1. To the right of the section
    candidates.push({
      x: s.x + s.width + margin,
      y: s.y,
      width,
      height,
    });
    // 2. Below the section
    candidates.push({
      x: s.x,
      y: s.y + s.height + margin,
      width,
      height,
    });
    // 3. To the left of the section
    candidates.push({
      x: s.x - width - margin,
      y: s.y,
      width,
      height,
    });
    // 4. Above the section
    candidates.push({
      x: s.x,
      y: s.y - height - margin,
      width,
      height,
    });
    // 5. Right-aligned with same vertical center as user view
    candidates.push({
      x: s.x + s.width + margin,
      y: Math.round(center.y - height / 2),
      width,
      height,
    });
  }

  // Filter candidates that do not collide with any existing section
  const validCandidates = candidates.filter(
    (cand) => !existingSections.some((s) => doBoundsOverlap(cand, s, margin))
  );

  if (validCandidates.length > 0) {
    // Find the candidate closest to the user's view center
    validCandidates.sort((a, b) => {
      const distA = Math.hypot(a.x + a.width / 2 - center.x, a.y + a.height / 2 - center.y);
      const distB = Math.hypot(b.x + b.width / 2 - center.x, b.y + b.height / 2 - center.y);
      return distA - distB;
    });
    return validCandidates[0];
  }

  // Fallback: place to the right of all existing sections
  const maxX = Math.max(...existingSections.map((s) => s.x + s.width)) + margin;
  return {
    x: maxX,
    y: Math.round(center.y - height / 2),
    width,
    height,
  };
}
