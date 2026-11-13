import React from 'react';

export function toolBtnStyle(active: boolean, accent = '#38bdf8'): React.CSSProperties {
  return {
    background: active ? `${accent}25` : 'rgba(30, 41, 59, 0.85)',
    color: active ? accent : '#e2e8f0',
    border: `1px solid ${active ? accent : 'rgba(148, 163, 184, 0.25)'}`,
    borderRadius: 8,
    padding: '5px 9px',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

export function dockBtnStyle(active: boolean, customColor?: string): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 9,
    border: active ? `1.5px solid ${customColor || '#38bdf8'}` : '1px solid transparent',
    background: active ? (customColor ? `${customColor}33` : 'rgba(56, 189, 248, 0.22)') : 'transparent',
    color: active ? (customColor || '#38bdf8') : '#cbd5e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 16,
    transition: 'all 0.15s ease',
    padding: 0,
  };
}

export function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: active ? '#1e293b' : 'transparent',
    color: active ? '#38bdf8' : '#94a3b8',
    border: `1px solid ${active ? 'rgba(56, 189, 248, 0.4)' : 'transparent'}`,
    borderRadius: 8,
    padding: '6px 6px',
    fontSize: 10.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

export const dropdownActionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: '#e2e8f0',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'background 0.15s ease',
};

export const miniActionBtnStyle: React.CSSProperties = {
  border: 'none',
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#e2e8f0',
  fontSize: 12,
  padding: '3px 6px',
  borderRadius: 5,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

export const chipStyle: React.CSSProperties = {
  background: 'rgba(30, 41, 59, 0.9)',
  color: '#cbd5e1',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
};
