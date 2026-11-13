import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import type { CanvasNode } from '../../core/types.js';

/**
 * Artistic SVG graphic widget with DOMPurify sanitization and inline SVG source editor.
 */
export function SvgGraphicWidget({
  node,
  onSaveSvg,
}: {
  node: CanvasNode;
  onSaveSvg: (svgCode: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftSvg, setDraftSvg] = useState(node.content.svgCode || '');

  useEffect(() => {
    setDraftSvg(node.content.svgCode || '');
  }, [node.content.svgCode]);

  const cleanSvg = useMemo(() => {
    if (!draftSvg) return '';
    return DOMPurify.sanitize(draftSvg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['foreignObject'],
      ADD_ATTR: ['dominant-baseline'],
    });
  }, [draftSvg]);

  if (editing) {
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}
      >
        <textarea
          value={draftSvg}
          onChange={(e) => setDraftSvg(e.target.value)}
          style={{
            flex: 1,
            background: '#020617',
            color: '#c084fc',
            border: '1px solid #a855f7',
            borderRadius: 8,
            padding: 8,
            fontSize: 11,
            fontFamily: 'monospace',
            resize: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button
            onClick={() => setEditing(false)}
            style={{
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #475569',
              borderRadius: 6,
              padding: '3px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setEditing(false);
              onSaveSvg(draftSvg);
            }}
            style={{
              background: '#a855f7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✓ Render SVG
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: 'rgba(15, 23, 42, 0.8)',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: 6,
          padding: '2px 6px',
          fontSize: 10,
          cursor: 'pointer',
          zIndex: 5,
        }}
      >
        {'{ } SVG'}
      </button>
      <div
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        dangerouslySetInnerHTML={{ __html: cleanSvg }}
      />
    </div>
  );
}
