import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isValidBoardSlug, sanitizePathSlug, createDefaultBoard } from './engine.js';
import { ICMAdapter } from '../icm/adapter.js';

describe('P0 Security Patches Verification', () => {
  describe('SEC-03: Board Slug & Path Traversal Prevention', () => {
    it('validates safe board slugs correctly', () => {
      expect(isValidBoardSlug('launch-plan')).toBe(true);
      expect(isValidBoardSlug('board_123')).toBe(true);
      expect(isValidBoardSlug('Q4-Product-Launch')).toBe(true);
      expect(isValidBoardSlug('a')).toBe(true);
    });

    it('rejects path traversal attempts and dangerous slugs', () => {
      expect(isValidBoardSlug('..')).toBe(false);
      expect(isValidBoardSlug('../../etc')).toBe(false);
      expect(isValidBoardSlug('..\\..\\windows')).toBe(false);
      expect(isValidBoardSlug('/absolute/path')).toBe(false);
      expect(isValidBoardSlug('board/name')).toBe(false);
      expect(isValidBoardSlug('board name with spaces')).toBe(false);
      expect(isValidBoardSlug('')).toBe(false);
      expect(isValidBoardSlug('   ')).toBe(false);
      expect(isValidBoardSlug(null)).toBe(false);
      expect(isValidBoardSlug(undefined)).toBe(false);
      expect(isValidBoardSlug('a'.repeat(65))).toBe(false); // exceeds 64 chars
    });

    it('sanitizes unsafe node IDs and section slugs', () => {
      expect(sanitizePathSlug('../../../evil-node')).toBe('evil-node');
      expect(sanitizePathSlug('sec/../../01')).toBe('sec_01');
      expect(sanitizePathSlug('valid-id_123')).toBe('valid-id_123');
      expect(sanitizePathSlug('   ')).toBe('item');
    });

    it('ICMAdapter.getBoardDir blocks directory traversal attempts', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-sec-'));
      const icm = new ICMAdapter(tmpDir);

      expect(() => icm.getBoardDir('../../etc/passwd')).toThrow(/Invalid board name/);
      expect(() => icm.getBoardDir('..')).toThrow(/Invalid board name/);
      expect(() => icm.getBoardDir('/root/dir')).toThrow(/Invalid board name/);
      expect(() => icm.getBoardDir('valid-board')).not.toThrow();

      // Clean up
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('prevents node and section traversal from escaping board directory during saveBoardToDisk', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scrappy-sec-save-'));
      const icm = new ICMAdapter(tmpDir);
      const board = createDefaultBoard('sec-board', 'Security Test Board');

      // Attempt injection via malicious section slug and node ID
      board.sections['sec-evil'] = {
        id: 'sec-evil',
        slug: '../../evil-section',
        title: 'Evil Section',
        bounds: { x: 0, y: 0, width: 200, height: 200 },
        color: '#ff0000',
      };
      board.nodes['node-evil'] = {
        id: '../../evil-node',
        type: 'sticky',
        sectionId: 'sec-evil',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 100 },
        content: { title: 'Evil Node', body: 'Malicious Content' },
        style: { color: '#ffffff' },
        updatedBy: 'attacker',
        updatedAt: new Date().toISOString(),
      };

      icm.saveBoardToDisk(board);

      const boardDir = icm.getBoardDir('sec-board');
      // Verify files are kept strictly within boardDir
      const parentDirFiles = fs.readdirSync(tmpDir);
      expect(parentDirFiles).toEqual(['sec-board']); // No escaped directories in tmpDir!

      // Clean up
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
