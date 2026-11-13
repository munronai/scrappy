import React from 'react';
import { ResizeCorner } from '../../types.js';

interface CornerHandlesProps {
  onStartCornerResize: (corner: ResizeCorner, e: React.MouseEvent) => void;
  accentColor?: string;
  size?: number;
  showResizeHandles: boolean;
}

export function CornerHandles({
  onStartCornerResize,
  accentColor = '#38bdf8',
  size = 14,
  showResizeHandles,
}: CornerHandlesProps) {
  const corners: Array<{
    corner: ResizeCorner;
    style: React.CSSProperties;
    cursor: string;
  }> = [
    {
      corner: 'nw',
      style: { top: -size / 2, left: -size / 2 },
      cursor: 'nwse-resize',
    },
    {
      corner: 'ne',
      style: { top: -size / 2, right: -size / 2 },
      cursor: 'nesw-resize',
    },
    {
      corner: 'sw',
      style: { bottom: -size / 2, left: -size / 2 },
      cursor: 'nesw-resize',
    },
    {
      corner: 'se',
      style: { bottom: -size / 2, right: -size / 2 },
      cursor: 'nwse-resize',
    },
  ];

  return (
    <>
      {corners.map(({ corner, style, cursor }) => (
        <div
          key={corner}
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartCornerResize(corner, e);
          }}
          title="Drag corner to resize"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: 3,
            background: showResizeHandles ? '#0f172a' : 'transparent',
            border: showResizeHandles ? `2px solid ${accentColor}` : 'none',
            cursor,
            zIndex: 25,
            ...style,
          }}
        />
      ))}
    </>
  );
}
