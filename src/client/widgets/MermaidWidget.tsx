import React, { useEffect, useId, useMemo, useState } from 'react';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import type { CanvasNode } from '../../core/types.js';

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
});

/**
 * In-place Mermaid diagram widget with live rendering and inline code editor.
 */
export function MermaidWidget({
  node,
  onSaveMermaid,
}: {
  node: CanvasNode;
  onSaveMermaid: (mermaidCode: string) => void;
}) {
  const defaultCode =
    node.content.mermaidCode ||
    `flowchart LR\n  A["Start"] --> B["@scrappy"]\n  B --> C["Whiteboard"]`;
  const [isEditing, setIsEditing] = useState(false);
  const [draftCode, setDraftCode] = useState(defaultCode);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    setDraftCode(
      node.content.mermaidCode ||
        `flowchart LR\n  A["Start"] --> B["@scrappy"]\n  B --> C["Whiteboard"]`
    );
  }, [node.content.mermaidCode]);

  useEffect(() => {
    if (isEditing) return;
    let cancelled = false;
    async function renderDiagram() {
      try {
        setRenderError(null);
        const { svg } = await mermaid.render(`mermaid-${node.id}-${uniqueId}`, draftCode);
        if (!cancelled) {
          setSvgHtml(svg);
        }
      } catch (err: any) {
        if (!cancelled) {
          setRenderError(err?.message || 'Invalid Mermaid syntax');
        }
      }
    }
    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [draftCode, isEditing, node.id, uniqueId]);

  const cleanMermaidSvg = useMemo(() => {
    if (!svgHtml) return '';
    return DOMPurify.sanitize(svgHtml, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['foreignObject'],
      ADD_ATTR: ['dominant-baseline'],
    });
  }, [svgHtml]);

  if (isEditing) {
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}
      >
        <textarea
          value={draftCode}
          onChange={(e) => setDraftCode(e.target.value)}
          style={{
            flex: 1,
            width: '100%',
            background: '#020617',
            color: '#38bdf8',
            border: '1px solid #38bdf8',
            borderRadius: 8,
            padding: 8,
            fontSize: 11.5,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            resize: 'none',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button
            onClick={() => setIsEditing(false)}
            style={{
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #475569',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setIsEditing(false);
              onSaveMermaid(draftCode);
            }}
            style={{
              background: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✓ Render Diagram
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 5 }}>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 6,
            padding: '2px 7px',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ✏️ Edit Mermaid
        </button>
      </div>

      {renderError ? (
        <div
          style={{
            fontSize: 11,
            color: '#fda4af',
            background: 'rgba(244, 63, 94, 0.12)',
            padding: 8,
            borderRadius: 6,
            marginTop: 22,
          }}
        >
          Mermaid Syntax Error: {renderError}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            paddingTop: 14,
          }}
          dangerouslySetInnerHTML={{ __html: cleanMermaidSvg }}
        />
      )}
    </div>
  );
}
