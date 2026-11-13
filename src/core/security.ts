/**
 * Validates a board slug against path traversal and unsafe characters.
 * Must be 1-64 alphanumeric, underscore, or dash characters.
 */
export function isValidBoardSlug(slug: unknown): slug is string {
  if (typeof slug !== 'string') return false;
  const trimmed = slug.trim();
  if (!trimmed || trimmed.length > 64) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) && !trimmed.includes('..');
}

/**
 * Sanitizes an arbitrary ID or section slug into a filesystem-safe token.
 */
export function sanitizePathSlug(input: string, fallback = 'item'): string {
  const safe = input
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return safe || fallback;
}

/**
 * Converts a section title into a deterministic, optionally index-prefixed ICM slug.
 */
export function slugify(input: string, indexPrefix?: number): string {
  const base =
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'section';
  if (indexPrefix !== undefined && !/^\d{2}_/.test(base)) {
    return `${String(indexPrefix).padStart(2, '0')}_${base}`;
  }
  return base;
}
