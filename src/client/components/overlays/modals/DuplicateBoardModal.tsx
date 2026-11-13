import React, { useState } from 'react';

interface DuplicateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardName: string;
  currentBoardTitle: string;
  onDuplicateBoard: (targetSlug: string, title: string) => Promise<void>;
}

/**
 * Modal for cloning an existing board into a new independent board folder.
 */
export function DuplicateBoardModal({
  isOpen,
  onClose,
  currentBoardName,
  currentBoardTitle,
  onDuplicateBoard,
}: DuplicateBoardModalProps) {
  const [duplicateSlug, setDuplicateSlug] = useState(`${currentBoardName}-copy`);
  const [duplicateTitle, setDuplicateTitle] = useState(`${currentBoardTitle} (Copy)`);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          background: '#0f172a',
          border: '1.5px solid #a855f7',
          borderRadius: 14,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 24px 50px rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>
            💾 Save Board As / Duplicate
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#cbd5e1' }}>
          Clone current board{' '}
          <code style={{ color: '#38bdf8' }}>boards/{currentBoardName}</code> to a
          new independent board folder.
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>
            New Board Slug:
          </div>
          <input
            type="text"
            value={duplicateSlug}
            onChange={(e) => setDuplicateSlug(e.target.value)}
            placeholder="e.g. launch-plan-v2"
            style={{
              width: '100%',
              background: '#020617',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>
            New Display Title:
          </div>
          <input
            type="text"
            value={duplicateTitle}
            onChange={(e) => setDuplicateTitle(e.target.value)}
            placeholder="e.g. Launch Plan v2 (Post-Launch)"
            style={{
              width: '100%',
              background: '#020617',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 6,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#cbd5e1',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              const targetName = (duplicateSlug || `${currentBoardName}-copy`)
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, '-');
              const title = duplicateTitle || `${currentBoardTitle} (Copy)`;
              await onDuplicateBoard(targetName, title);
              onClose();
            }}
            style={{
              background: '#a855f7',
              color: '#f8fafc',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Save Copy & Switch
          </button>
        </div>
      </div>
    </div>
  );
}
