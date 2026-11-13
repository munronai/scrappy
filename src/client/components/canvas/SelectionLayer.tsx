import React from 'react';
import { BoundingBox, PromptRequest } from '../../../core/index.js';
import { RegionDragState } from '../../types.js';

interface SelectionLayerProps {
  pendingPrompts: PromptRequest[];
  activeBoundingBox?: BoundingBox;
  regionDrag: RegionDragState | null;
  onOpenDrawerToPrompts: () => void;
}

/**
 * Renders selection overlays on the canvas:
 * 1. Pending `@scrappy` prompt pins awaiting CLI execution (`/update-scrappy`)
 * 2. Active Focus Region bounding box (persisted while scoped)
 * 3. Transient marquee selection rectangle during mouse drag
 */
export function SelectionLayer({
  pendingPrompts,
  activeBoundingBox,
  regionDrag,
  onOpenDrawerToPrompts,
}: SelectionLayerProps) {
  return (
    <>
      {/* Pending @scrappy Prompt Pins on Canvas */}
      {pendingPrompts.map((p) => {
        if (!p.anchorPosition) return null;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.anchorPosition.x,
              top: p.anchorPosition.y,
              transform: 'translate(-12px, -12px)',
              background: 'rgba(168, 85, 247, 0.95)',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              boxShadow:
                '0 0 0 4px rgba(168, 85, 247, 0.35), 0 8px 20px rgba(0,0,0,0.45)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              zIndex: 45,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawerToPrompts();
            }}
            title="Pending @scrappy prompt — run /update-scrappy in agy or click to inspect"
          >
            📍 {p.prompt.slice(0, 36)}... (awaiting `/update-scrappy`)
          </div>
        );
      })}

      {/* Active Focus Region Highlight Box */}
      {activeBoundingBox && (
        <div
          style={{
            position: 'absolute',
            left: activeBoundingBox.x,
            top: activeBoundingBox.y,
            width: activeBoundingBox.width,
            height: activeBoundingBox.height,
            border: '2px dashed #38bdf8',
            background: 'rgba(56, 189, 248, 0.05)',
            borderRadius: 12,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: -22,
              left: 8,
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px solid #38bdf8',
              borderRadius: 6,
              padding: '2px 7px',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            🎯 Active Focus Region (`/update-scrappy` scoped here)
          </span>
        </div>
      )}

      {/* Region Selection Box while dragging */}
      {regionDrag && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(regionDrag.startX, regionDrag.currX),
            top: Math.min(regionDrag.startY, regionDrag.currY),
            width: Math.abs(regionDrag.currX - regionDrag.startX),
            height: Math.abs(regionDrag.currY - regionDrag.startY),
            border: '2px solid #38bdf8',
            background: 'rgba(56, 189, 248, 0.14)',
            borderRadius: 8,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}
