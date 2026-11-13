export interface ResolvedTableStyle {
  headerBg: string;
  headerColor: string;
  borderColor: string;
  rowBg: string;
  rowAltBg: string;
  textColor: string;
  cellPadding: string;
  padding: string;
  borderRadius: number | string;
  fontSize: string;
  isBorderless: boolean;
  zebra: boolean;
  customCssString: string;
  cssCode: string;
}

const COLOR_THEMES: Array<{
  keywords: string[];
  headerBg: string;
  borderColor: string;
  rowAltBg: string;
}> = [
  {
    keywords: ['sky', 'blue', 'cyan'],
    headerBg: '#0284c7',
    borderColor: '#0284c7',
    rowAltBg: 'rgba(2, 132, 199, 0.08)',
  },
  {
    keywords: ['emerald', 'green', 'success'],
    headerBg: '#059669',
    borderColor: '#10b981',
    rowAltBg: 'rgba(16, 185, 129, 0.08)',
  },
  {
    keywords: ['amber', 'yellow', 'orange', 'warm'],
    headerBg: '#d97706',
    borderColor: '#f59e0b',
    rowAltBg: 'rgba(245, 158, 11, 0.08)',
  },
  {
    keywords: ['purple', 'violet', 'neon', 'glow'],
    headerBg: '#7c3aed',
    borderColor: '#a855f7',
    rowAltBg: 'rgba(168, 85, 247, 0.08)',
  },
  {
    keywords: ['rose', 'red', 'coral'],
    headerBg: '#e11d48',
    borderColor: '#f43f5e',
    rowAltBg: 'rgba(244, 63, 94, 0.08)',
  },
];

/**
 * Resolves natural-language style descriptions and presets into concrete table CSS tokens.
 */
export function resolveTableStyles(
  descriptionOrOptions:
    | string
    | { customStyleDescription?: string; stylePreset?: string } = '',
  presetArg: string = 'default'
): ResolvedTableStyle {
  const description =
    typeof descriptionOrOptions === 'object' && descriptionOrOptions !== null
      ? descriptionOrOptions.customStyleDescription || ''
      : descriptionOrOptions || '';
  const preset =
    typeof descriptionOrOptions === 'object' && descriptionOrOptions !== null
      ? descriptionOrOptions.stylePreset || presetArg
      : presetArg;

  const text = `${description} ${preset}`.toLowerCase();

  let headerBg = '#1e293b';
  let headerColor = '#f8fafc';
  let borderColor = '#334155';
  const rowBg = '#0f172a';
  let rowAltBg = '#0f172a';
  const textColor = '#e2e8f0';
  let cellPadding = '7px 11px';
  let borderRadius: number | string = 8;
  let fontSize = '12px';
  let isBorderless = false;

  const matchedTheme = COLOR_THEMES.find((theme) =>
    theme.keywords.some((kw) => text.includes(kw))
  );
  if (matchedTheme) {
    headerBg = matchedTheme.headerBg;
    headerColor = '#ffffff';
    borderColor = matchedTheme.borderColor;
    rowAltBg = matchedTheme.rowAltBg;
  }

  const zebra =
    text.includes('zebra') ||
    text.includes('stripe') ||
    text.includes('alternate') ||
    text.includes('alternating');

  if (zebra) {
    rowAltBg = rowAltBg !== '#0f172a' ? rowAltBg : '#1e293b';
  }

  if (
    text.includes('minimal') ||
    text.includes('borderless') ||
    text.includes('clean') ||
    text.includes('flat')
  ) {
    isBorderless = true;
    borderColor = 'transparent';
    if (!matchedTheme) {
      headerBg = 'rgba(30, 41, 59, 0.6)';
    }
    rowAltBg = 'transparent';
  }

  if (text.includes('compact') || text.includes('dense') || text.includes('small')) {
    cellPadding = '4px 7px';
    fontSize = '11.5px';
  } else if (
    text.includes('spacious') ||
    text.includes('airy') ||
    text.includes('large') ||
    text.includes('relaxed')
  ) {
    cellPadding = '10px 14px';
    fontSize = '13.5px';
  }

  if (text.includes('round') || text.includes('soft') || text.includes('pill')) {
    borderRadius = 8;
  }

  const customCssString = `/* Generated from style description: "${description || preset}" */
.scrappy-table {
  width: 100%;
  border-collapse: ${isBorderless ? 'separate' : 'collapse'};
  border-radius: ${typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius};
  font-size: ${fontSize};
  color: ${textColor};
  background-color: ${rowBg};
  border: ${isBorderless ? 'none' : `1px solid ${borderColor}`};
}
.scrappy-table th {
  background-color: ${headerBg};
  color: ${headerColor};
  padding: ${cellPadding};
  font-weight: 700;
  text-align: left;
  border-bottom: 2px solid ${borderColor};
}
.scrappy-table td {
  padding: ${cellPadding};
  border-bottom: 1px solid ${borderColor}55;
}
.scrappy-table tr:nth-child(even) td {
  background-color: ${rowAltBg};
}`;

  return {
    headerBg,
    headerColor,
    borderColor,
    rowBg,
    rowAltBg,
    textColor,
    cellPadding,
    padding: cellPadding,
    borderRadius,
    fontSize,
    isBorderless,
    zebra,
    customCssString,
    cssCode: customCssString,
  };
}
