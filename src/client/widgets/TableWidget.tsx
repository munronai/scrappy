import React, { useEffect, useState } from 'react';
import type { CanvasNode, TableData } from '../../core/types.js';
import {
  extractTableFromMarkdown,
  formatTableToMarkdown,
  resolveTableStyles,
} from '../../core/engine.js';

/**
 * Interactive and styled table widget supporting rendered view, visual grid editing,
 * raw Markdown editing, and natural-language style presets.
 */
export function TableWidget({
  node,
  onUpdateTable,
}: {
  node: CanvasNode;
  onUpdateTable: (table: TableData, markdownBody: string) => void;
}) {
  const [mode, setMode] = useState<'rendered' | 'visual_edit' | 'markdown_edit' | 'style_designer'>(
    'rendered'
  );

  const initialTable: TableData =
    node.content.tableData ||
    extractTableFromMarkdown(node.content.body) || {
      columns: ['Feature / Milestone', 'Status', 'Owner', 'Priority'],
      rows: [
        ['ICM Stage Architecture', 'Done', 'munron', 'High'],
        ['Interactive Table Widget', 'In Progress', '@scrappy', 'High'],
        ['Custom CSS Stylizer', 'Ready', 'Team', 'Medium'],
      ],
      stylePreset: 'default',
      customStyleDescription: '',
    };

  const [cols, setCols] = useState<string[]>(initialTable.columns || ['Col 1', 'Col 2']);
  const [rows, setRows] = useState<string[][]>(
    initialTable.rows || [
      ['Row 1 Col 1', 'Row 1 Col 2'],
      ['Row 2 Col 1', 'Row 2 Col 2'],
    ]
  );
  const [markdownDraft, setMarkdownDraft] = useState<string>(
    node.content.body?.trim().startsWith('|')
      ? node.content.body
      : formatTableToMarkdown(initialTable)
  );

  const [stylePreset, setStylePreset] = useState<string>(initialTable.stylePreset || 'default');
  const [styleDesc, setStyleDesc] = useState<string>(initialTable.customStyleDescription || '');
  const [showCssRef, setShowCssRef] = useState(false);

  // Sync state if node content changes externally
  useEffect(() => {
    if (node.content.tableData) {
      setCols(node.content.tableData.columns || ['Col 1', 'Col 2']);
      setRows(node.content.tableData.rows || []);
      setStylePreset(node.content.tableData.stylePreset || 'default');
      setStyleDesc(node.content.tableData.customStyleDescription || '');
      setMarkdownDraft(formatTableToMarkdown(node.content.tableData));
    } else if (node.content.body?.trim().startsWith('|')) {
      const parsed = extractTableFromMarkdown(node.content.body);
      if (parsed) {
        setCols(parsed.columns);
        setRows(parsed.rows);
        setMarkdownDraft(node.content.body);
      }
    }
  }, [node.content.tableData, node.content.body]);

  const resolved = resolveTableStyles(styleDesc, stylePreset);

  const handleSaveVisual = () => {
    const cleanCols = cols.length > 0 ? cols : ['Col 1'];
    const cleanRows = rows.map((r) => cleanCols.map((_, i) => r[i] || ''));
    const nextTable: TableData = {
      columns: cleanCols,
      rows: cleanRows,
      stylePreset,
      customStyleDescription: styleDesc,
      customCss: resolved.customCssString,
    };
    const md = formatTableToMarkdown(nextTable);
    setMarkdownDraft(md);
    onUpdateTable(nextTable, md);
    setMode('rendered');
  };

  const handleSaveMarkdown = () => {
    const parsed = extractTableFromMarkdown(markdownDraft);
    if (parsed) {
      const nextTable: TableData = {
        columns: parsed.columns,
        rows: parsed.rows,
        stylePreset,
        customStyleDescription: styleDesc,
        customCss: resolved.customCssString,
      };
      setCols(parsed.columns);
      setRows(parsed.rows);
      onUpdateTable(nextTable, markdownDraft);
      setMode('rendered');
    } else {
      alert('Invalid Markdown table format. Please ensure each row starts and ends with "|"');
    }
  };

  const handleApplyStyle = (preset: string, desc: string) => {
    setStylePreset(preset);
    setStyleDesc(desc);
    const nextResolved = resolveTableStyles(desc, preset);
    const nextTable: TableData = {
      columns: cols,
      rows,
      stylePreset: preset,
      customStyleDescription: desc,
      customCss: nextResolved.customCssString,
    };
    onUpdateTable(nextTable, formatTableToMarkdown(nextTable));
  };

  const addColumn = () => {
    const newColName = `Col ${cols.length + 1}`;
    setCols([...cols, newColName]);
    setRows(rows.map((r) => [...r, '']));
  };

  const deleteColumn = (idx: number) => {
    if (cols.length <= 1) return;
    setCols(cols.filter((_, i) => i !== idx));
    setRows(rows.map((r) => r.filter((_, i) => i !== idx)));
  };

  const addRow = () => {
    setRows([...rows, cols.map(() => '')]);
  };

  const deleteRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    const next = rows.map((r, ri) =>
      ri === rowIdx ? r.map((c, ci) => (ci === colIdx ? val : c)) : r
    );
    setRows(next);
  };

  const updateColName = (colIdx: number, name: string) => {
    const next = cols.map((c, ci) => (ci === colIdx ? name : c));
    setCols(next);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        gap: 6,
      }}
    >
      {/* Top Mode Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.75)',
          padding: '4px 6px',
          borderRadius: 6,
          fontSize: 10.5,
          border: '1px solid rgba(148, 163, 184, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, color: '#38bdf8' }}>
            📋 {cols.length}×{rows.length} Table
          </span>
          <span
            style={{
              fontSize: 9.5,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              padding: '1px 5px',
              borderRadius: 4,
              fontFamily: 'monospace',
            }}
          >
            {stylePreset}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setMode('rendered')}
            style={tableSubBtnStyle(mode === 'rendered', '#38bdf8')}
            title="View rendered table"
          >
            👀 View
          </button>
          <button
            onClick={() => {
              setMode('visual_edit');
              setCols(initialTable.columns);
              setRows(initialTable.rows);
            }}
            style={tableSubBtnStyle(mode === 'visual_edit', '#10b981')}
            title="Visual grid editor: add/remove rows and columns"
          >
            ✏️ Visual
          </button>
          <button
            onClick={() => {
              setMode('markdown_edit');
              setMarkdownDraft(formatTableToMarkdown({ columns: cols, rows }));
            }}
            style={tableSubBtnStyle(mode === 'markdown_edit', '#f59e0b')}
            title="Edit table directly as Markdown"
          >
            📝 Markdown
          </button>
          <button
            onClick={() => setMode('style_designer')}
            style={tableSubBtnStyle(mode === 'style_designer', '#a855f7')}
            title="Style designer: describe styling in plain English without CSS"
          >
            🎨 Style
          </button>
        </div>
      </div>

      {/* Mode 1: Rendered View */}
      {mode === 'rendered' && (
        <div style={{ flex: 1, overflow: 'auto', borderRadius: resolved.borderRadius }}>
          <table
            className="scrappy-table"
            style={{
              width: '100%',
              borderCollapse: resolved.isBorderless ? 'separate' : 'collapse',
              fontSize: resolved.fontSize,
              color: resolved.textColor,
              backgroundColor: resolved.rowBg,
              border: resolved.isBorderless ? 'none' : `1px solid ${resolved.borderColor}`,
              borderRadius: resolved.borderRadius,
            }}
          >
            <thead>
              <tr>
                {cols.map((col, idx) => (
                  <th
                    key={idx}
                    style={{
                      backgroundColor: resolved.headerBg,
                      color: resolved.headerColor,
                      padding: resolved.cellPadding,
                      fontWeight: 700,
                      textAlign: 'left',
                      borderBottom: `2px solid ${resolved.borderColor}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                const isEven = rIdx % 2 === 1;
                const bg = isEven ? resolved.rowAltBg : resolved.rowBg;
                return (
                  <tr key={rIdx}>
                    {cols.map((_, cIdx) => (
                      <td
                        key={cIdx}
                        style={{
                          padding: resolved.cellPadding,
                          backgroundColor: bg,
                          borderBottom: resolved.isBorderless
                            ? 'none'
                            : `1px solid ${resolved.borderColor}55`,
                        }}
                      >
                        {row[cIdx] || '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mode 2: Visual Grid Editor */}
      {mode === 'visual_edit' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Add or remove columns and rows below:
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={addColumn} style={tableActionBtnStyle('#38bdf8')}>
                + Col
              </button>
              <button onClick={addRow} style={tableActionBtnStyle('#10b981')}>
                + Row
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #334155', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {cols.map((col, cIdx) => (
                    <th
                      key={cIdx}
                      style={{
                        background: '#1e293b',
                        padding: 4,
                        borderBottom: '2px solid #334155',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          value={col}
                          onChange={(e) => updateColName(cIdx, e.target.value)}
                          style={tableHeaderInputStyle}
                        />
                        {cols.length > 1 && (
                          <button
                            onClick={() => deleteColumn(cIdx)}
                            title="Delete Column"
                            style={tableDeleteBtnStyle}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{ background: '#1e293b', width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {cols.map((_, cIdx) => (
                      <td key={cIdx} style={{ padding: 3, borderBottom: '1px solid #334155' }}>
                        <input
                          value={row[cIdx] || ''}
                          onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                          placeholder="Cell data"
                          style={tableCellInputStyle}
                        />
                      </td>
                    ))}
                    <td style={{ padding: 3, textAlign: 'center', borderBottom: '1px solid #334155' }}>
                      {rows.length > 1 && (
                        <button
                          onClick={() => deleteRow(rIdx)}
                          title="Delete Row"
                          style={tableDeleteBtnStyle}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button onClick={() => setMode('rendered')} style={tableCancelBtnStyle}>
              Cancel
            </button>
            <button onClick={handleSaveVisual} style={tableSaveBtnStyle('#10b981')}>
              ✓ Save & Render
            </button>
          </div>
        </div>
      )}

      {/* Mode 3: Markdown Table Editor */}
      {mode === 'markdown_edit' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            Enter or paste standard Markdown table syntax:
          </div>
          <textarea
            value={markdownDraft}
            onChange={(e) => setMarkdownDraft(e.target.value)}
            placeholder="| Col 1 | Col 2 |\n| :--- | :--- |\n| Data 1 | Data 2 |"
            style={{
              flex: 1,
              background: '#020617',
              color: '#38bdf8',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              resize: 'none',
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button onClick={() => setMode('rendered')} style={tableCancelBtnStyle}>
              Cancel
            </button>
            <button onClick={handleSaveMarkdown} style={tableSaveBtnStyle('#f59e0b')}>
              ✓ Parse & Save
            </button>
          </div>
        </div>
      )}

      {/* Mode 4: Style Designer (Describe without knowing CSS) */}
      {mode === 'style_designer' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflowY: 'auto',
            background: 'rgba(2, 6, 23, 0.6)',
            padding: 8,
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 2 }}>
              🎨 Natural Style Description (No CSS Needed):
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
              Type plain English style rules (e.g., <em>zebra stripes, sky blue header, compact text, rounded corners</em>):
            </div>
            <input
              value={styleDesc}
              onChange={(e) => {
                setStyleDesc(e.target.value);
                handleApplyStyle(stylePreset, e.target.value);
              }}
              placeholder="e.g. zebra stripes, sky blue header, compact text"
              style={{
                width: '100%',
                background: '#020617',
                color: '#f8fafc',
                border: '1px solid #a855f7',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 11.5,
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 4 }}>
              Or Choose a Ready-Made Preset:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[
                { id: 'default', label: 'Default Slate', desc: '' },
                { id: 'zebra', label: '🦓 Zebra Striped', desc: 'zebra alternating rows' },
                { id: 'sky', label: '🌊 Sky Header', desc: 'sky blue header cyan border' },
                { id: 'emerald', label: '🌿 Emerald Grid', desc: 'emerald green success grid' },
                { id: 'amber', label: '⚡ Warm Amber', desc: 'warm amber priority' },
                { id: 'purple', label: '🔮 Neon Purple', desc: 'neon purple glowing header' },
                { id: 'minimal', label: '✨ Minimal Clean', desc: 'minimal borderless clean' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleApplyStyle(p.id, p.desc)}
                  style={{
                    background: stylePreset === p.id ? 'rgba(168, 85, 247, 0.25)' : '#0f172a',
                    color: stylePreset === p.id ? '#c084fc' : '#94a3b8',
                    border: `1px solid ${stylePreset === p.id ? '#a855f7' : '#334155'}`,
                    borderRadius: 6,
                    padding: '3px 7px',
                    fontSize: 10,
                    fontWeight: stylePreset === p.id ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generated CSS Reference Accordion */}
          <div>
            <button
              onClick={() => setShowCssRef((s) => !s)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: 10.5,
                padding: 0,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {showCssRef ? '▼ Hide Generated CSS Reference' : '▶ { } View Generated CSS Reference'}
            </button>
            {showCssRef && (
              <pre
                style={{
                  background: '#020617',
                  color: '#38bdf8',
                  fontSize: 9.5,
                  padding: 8,
                  borderRadius: 6,
                  marginTop: 4,
                  overflowX: 'auto',
                  border: '1px solid #1e293b',
                  lineHeight: 1.4,
                }}
              >
                {resolved.customCssString}
              </pre>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              onClick={() => setMode('rendered')}
              style={tableSaveBtnStyle('#a855f7')}
            >
              ✓ Apply & Back to Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function tableSubBtnStyle(active: boolean, color = '#38bdf8'): React.CSSProperties {
  return {
    background: active ? `${color}25` : 'transparent',
    color: active ? color : '#94a3b8',
    border: `1px solid ${active ? color : 'transparent'}`,
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
  };
}

function tableActionBtnStyle(color = '#38bdf8'): React.CSSProperties {
  return {
    background: `${color}18`,
    color,
    border: `1px solid ${color}44`,
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
  };
}

const tableCancelBtnStyle: React.CSSProperties = {
  background: '#1e293b',
  color: '#cbd5e1',
  border: '1px solid #475569',
  borderRadius: 6,
  padding: '4px 9px',
  fontSize: 11,
  cursor: 'pointer',
};

function tableSaveBtnStyle(color: string): React.CSSProperties {
  return {
    background: color,
    color: '#0f172a',
    border: 'none',
    borderRadius: 6,
    padding: '4px 11px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  };
}

const tableDeleteBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#f43f5e',
  cursor: 'pointer',
  fontSize: 11,
  padding: '1px 3px',
};

const tableHeaderInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  color: '#f8fafc',
  border: '1px solid #475569',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 11,
  fontWeight: 700,
};

const tableCellInputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  color: '#cbd5e1',
  border: '1px solid #334155',
  borderRadius: 4,
  padding: '3px 6px',
  fontSize: 10.5,
};
