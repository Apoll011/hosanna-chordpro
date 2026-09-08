import { lintChordPro, type ChordProDiagnostic } from "../parser/linter";

export type { ChordProDiagnostic } from "../parser/linter";

export interface LintController {
  /** Re-runs validation (debounced) against the given ChordPro text. */
  lint: (text: string) => void;
  /** Clears markers/annotations and cancels any pending lint run. */
  dispose: () => void;
}

const STYLE_ELEMENT_ID = "chordpro-lint-styles";

/**
 * Injects the CSS used to underline lint markers in the Ace editor.
 * Safe to call multiple times — it's a no-op after the first call.
 */
export function injectChordProLintStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .chordpro-lint-error {
      position: absolute;
      border-bottom: 2px solid #ef4444;
      background: rgba(239, 68, 68, 0.08);
    }
    .chordpro-lint-warning {
      position: absolute;
      border-bottom: 2px dashed #f59e0b;
      background: rgba(245, 158, 11, 0.08);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Wires ChordPro validation into an Ace editor instance: gutter annotations
 * (hoverable error/warning markers in the gutter, matching Ace's native
 * lint UI) plus inline underline markers so mistakes are visible right in
 * the text, not just the margin.
 *
 * `aceInstance` is the global `ace` object (the same one `registerChordproMode`
 * receives) — used only to resolve `ace/range` for building marker ranges.
 */
export function attachChordProLinter(
  aceInstance: any,
  editor: any,
  onDiagnostics?: (diagnostics: ChordProDiagnostic[]) => void,
  debounceMs = 250,
): LintController {
  const session = editor?.session;
  let markerIds: number[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let RangeCtor: any = null;

  try {
    RangeCtor = aceInstance?.require?.("ace/range")?.Range;
  } catch {
    RangeCtor = null;
  }

  const clearMarkers = () => {
    if (!session || typeof session.removeMarker !== "function") return;
    for (const id of markerIds) session.removeMarker(id);
    markerIds = [];
  };

  const applyDiagnostics = (diagnostics: ChordProDiagnostic[]) => {
    if (!session) return;
    clearMarkers();

    if (typeof session.setAnnotations === "function") {
      session.setAnnotations(
        diagnostics.map((d) => ({
          row: d.line,
          column: d.column ?? 0,
          text: d.message,
          type: d.severity,
        })),
      );
    }

    if (RangeCtor && typeof session.addMarker === "function") {
      for (const d of diagnostics) {
        const lineText =
          typeof session.getLine === "function" ? session.getLine(d.line) : "";
        const startCol = d.column ?? 0;
        const endCol =
          d.endColumn ?? (lineText ? lineText.length : startCol + 1);
        if (endCol <= startCol) continue;
        const range = new RangeCtor(d.line, startCol, d.line, endCol);
        const className =
          d.severity === "error"
            ? "chordpro-lint-error"
            : "chordpro-lint-warning";
        try {
          const id = session.addMarker(range, className, "text");
          markerIds.push(id);
        } catch {
          // A stale range (e.g. line removed mid-edit) shouldn't break linting.
        }
      }
    }

    onDiagnostics?.(diagnostics);
  };

  const lint = (text: string) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      let diagnostics: ChordProDiagnostic[] = [];
      try {
        diagnostics = lintChordPro(text);
      } catch {
        diagnostics = [];
      }
      applyDiagnostics(diagnostics);
    }, debounceMs);
  };

  return {
    lint,
    dispose: () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearMarkers();
      if (session && typeof session.setAnnotations === "function") {
        session.setAnnotations([]);
      }
    },
  };
}
