import React from 'react';
import { CollaboratorPresence } from '../../../core/index.js';

interface PresenceLayerProps {
  collaborators: CollaboratorPresence[];
}

/**
 * Renders real-time cursor indicators and status badges for collaborators and AI agents.
 * Renders a crisp SVG arrow pointer colored according to collaborator palette, with
 * a name tag and optional status text.
 */
export function PresenceLayer({ collaborators }: PresenceLayerProps) {
  return (
    <>
      {collaborators.map((c) => {
        const color = c.color || '#38bdf8';
        const isAgent = c.role === 'agent';

        return (
          <div
            key={c.actorId}
            style={{
              position: 'absolute',
              left: c.cursor.x,
              top: c.cursor.y,
              pointerEvents: 'none',
              transition: 'transform 0.08s ease-out, left 0.08s ease-out, top 0.08s ease-out',
              zIndex: 90,
            }}
          >
            {/* SVG Cursor Pointer Arrow */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              style={{
                filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.5))',
                transform: 'translate(-2px, -2px)',
              }}
            >
              <path
                d="M5.5 3.2L18.8 12.8C19.7 13.5 19.3 15 18.2 15.2L12.9 16L10.3 21.2C9.8 22.2 8.3 22 8 20.9L5.1 4.5C4.9 3.5 6 2.8 6.9 3.5L5.5 3.2Z"
                fill={color}
                stroke="#0f172a"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Collaborator Name Tag Badge */}
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: 14,
                background: color,
                color: '#0f172a',
                padding: '3px 8px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>{isAgent ? '🤖' : '👤'}</span>
              <span>{c.name}</span>
              {c.statusText && (
                <span style={{ opacity: 0.8, fontWeight: 500, fontSize: 10 }}>
                  · {c.statusText}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
