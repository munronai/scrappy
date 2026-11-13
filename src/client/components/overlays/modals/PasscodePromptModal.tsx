import React, { useState } from 'react';

interface PasscodePromptModalProps {
  isOpen: boolean;
  boardName: string;
  errorMessage?: string;
  onSubmit: (passcode: string) => Promise<boolean>;
}

/**
 * Modal prompting the user for a room passcode when joining a locked board.
 */
export function PasscodePromptModal({
  isOpen,
  boardName,
  errorMessage,
  onSubmit,
}: PasscodePromptModalProps) {
  if (!isOpen) return null;

  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(errorMessage || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    setIsSubmitting(true);
    setError('');
    try {
      const ok = await onSubmit(passcode);
      if (!ok) {
        setError('Invalid room passcode. Please try again.');
      }
    } catch {
      setError('Failed to authenticate with board.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(8px)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 380,
          background: '#0f172a',
          border: '1px solid #f59e0b',
          borderRadius: 14,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc' }}>
            Board Passcode Required
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            The board <strong>{boardName}</strong> is locked. Enter the room passcode to join:
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#f43f5e22',
              border: '1px solid #f43f5e',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#f43f5e',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Enter passcode..."
          style={{
            background: '#020617',
            border: '1px solid #475569',
            borderRadius: 8,
            padding: '10px 14px',
            color: '#f8fafc',
            fontSize: 13,
            outline: 'none',
          }}
        />

        <button
          type="submit"
          disabled={isSubmitting || !passcode}
          style={{
            background: '#f59e0b',
            color: '#0f172a',
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            opacity: isSubmitting || !passcode ? 0.6 : 1,
          }}
        >
          {isSubmitting ? 'Unlocking...' : 'Unlock & Join Board'}
        </button>
      </form>
    </div>
  );
}
