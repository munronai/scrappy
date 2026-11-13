import { useEffect } from 'react';
import { ActiveTool } from '../types.js';
import { GraphOp } from '../../core/types.js';

interface UseCanvasShortcutsProps {
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  selectedNodeIds: string[];
  editingEdgeId?: string;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  onToggleQuickPrompt: () => void;
  onPasteImage: (imageUrl: string, boardX: number, boardY: number) => void;
  onPasteMermaid: (mermaidCode: string, boardX: number, boardY: number) => void;
  getCenterCoordinates: () => { x: number; y: number };
}

export function useCanvasShortcuts({
  setActiveTool,
  selectedNodeIds,
  editingEdgeId,
  onDeleteSelected,
  onClearSelection,
  onToggleQuickPrompt,
  onPasteImage,
  onPasteMermaid,
  getCenterCoordinates,
}: UseCanvasShortcutsProps) {
  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isInput) return;

      // Cmd+K / Ctrl+K: Quick prompt bar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onToggleQuickPrompt();
        return;
      }

      // Delete / Backspace: Remove selected cards or connector line
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0 || editingEdgeId) {
          e.preventDefault();
          onDeleteSelected();
        }
        return;
      }

      // Escape: Dismiss active selections and tools
      if (e.key === 'Escape') {
        onClearSelection();
        return;
      }

      // Single-key tool switches
      if (e.key.toLowerCase() === 'v' || e.key === '1') {
        setActiveTool('select');
      } else if (e.key.toLowerCase() === 'h' || e.key === '2') {
        setActiveTool('pan');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, editingEdgeId, onDeleteSelected, onClearSelection, onToggleQuickPrompt, setActiveTool]);

  // Clipboard Paste (Cmd+V / Ctrl+V for images or Mermaid text)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const center = getCenterCoordinates();

      // 1. Check for image files in clipboard
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              e.preventDefault();
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  onPasteImage(reader.result, center.x, center.y);
                }
              };
              reader.readAsDataURL(file);
              return;
            }
          }
        }
      }

      // 2. Check for Mermaid text or image URLs
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text) {
        if (/^(flowchart|graph|sequenceDiagram|stateDiagram|classDiagram|erDiagram)\b/.test(text)) {
          e.preventDefault();
          onPasteMermaid(text, center.x, center.y);
        } else if (/^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i.test(text)) {
          e.preventDefault();
          onPasteImage(text, center.x, center.y);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [getCenterCoordinates, onPasteImage, onPasteMermaid]);
}
