import { ChecklistItem, TableData } from './types.js';

/**
 * Serializes checklist items into GitHub-flavored Markdown task list lines.
 */
export function formatChecklistToMarkdown(items: ChecklistItem[]): string {
  return items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n');
}

/**
 * Parses Markdown task list lines (`- [ ]` / `- [x]`) into structured ChecklistItems.
 */
export function extractChecklistFromMarkdown(body: string): ChecklistItem[] | undefined {
  const lines = body.split(/\r?\n/);
  const items: ChecklistItem[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      items.push({
        id: `item-${i + 1}`,
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
      });
    }
  }
  return items.length > 0 ? items : undefined;
}

/**
 * Serializes structured TableData into a Markdown pipe table.
 */
export function formatTableToMarkdown(table: TableData): string {
  if (!table || !table.columns || table.columns.length === 0) return '';
  const cols = table.columns;
  const header = `| ${cols.join(' | ')} |`;
  const sep = `| ${cols.map(() => ':---').join(' | ')} |`;
  const rows = (table.rows || []).map(
    (row) => `| ${cols.map((_, i) => String(row[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`
  );
  return [header, sep, ...rows].join('\n');
}

/**
 * Parses the first valid Markdown pipe table in a body string into TableData.
 */
export function extractTableFromMarkdown(body: string): TableData | undefined {
  if (!body) return undefined;
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  let tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('|') && line.endsWith('|')) {
      tableLines.push(line);
      inTable = true;
    } else if (inTable) {
      if (tableLines.length >= 2) break;
      tableLines = [];
      inTable = false;
    }
  }

  if (tableLines.length < 2) return undefined;

  const parseCells = (line: string) =>
    line
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim().replace(/\\\|/g, '|'));

  const header = parseCells(tableLines[0]);
  const sep = parseCells(tableLines[1]);
  const isSep = sep.length === header.length && sep.every((s) => /^:?-+:?$/.test(s));
  if (!isSep || header.length === 0) return undefined;

  const rows: string[][] = [];
  for (let i = 2; i < tableLines.length; i++) {
    const rawCells = parseCells(tableLines[i]);
    const normalized = header.map((_, idx) => rawCells[idx] ?? '');
    rows.push(normalized);
  }

  return {
    columns: header,
    rows,
  };
}
