import React, { useState } from 'react';

interface NewBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBoard: (slug: string, title: string, template: string) => Promise<void>;
}

/**
 * Modal for creating a new board from a clean canvas or starter template.
 */
export function NewBoardModal({ isOpen, onClose, onCreateBoard }: NewBoardModalProps) {
  const [template, setTemplate] = useState<'clean' | 'default' | 'pipeline' | 'retrospective'>('clean');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');

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
          width: 520,
          background: '#0f172a',
          border: '1.5px solid #38bdf8',
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
            {template === 'clean'
              ? '✨ Start Clean Board'
              : '📋 Start Board from Template'}
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

        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
            Select Board Starting Template:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { id: 'clean', title: '🌟 Clean Board', desc: 'Empty canvas with 0 objects' },
              { id: 'default', title: '🚀 Launch Plan', desc: 'Discovery, Architecture & Launch' },
              { id: 'pipeline', title: '🏗️ ICM Pipeline', desc: '4-stage Brief, Style, Gen & QA' },
              { id: 'retrospective', title: '🔄 Retrospective', desc: 'Went Well, Challenges, Actions' },
            ].map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setTemplate(tpl.id as any)}
                style={{
                  background:
                    template === tpl.id
                      ? 'rgba(56, 189, 248, 0.2)'
                      : 'rgba(30, 41, 59, 0.7)',
                  border: `1.5px solid ${
                    template === tpl.id ? '#38bdf8' : 'rgba(255,255,255,0.1)'
                  }`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: template === tpl.id ? '#38bdf8' : '#f8fafc',
                  }}
                >
                  {tpl.title}
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                  {tpl.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>
            Board Slug (folder name in `boards/`):
          </div>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. q1-product-sprint"
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
            Display Title:
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q1 Product Sprint Whiteboard"
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
              const cleanSlug = (slug || 'new-board')
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, '-');
              const cleanTitle =
                title ||
                cleanSlug
                  .replace(/[-_]+/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase());
              await onCreateBoard(cleanSlug, cleanTitle, template);
              onClose();
            }}
            style={{
              background: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Create & Open Board
          </button>
        </div>
      </div>
    </div>
  );
}
