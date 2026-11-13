import React from 'react';
import { ActiveTool, ViewportState } from '../../types.js';

interface CanvasViewportProps {
  containerRef: React.Ref<HTMLDivElement>;
  canvasBgRef: React.Ref<HTMLCanvasElement>;
  viewport: ViewportState;
  activeTool: ActiveTool;
  isPanning: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onWheel: (e: React.WheelEvent) => void;
  children: React.ReactNode;
}

/**
 * Main infinite canvas viewport container.
 * Houses the HTML5 dot grid background canvas and the transformed SVG/HTML world container.
 */
export function CanvasViewport({
  containerRef,
  canvasBgRef,
  viewport,
  activeTool,
  isPanning,
  onContextMenu,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  children,
}: CanvasViewportProps) {
  const safeX = Number.isFinite(viewport.x) ? viewport.x : 0;
  const safeY = Number.isFinite(viewport.y) ? viewport.y : 0;
  const safeZoom = Number.isFinite(viewport.zoom) && viewport.zoom > 0.1 ? viewport.zoom : 0.82;

  return (
    <div
      ref={containerRef}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      style={{
        flex: 1,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        userSelect: isPanning ? 'none' : 'auto',
        cursor:
          activeTool === 'region'
            ? 'crosshair'
            : isPanning
            ? 'grabbing'
            : 'grab',
      }}
    >
      {/* Layer 1: HTML5 Canvas Grid Background */}
      <canvas
        ref={canvasBgRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Transformed World Container */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${safeX}px, ${safeY}px) scale(${safeZoom})`,
          width: 4000,
          height: 3000,
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
