/**
 * ChordPro Formatter — Ace Editor Integration
 *
 * This module bridges the editor-independent core formatter with the Ace editor.
 * It does NOT contain any formatting logic itself; all formatting is delegated
 * to the core `formatChordPro` function.
 *
 * The Ace editor instance is typed as `any` to avoid a hard dependency on
 * ace-builds in this file.
 */

import { formatChordPro } from "../format";
import type { FormatOptions, FormatResult } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A minimal subset of the Ace editor interface used by the integration. */
export interface AceEditorLike {
  getValue(): string;
  setValue(value: string, cursorPos?: number): void;
  getSelectedText(): string;
  session: {
    getTextRange(range: AceRangeLike): string;
    replace(range: AceRangeLike, text: string): void;
    insert(position: AcePositionLike, text: string): void;
    getDocument(): { createAnchor(row: number, column: number): AceAnchorLike };
    getLine(row: number): string;
    getLength(): number;
  };
  getSelection(): {
    getRange(): AceRangeLike;
    setRange(range: AceRangeLike): void;
    isEmpty(): boolean;
  };
  getCursorPosition(): AcePositionLike;
  moveCursorTo(row: number, column: number): void;
  commands: {
    addCommand(command: AceCommand): void;
  };
}

export interface AceRangeLike {
  start: AcePositionLike;
  end: AcePositionLike;
  isEmpty?(): boolean;
}

export interface AcePositionLike {
  row: number;
  column: number;
}

export interface AceAnchorLike {
  row: number;
  column: number;
  detach(): void;
}

export interface AceCommand {
  name: string;
  bindKey: { win: string; mac: string };
  exec(editor: any): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safely read the full document content from an Ace editor.
 */
function getDocumentContent(editor: any): string | null {
  if (!editor || typeof editor.getValue !== "function") return null;
  return editor.getValue();
}

/**
 * Apply formatted content to the Ace editor as a single atomic (undoable) operation.
 * Preserves the cursor position as closely as possible.
 */
function applyFormattedDocument(
  editor: any,
  result: FormatResult,
): void {
  if (!result.changed) return;

  // Record cursor position before the change
  const cursor = typeof editor.getCursorPosition === "function"
    ? editor.getCursorPosition()
    : { row: 0, column: 0 };

  // Ace's setValue with -1 keeps cursor at end; with 1 moves to start.
  // We'll manage cursor manually.
  // Use session.replace over the entire document to create a single undo entry.
  const session = editor.session;
  if (session && typeof session.replace === "function") {
    const lastRow = session.getLength() - 1;
    const lastCol = session.getLine(lastRow).length;
    const fullRange = {
      start: { row: 0, column: 0 },
      end: { row: lastRow, column: lastCol },
    };
    session.replace(fullRange, result.content);
  } else {
    // Fallback: use setValue (loses undo granularity but still works)
    editor.setValue(result.content, -1);
  }

  // Restore cursor position (best-effort: clamp to new document bounds)
  if (typeof editor.moveCursorTo === "function") {
    const newLineCount = result.content.split("\n").length;
    const clampedRow = Math.min(cursor.row, newLineCount - 1);
    editor.moveCursorTo(clampedRow, cursor.column);
  }
}

/**
 * Apply formatted content for a selection-based format operation.
 * Replaces only the selected range and tries to restore the selection.
 */
function applyFormattedSelection(
  editor: any,
  range: AceRangeLike,
  result: FormatResult,
): void {
  if (!result.changed) return;

  const session = editor.session;
  if (!session || typeof session.replace !== "function") return;

  // Replace the selected range with the formatted content
  session.replace(range, result.content);

  // Attempt to restore selection over the formatted text
  try {
    const selection = editor.getSelection();
    if (selection && typeof selection.setRange === "function") {
      const newLines = result.content.split("\n");
      const endRow = range.start.row + newLines.length - 1;
      const endCol = newLines.length === 1
        ? range.start.column + newLines[0].length
        : newLines[newLines.length - 1].length;
      selection.setRange({
        start: range.start,
        end: { row: endRow, column: endCol },
      });
    }
  } catch {
    // If selection restoration fails, leave cursor where it is
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Format the entire document in the given Ace editor.
 *
 * - Creates a single undoable action (Ctrl/Cmd+Z undoes all formatting at once).
 * - Preserves cursor position as closely as possible.
 * - Does nothing if the document content doesn't change.
 *
 * @returns The FormatResult from the core formatter, useful for UI feedback.
 */
export function formatAceDocument(
  editor: any,
  options?: FormatOptions,
): FormatResult | null {
  const content = getDocumentContent(editor);
  if (content === null) return null;

  const result = formatChordPro(content, options);
  applyFormattedDocument(editor, result);
  return result;
}

/**
 * Format only the selected text in the given Ace editor.
 * If there is no selection, falls back to formatting the entire document.
 *
 * - Creates a single undoable action.
 * - Attempts to restore the selection after formatting.
 *
 * @returns The FormatResult from the core formatter.
 */
export function formatAceSelection(
  editor: any,
  options?: FormatOptions,
): FormatResult | null {
  if (!editor) return null;

  const selection = typeof editor.getSelection === "function"
    ? editor.getSelection()
    : null;

  const hasSelection = selection &&
    typeof selection.isEmpty === "function" &&
    !selection.isEmpty();

  if (!hasSelection) {
    return formatAceDocument(editor, options);
  }

  const range: AceRangeLike = selection.getRange();
  const selectedText: string = editor.session.getTextRange(range);

  if (!selectedText.trim()) {
    return formatAceDocument(editor, options);
  }

  const result = formatChordPro(selectedText, options);
  applyFormattedSelection(editor, range, result);
  return result;
}

/**
 * Register the format-document keyboard shortcut on an Ace editor instance.
 *
 * Binds:
 * - Windows/Linux: Ctrl+Shift+F
 * - macOS: Cmd+Shift+F
 *
 * If there is a selection, formats the selection; otherwise formats the document.
 *
 * @param editor - The Ace editor instance.
 * @param onResult - Optional callback called with the FormatResult after formatting.
 *                   Use this to display toast notifications or update UI state.
 * @param options - Optional formatting options.
 */
export function registerFormatShortcut(
  editor: any,
  onResult?: (result: FormatResult) => void,
  options?: FormatOptions,
): void {
  if (
    !editor ||
    !editor.commands ||
    typeof editor.commands.addCommand !== "function"
  ) {
    return;
  }

  editor.commands.addCommand({
    name: "formatChordPro",
    bindKey: { win: "Ctrl-Shift-F", mac: "Cmd-Shift-F" },
    exec: (ed: any) => {
      const result = formatAceSelection(ed, options);
      if (result && onResult) {
        onResult(result);
      }
    },
  });
}
