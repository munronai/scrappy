import React, { useState } from 'react';

interface ShareSecurityModalProps {
  isOpen: boolean;
  boardName: string;
  securityMode: 'public' | 'passcode' | 'group';
  hasPasscode: boolean;
  onClose: () => void;
  onUpdateSecurity: (mode: 'public' | 'passcode', passcode?: string) => Promise<void>;
}

/**
 * Modal for sharing board links, launching a multi-client local test window,
 * and configuring public vs. passcode room security.
 */
export function ShareSecurityModal({
  isOpen,
  boardName,
  securityMode,
  hasPasscode,
  onClose,
  onUpdateSecurity,
}: ShareSecurityModalProps) {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'public' | 'passcode'>(
    securityMode === 'passcode' ? 'passcode' : 'public'
  );
  const [passcode, setPasscode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedBobLink, setCopiedBobLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mainUrl = `${window.location.origin}/?board=${encodeURIComponent(boardName)}`;
  const testBobUrl = `${window.location.origin}/?board=${encodeURIComponent(boardName)}&name=Bob&color=10b981`;

  const copyToClipboard = (text: string, isBob = false) => {
    navigator.clipboard.writeText(text);
    if (isBob) {
      setCopiedBobLink(true);
      setTimeout(() => setCopiedBobLink(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onUpdateSecurity(mode, passcode);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
          background: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 14,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>👥 Share & Realtime Collaboration</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Shareable Board Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>Direct Board Link</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              readOnly
              value={mainUrl}
              style={{
                flex: 1,
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#94a3b8',
                fontSize: 12,
              }}
            />
            <button
              onClick={() => copyToClipboard(mainUrl)}
              style={{
                background: '#38bdf8',
                color: '#0f172a',
                border: 'none',
                borderRadius: 8,
                padding: '0 14px',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {copiedLink ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* 2-Client Test Helper Link */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: 10,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8' }}>
            🧪 Multi-Client Local Testing Helper
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.4 }}>
            Open a second browser tab or incognito window with this link to instantly join as <strong>Bob (Green cursor)</strong> alongside your current window:
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input
              type="text"
              readOnly
              value={testBobUrl}
              style={{
                flex: 1,
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '6px 10px',
                color: '#94a3b8',
                fontSize: 11,
              }}
            />
            <button
              onClick={() => copyToClipboard(testBobUrl, true)}
              style={{
                background: '#10b981',
                color: '#0f172a',
                border: 'none',
                borderRadius: 8,
                padding: '0 12px',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {copiedBobLink ? '✓ Copied' : 'Copy Bob Link'}
            </button>
          </div>
        </div>

        {/* Security / Passcode Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>Room Security & Access Control</div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="securityMode"
              checked={mode === 'public'}
              onChange={() => setMode('public')}
            />
            <span>🌐 <strong>Public Link:</strong> Anyone with the URL can view and collaborate.</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              color: '#f8fafc',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="securityMode"
              checked={mode === 'passcode'}
              onChange={() => setMode('passcode')}
            />
            <span>🔒 <strong>Passcode Protected:</strong> Require a room password before granting access.</span>
          </label>

          {mode === 'passcode' && (
            <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={hasPasscode ? 'Enter new passcode (or leave blank to keep)' : 'Enter room passcode'}
                style={{
                  background: '#020617',
                  border: '1px solid #475569',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#f8fafc',
                  fontSize: 12,
                }}
              />
              <div style={{ fontSize: 10, color: '#94a3b8' }}>
                {hasPasscode ? 'Passcode is currently active.' : 'Set a passcode to lock this board.'}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
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
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            style={{
              background: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? 'Saving...' : 'Apply Security'}
          </button>
        </div>
      </div>
    </div>
  );
}
