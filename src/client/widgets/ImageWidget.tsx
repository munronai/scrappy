import React, { useState } from 'react';
import type { CanvasNode } from '../../core/types.js';

/**
 * Image card widget supporting file upload, image URL input, or clipboard paste.
 */
export function ImageWidget({
  node,
  onUpdateImage,
}: {
  node: CanvasNode;
  onUpdateImage: (imageUrl: string) => void;
}) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(node.content.imageUrl || '');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateImage(reader.result);
        setEditingUrl(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        gap: 6,
      }}
    >
      {node.content.imageUrl && !editingUrl ? (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
          <img
            src={node.content.imageUrl}
            alt={node.content.title || 'Whiteboard Image'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setEditingUrl(true);
            }}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: 'rgba(15, 23, 42, 0.85)',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            🖼️ Change
          </button>
        </div>
      ) : (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 6,
            padding: 6,
            background: '#020617',
            borderRadius: 8,
            border: '1px dashed #475569',
          }}
        >
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            Upload an image file, paste a URL, or press <strong>Cmd+V / Ctrl+V</strong> on the board:
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ fontSize: 11, color: '#cbd5e1' }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://... or data:image/..."
              style={{
                flex: 1,
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '4px 7px',
                fontSize: 11,
              }}
            />
            <button
              onClick={() => {
                if (urlInput.trim()) {
                  onUpdateImage(urlInput.trim());
                  setEditingUrl(false);
                }
              }}
              style={{
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
