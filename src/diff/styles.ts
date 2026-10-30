const STYLE_ELEMENT_ID = "hosanna-chordpro-diff-styles";

/**
 * Theming: every colour is a `--hcd-*` custom property defined on the root,
 * so a host app can restyle the editor by setting them on the element (or a
 * parent) — e.g. `--hcd-bg: var(--surface)`.
 */
export const DIFF_CSS = /* css */ `
.hcd-root {
  --hcd-font: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --hcd-font-size: 13px;
  --hcd-radius: 8px;
  --hcd-no-w: 3.4em;

  --hcd-bg: #ffffff;
  --hcd-fg: #1f2328;
  --hcd-muted: #656d76;
  --hcd-border: #d0d7de;
  --hcd-toolbar-bg: #f6f8fa;
  --hcd-gutter-bg: #f6f8fa;
  --hcd-gutter-fg: #8c959f;
  --hcd-hover: rgba(127, 127, 127, 0.12);
  --hcd-accent: #0969da;
  --hcd-accent-fg: #ffffff;

  --hcd-add-bg: rgba(46, 160, 67, 0.13);
  --hcd-add-gutter: rgba(46, 160, 67, 0.22);
  --hcd-add-mark: rgba(46, 160, 67, 0.38);
  --hcd-add-edge: #2da44e;
  --hcd-del-bg: rgba(248, 81, 73, 0.12);
  --hcd-del-gutter: rgba(248, 81, 73, 0.2);
  --hcd-del-mark: rgba(248, 81, 73, 0.36);
  --hcd-del-edge: #cf222e;
  --hcd-fold-bg: rgba(9, 105, 218, 0.08);

  --hcd-chord: #0550ae;
  --hcd-directive: #8250df;
  --hcd-comment: #6e7781;
}
.hcd-root[data-hcd-theme="dark"] { color-scheme: dark; }
.hcd-root[data-hcd-theme="dark"] {
  --hcd-bg: #0d1117;
  --hcd-fg: #e6edf3;
  --hcd-muted: #8b949e;
  --hcd-border: #30363d;
  --hcd-toolbar-bg: #161b22;
  --hcd-gutter-bg: #161b22;
  --hcd-gutter-fg: #6e7681;
  --hcd-accent: #2f81f7;
  --hcd-add-bg: rgba(46, 160, 67, 0.17);
  --hcd-add-gutter: rgba(46, 160, 67, 0.3);
  --hcd-add-mark: rgba(46, 160, 67, 0.45);
  --hcd-add-edge: #3fb950;
  --hcd-del-bg: rgba(248, 81, 73, 0.16);
  --hcd-del-gutter: rgba(248, 81, 73, 0.28);
  --hcd-del-mark: rgba(248, 81, 73, 0.45);
  --hcd-del-edge: #f85149;
  --hcd-fold-bg: rgba(47, 129, 247, 0.12);
  --hcd-chord: #79c0ff;
  --hcd-directive: #d2a8ff;
  --hcd-comment: #8b949e;
}
@media (prefers-color-scheme: dark) {
  .hcd-root[data-hcd-theme="auto"] {
    color-scheme: dark;
    --hcd-bg: #0d1117;
    --hcd-fg: #e6edf3;
    --hcd-muted: #8b949e;
    --hcd-border: #30363d;
    --hcd-toolbar-bg: #161b22;
    --hcd-gutter-bg: #161b22;
    --hcd-gutter-fg: #6e7681;
    --hcd-accent: #2f81f7;
    --hcd-add-bg: rgba(46, 160, 67, 0.17);
    --hcd-add-gutter: rgba(46, 160, 67, 0.3);
    --hcd-add-mark: rgba(46, 160, 67, 0.45);
    --hcd-add-edge: #3fb950;
    --hcd-del-bg: rgba(248, 81, 73, 0.16);
    --hcd-del-gutter: rgba(248, 81, 73, 0.28);
    --hcd-del-mark: rgba(248, 81, 73, 0.45);
    --hcd-del-edge: #f85149;
    --hcd-fold-bg: rgba(47, 129, 247, 0.12);
    --hcd-chord: #79c0ff;
    --hcd-directive: #d2a8ff;
    --hcd-comment: #8b949e;
  }
}

.hcd-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--hcd-bg);
  color: var(--hcd-fg);
  font-family: var(--hcd-font);
  font-size: var(--hcd-font-size);
  outline: none;
  box-sizing: border-box;
}
.hcd-root *, .hcd-root *::before, .hcd-root *::after { box-sizing: border-box; }

/* ---- toolbar ---- */
.hcd-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 14px;
  padding: 8px 12px;
  background: var(--hcd-toolbar-bg);
  border-bottom: 1px solid var(--hcd-border);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
}
.hcd-toolbar-start, .hcd-toolbar-end {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  min-width: 0;
}
.hcd-title { font-weight: 600; }
.hcd-muted { color: var(--hcd-muted); }
.hcd-stat { font-family: var(--hcd-font); font-weight: 600; font-size: 12px; }
.hcd-stat-add { color: var(--hcd-add-edge); }
.hcd-stat-del { color: var(--hcd-del-edge); }
.hcd-nav { display: inline-flex; align-items: center; gap: 2px; }
.hcd-counter { min-width: 4.5em; text-align: center; color: var(--hcd-muted); font-variant-numeric: tabular-nums; font-size: 12px; }

.hcd-root button { font: inherit; color: inherit; cursor: pointer; }
.hcd-root button:disabled { cursor: not-allowed; opacity: 0.5; }
.hcd-root button:focus-visible { outline: 2px solid var(--hcd-accent); outline-offset: 1px; }

.hcd-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0;
  border: 0; border-radius: 6px; background: transparent; color: var(--hcd-muted);
}
.hcd-icon:hover:not(:disabled) { background: var(--hcd-hover); color: var(--hcd-fg); }
.hcd-icon.hcd-on { background: var(--hcd-hover); color: var(--hcd-accent); }
.hcd-seg { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--hcd-border); border-radius: 8px; }

.hcd-link { border: 0; background: transparent; padding: 4px 6px; color: var(--hcd-accent); font-size: 12px; border-radius: 6px; }
.hcd-link:hover:not(:disabled) { background: var(--hcd-hover); }

.hcd-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 12px; border-radius: 8px;
  border: 1px solid var(--hcd-border); background: transparent; font-weight: 500;
}
.hcd-btn:hover:not(:disabled) { background: var(--hcd-hover); }
.hcd-btn-primary { background: var(--hcd-accent); border-color: var(--hcd-accent); color: var(--hcd-accent-fg); }
.hcd-btn-primary:hover:not(:disabled) { background: var(--hcd-accent); filter: brightness(1.1); }

/* ---- body ---- */
.hcd-colheads {
  display: grid; grid-template-columns: 1fr 1fr;
  padding: 0 12px; background: var(--hcd-gutter-bg); border-bottom: 1px solid var(--hcd-border);
  font-family: system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--hcd-muted);
}
.hcd-colheads > span { padding: 5px 4px; }
.hcd-body { position: relative; display: flex; flex: 1; min-height: 0; }
.hcd-scroll { position: relative; flex: 1; min-width: 0; overflow: auto; overscroll-behavior: contain; }
.hcd-empty-state { padding: 32px 16px; text-align: center; color: var(--hcd-muted); font-family: system-ui, sans-serif; }

.hcd-row, .hcd-srow { position: relative; min-width: 0; }
.hcd-row { display: grid; grid-template-columns: var(--hcd-no-w) var(--hcd-no-w) 1.5em minmax(0, 1fr); }
.hcd-srow { display: grid; grid-template-columns: var(--hcd-no-w) minmax(0, 1fr) var(--hcd-no-w) minmax(0, 1fr); }

.hcd-no, .hcd-sign {
  user-select: none; text-align: right; padding: 0 8px 0 4px;
  color: var(--hcd-gutter-fg); background: var(--hcd-gutter-bg);
  font-variant-numeric: tabular-nums; line-height: 1.6;
}
.hcd-sign { text-align: center; padding: 0; background: transparent; font-weight: 700; }
.hcd-code {
  position: relative; white-space: pre-wrap; overflow-wrap: anywhere;
  padding: 0 14px 0 6px; line-height: 1.6; min-width: 0;
}

.hcd-row.hcd-insert .hcd-no { background: var(--hcd-add-gutter); }
.hcd-row.hcd-delete .hcd-no { background: var(--hcd-del-gutter); }
.hcd-row.hcd-insert { background: var(--hcd-add-bg); }
.hcd-row.hcd-delete { background: var(--hcd-del-bg); }
.hcd-row.hcd-insert .hcd-sign { color: var(--hcd-add-edge); }
.hcd-row.hcd-delete .hcd-sign { color: var(--hcd-del-edge); }
.hcd-cell.hcd-insert { background: var(--hcd-add-bg); }
.hcd-cell.hcd-delete { background: var(--hcd-del-bg); }
.hcd-cell.hcd-no.hcd-insert { background: var(--hcd-add-gutter); }
.hcd-cell.hcd-no.hcd-delete { background: var(--hcd-del-gutter); }
.hcd-cell.hcd-blank {
  background: repeating-linear-gradient(135deg, transparent 0 5px, var(--hcd-hover) 5px 6px);
}
.hcd-cell-r { border-left: 1px solid var(--hcd-border); }
.hcd-cell-l.hcd-code { border-right: 0; }

.hcd-insert .hcd-mark { background: var(--hcd-add-mark); border-radius: 3px; }
.hcd-delete .hcd-mark { background: var(--hcd-del-mark); border-radius: 3px; }

.hcd-row.hcd-active .hcd-no:first-child,
.hcd-cell-l.hcd-no.hcd-active { box-shadow: inset 3px 0 0 var(--hcd-accent); }
.hcd-row[data-hunk]:hover, .hcd-srow[data-hunk]:hover { filter: brightness(0.98); }

/* undone hunks: the proposal side is dimmed, the original is "restored" */
.hcd-rejected.hcd-insert .hcd-code, .hcd-rejected.hcd-insert .hcd-sign,
.hcd-cell.hcd-rejected.hcd-insert.hcd-code { opacity: 0.45; text-decoration: line-through; }
.hcd-rejected.hcd-insert .hcd-mark { background: transparent; }
.hcd-row.hcd-rejected.hcd-delete, .hcd-cell.hcd-rejected.hcd-delete { background: var(--hcd-add-bg); }
.hcd-row.hcd-rejected.hcd-delete .hcd-no, .hcd-cell.hcd-no.hcd-rejected.hcd-delete { background: var(--hcd-add-gutter); }
.hcd-row.hcd-rejected.hcd-delete .hcd-sign { color: var(--hcd-add-edge); }

/* syntax */
.hcd-s-chord { color: var(--hcd-chord); font-weight: 600; }
.hcd-s-directive { color: var(--hcd-directive); }
.hcd-s-comment { color: var(--hcd-comment); font-style: italic; }

/* folds */
.hcd-fold {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 3px 12px 3px calc(var(--hcd-no-w) + 12px);
  border: 0; border-top: 1px solid var(--hcd-border); border-bottom: 1px solid var(--hcd-border);
  background: var(--hcd-fold-bg); color: var(--hcd-accent); text-align: left;
  font-family: system-ui, sans-serif; font-size: 12px;
}
.hcd-fold:hover { filter: brightness(0.96); }
.hcd-fold-split { padding-left: 12px; }

/* per-hunk actions */
.hcd-hunkbar {
  position: absolute; top: 1px; right: 10px; z-index: 3;
  display: flex; gap: 4px; padding: 2px;
  background: var(--hcd-toolbar-bg); border: 1px solid var(--hcd-border);
  border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  opacity: 0; pointer-events: none; transition: opacity 120ms ease;
  font-family: system-ui, sans-serif; font-size: 12px; line-height: 1;
}
.hcd-hunkbar-on, .hcd-hunkbar:focus-within { opacity: 1; pointer-events: auto; }
.hcd-chip {
  display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px;
  border: 0; border-radius: 6px; background: transparent; font-weight: 500;
}
.hcd-chip:hover:not(:disabled) { background: var(--hcd-hover); }
.hcd-chip-primary { background: var(--hcd-accent); color: var(--hcd-accent-fg); }
.hcd-chip-primary:hover:not(:disabled) { background: var(--hcd-accent); filter: brightness(1.1); }

/* overview ruler */
.hcd-ruler {
  position: relative; flex: none; width: 12px;
  background: var(--hcd-gutter-bg); border-left: 1px solid var(--hcd-border);
}
.hcd-ruler button {
  position: absolute; left: 2px; right: 2px; height: 5px; min-height: 5px;
  padding: 0; border: 0; border-radius: 2px; opacity: 0.75;
}
.hcd-ruler button:hover, .hcd-ruler .hcd-mark-active { opacity: 1; transform: scaleX(1.25); }
.hcd-ruler .hcd-mark-ins { background: var(--hcd-add-edge); }
.hcd-ruler .hcd-mark-del { background: var(--hcd-del-edge); }
.hcd-ruler .hcd-mark-mix { background: var(--hcd-accent); }
`;

export function ensureDiffStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ELEMENT_ID;
  style.textContent = DIFF_CSS;
  document.head.appendChild(style);
}
