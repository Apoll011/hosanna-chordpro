import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns2,
  Rows2,
  Undo2,
  UnfoldVertical,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildItems,
  buildSplitItems,
  computeDiff,
  resolveHunks,
  segmentLine,
  type DiffItem,
  type DiffLine,
  type SplitItem,
} from "./diff";
import { ensureDiffStyles } from "./styles";

export interface ChordProDiffLabels {
  /** Column header for the original side (split view). */
  original: string;
  /** Column header for the proposed side (split view). */
  modified: string;
  /** Toolbar: shown when both sides are identical. */
  noChanges: string;
  /** "{current}" and "{total}" are replaced. */
  changeCounter: string;
  /** "{n}" is replaced. */
  unchangedLines: string;
  previous: string;
  next: string;
  inline: string;
  split: string;
  collapseUnchanged: string;
  showAll: string;
  /** Hunk action: keep this change. */
  keep: string;
  /** Hunk action: revert this change. */
  undo: string;
  keepAll: string;
  undoAll: string;
  /** Primary action when every change is kept. */
  apply: string;
  /** Primary action when some changes were undone. "{kept}" and "{total}". */
  applyPartial: string;
  discard: string;
  /** "{n}" is replaced (aria label for the overview ruler marks). */
  jumpToChange: string;
}

export const DEFAULT_DIFF_LABELS: ChordProDiffLabels = {
  original: "Current",
  modified: "Proposed",
  noChanges: "No differences",
  changeCounter: "{current} of {total}",
  unchangedLines: "{n} unchanged lines",
  previous: "Previous change (Shift+F7)",
  next: "Next change (F7)",
  inline: "Inline",
  split: "Side by side",
  collapseUnchanged: "Collapse unchanged lines",
  showAll: "Show unchanged lines",
  keep: "Keep",
  undo: "Undo",
  keepAll: "Keep all",
  undoAll: "Undo all",
  apply: "Apply changes",
  applyPartial: "Apply {kept} of {total}",
  discard: "Discard",
  jumpToChange: "Go to change {n}",
};

export interface ChordProDiffApplyInfo {
  kept: number;
  undone: number;
  total: number;
}

export interface ChordProDiffEditorProps {
  /** Current content (left / red side). */
  original: string;
  /** Proposed content (right / green side). */
  modified: string;
  /**
   * Called with the final source: the proposal minus every hunk the user
   * undid. When nothing was undone this is exactly `modified`.
   */
  onAccept: (content: string, info: ChordProDiffApplyInfo) => void;
  onReject: () => void;
  /** Heading in the toolbar, e.g. "AI proposal". */
  title?: React.ReactNode;
  /** Extra toolbar content rendered before the actions. */
  toolbarExtra?: React.ReactNode;
  labels?: Partial<ChordProDiffLabels>;
  defaultView?: "inline" | "split";
  /** Unchanged lines kept around every change. Default 3. */
  contextLines?: number;
  fontSize?: number;
  /** "auto" follows `prefers-color-scheme`. Override `--hcd-*` to restyle. */
  theme?: "light" | "dark" | "auto";
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const fill = (tpl: string, vars: Record<string, string | number>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

function CodeText({ line }: { line: DiffLine }) {
  if (line.text === "") return <span className="hcd-empty">{"\u00a0"}</span>;
  return (
    <>
      {segmentLine(line.text, line.ranges).map((seg, i) => (
        <span
          key={i}
          className={`hcd-s-${seg.syntax}${seg.changed ? " hcd-mark" : ""}`}
        >
          {seg.text}
        </span>
      ))}
    </>
  );
}

const SIGN: Record<DiffLine["type"], string> = {
  equal: "",
  insert: "+",
  delete: "−",
};

export function ChordProDiffEditor({
  original,
  modified,
  onAccept,
  onReject,
  title,
  toolbarExtra,
  labels: labelOverrides,
  defaultView = "inline",
  contextLines = 3,
  fontSize = 13,
  theme = "auto",
  autoFocus = false,
  disabled = false,
  className,
  style,
}: ChordProDiffEditorProps) {
  ensureDiffStyles();
  const labels = useMemo(
    () => ({ ...DEFAULT_DIFF_LABELS, ...labelOverrides }),
    [labelOverrides],
  );

  const diff = useMemo(() => computeDiff(original, modified), [original, modified]);

  const [view, setView] = useState<"inline" | "split">(defaultView);
  const [collapse, setCollapse] = useState(true);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [rejected, setRejected] = useState<ReadonlySet<number>>(new Set());
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(-1);
  const [narrow, setNarrow] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset review state whenever a different diff is shown.
  useEffect(() => {
    setRejected(new Set());
    setExpanded(new Set());
    setActive(0);
  }, [diff]);

  useEffect(() => {
    if (autoFocus) rootRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < 720);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effectiveView = narrow ? "inline" : view;

  const items = useMemo(
    () =>
      buildItems(
        diff,
        collapse ? contextLines : Number.MAX_SAFE_INTEGER,
        expanded,
      ),
    [diff, collapse, contextLines, expanded],
  );
  const splitItems = useMemo(
    () => (effectiveView === "split" ? buildSplitItems(items) : []),
    [effectiveView, items],
  );

  const total = diff.hunks.length;
  const undone = rejected.size;
  const kept = total - undone;

  const scrollToHunk = useCallback((id: number, smooth: boolean) => {
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-hunk-start="${id}"]`);
    if (!box || !el) return;
    const top =
      box.scrollTop +
      el.getBoundingClientRect().top -
      box.getBoundingClientRect().top -
      box.clientHeight / 3;
    box.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Land on the first change when a diff appears.
  useEffect(() => {
    if (total > 0) scrollToHunk(0, false);
  }, [diff, total, scrollToHunk]);

  const go = useCallback(
    (delta: number) => {
      if (total === 0) return;
      const next = (active + delta + total) % total;
      setActive(next);
      scrollToHunk(next, true);
    },
    [active, total, scrollToHunk],
  );

  const toggleHunk = useCallback((id: number) => {
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const apply = useCallback(() => {
    if (disabled) return;
    onAccept(resolveHunks(diff, rejected), { kept, undone, total });
  }, [disabled, onAccept, diff, rejected, kept, undone, total]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "F7" || (e.altKey && e.key === "ArrowDown")) {
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
    } else if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      go(-1);
    } else if (mod && e.key === "Enter") {
      e.preventDefault();
      apply();
    } else if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (total > 0) {
        e.preventDefault();
        toggleHunk(active);
      }
    }
  };

  const expandFold = (id: number) =>
    setExpanded((prev) => new Set(prev).add(id));

  /* ------------------------------ renderers ------------------------------ */

  const hunkBar = (id: number) => {
    const isRejected = rejected.has(id);
    const visible = id === active || id === hover;
    return (
      <div
        className={`hcd-hunkbar${visible ? " hcd-hunkbar-on" : ""}`}
        role="group"
        aria-label={fill(labels.jumpToChange, { n: id + 1 })}
      >
        <button
          type="button"
          className={`hcd-chip${isRejected ? " hcd-chip-primary" : ""}`}
          onClick={() => toggleHunk(id)}
          disabled={disabled}
          tabIndex={visible ? 0 : -1}
        >
          {isRejected ? <Check size={13} /> : <Undo2 size={13} />}
          {isRejected ? labels.keep : labels.undo}
        </button>
      </div>
    );
  };

  const rowProps = (hunk: number) => ({
    "data-hunk": hunk >= 0 ? hunk : undefined,
    onMouseEnter: hunk >= 0 ? () => setHover(hunk) : undefined,
    onMouseLeave: hunk >= 0 ? () => setHover(-1) : undefined,
    onClick: hunk >= 0 ? () => setActive(hunk) : undefined,
  });

  const renderInline = (item: DiffItem, idx: number) => {
    if (item.kind === "fold") {
      return (
        <button
          key={`f${item.id}`}
          type="button"
          className="hcd-fold"
          onClick={() => expandFold(item.id)}
        >
          <ChevronsUpDown size={14} />
          {fill(labels.unchangedLines, { n: item.lines.length })}
        </button>
      );
    }
    const { line, hunkStart } = item;
    const isRejected = line.hunk >= 0 && rejected.has(line.hunk);
    return (
      <div
        key={`l${idx}`}
        className={[
          "hcd-row",
          `hcd-${line.type}`,
          isRejected ? "hcd-rejected" : "",
          line.hunk === active ? "hcd-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-hunk-start={hunkStart ? line.hunk : undefined}
        {...rowProps(line.hunk)}
      >
        <span className="hcd-no">{line.oldNo ?? ""}</span>
        <span className="hcd-no">{line.newNo ?? ""}</span>
        <span className="hcd-sign" aria-hidden>
          {SIGN[line.type]}
        </span>
        <span className="hcd-code">
          <CodeText line={line} />
        </span>
        {hunkStart && hunkBar(line.hunk)}
      </div>
    );
  };

  const renderSplit = (item: SplitItem, idx: number) => {
    if (item.kind === "fold") {
      return (
        <button
          key={`f${item.id}`}
          type="button"
          className="hcd-fold hcd-fold-split"
          onClick={() => expandFold(item.id)}
        >
          <ChevronsUpDown size={14} />
          {fill(labels.unchangedLines, { n: item.lines.length })}
        </button>
      );
    }
    const { left, right, hunk, hunkStart } = item;
    const isRejected = hunk >= 0 && rejected.has(hunk);
    const cls = (l: DiffLine | undefined, side: "l" | "r") =>
      `hcd-cell hcd-cell-${side} ${
        l ? `hcd-${l.type}` : "hcd-blank"
      }${isRejected ? " hcd-rejected" : ""}${hunk === active ? " hcd-active" : ""}`;
    return (
      <div
        key={`r${idx}`}
        className="hcd-srow"
        data-hunk-start={hunkStart ? hunk : undefined}
        {...rowProps(hunk)}
      >
        <span className={`${cls(left, "l")} hcd-no`}>{left?.oldNo ?? ""}</span>
        <span className={`${cls(left, "l")} hcd-code`}>
          {left && <CodeText line={left} />}
        </span>
        <span className={`${cls(right, "r")} hcd-no`}>{right?.newNo ?? ""}</span>
        <span className={`${cls(right, "r")} hcd-code`}>
          {right && <CodeText line={right} />}
          {hunkStart && hunkBar(hunk)}
        </span>
      </div>
    );
  };

  /* --------------------------- overview ruler ---------------------------- */

  const ruler = useMemo(() => {
    const list: Array<DiffItem | SplitItem> =
      effectiveView === "split" ? splitItems : items;
    const count = list.length || 1;
    const marks: Array<{ id: number; pos: number; type: "ins" | "del" | "mix" }> = [];
    const seen = new Set<number>();
    list.forEach((it, i) => {
      let id = -1;
      let type: "ins" | "del" | "mix" = "mix";
      if (it.kind === "line") {
        id = it.line.hunk;
        type = it.line.type === "insert" ? "ins" : "del";
      } else if (it.kind === "row") {
        id = it.hunk;
        type = it.left && it.right ? "mix" : it.left ? "del" : "ins";
      }
      if (id >= 0 && !seen.has(id)) {
        seen.add(id);
        marks.push({ id, pos: (i / count) * 100, type });
      }
    });
    return marks;
  }, [effectiveView, items, splitItems]);

  /* -------------------------------- render ------------------------------- */

  const rootClass = ["hcd-root", className].filter(Boolean).join(" ");
  const primaryLabel =
    undone === 0
      ? labels.apply
      : fill(labels.applyPartial, { kept, total });

  return (
    <div
      ref={rootRef}
      className={rootClass}
      data-hcd-theme={theme}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ ["--hcd-font-size" as string]: `${fontSize}px`, ...style }}
    >
      <div className="hcd-toolbar">
        <div className="hcd-toolbar-start">
          {title && <span className="hcd-title">{title}</span>}
          {total === 0 ? (
            <span className="hcd-muted">{labels.noChanges}</span>
          ) : (
            <>
              <span className="hcd-stat hcd-stat-add">+{diff.stats.added}</span>
              <span className="hcd-stat hcd-stat-del">−{diff.stats.removed}</span>
              <span className="hcd-nav">
                <button
                  type="button"
                  className="hcd-icon"
                  title={labels.previous}
                  aria-label={labels.previous}
                  onClick={() => go(-1)}
                >
                  <ChevronUp size={16} />
                </button>
                <span className="hcd-counter" aria-live="polite">
                  {fill(labels.changeCounter, {
                    current: active + 1,
                    total,
                  })}
                </span>
                <button
                  type="button"
                  className="hcd-icon"
                  title={labels.next}
                  aria-label={labels.next}
                  onClick={() => go(1)}
                >
                  <ChevronDown size={16} />
                </button>
              </span>
            </>
          )}
        </div>

        <div className="hcd-toolbar-end">
          {toolbarExtra}
          {total > 1 && (
            <button
              type="button"
              className="hcd-link"
              disabled={disabled}
              onClick={() =>
                setRejected(
                  undone === 0
                    ? new Set(diff.hunks.map((h) => h.id))
                    : new Set(),
                )
              }
            >
              {undone === 0 ? labels.undoAll : labels.keepAll}
            </button>
          )}
          <span className="hcd-seg" role="group">
            {!narrow && (
              <>
                <button
                  type="button"
                  className={`hcd-icon${effectiveView === "inline" ? " hcd-on" : ""}`}
                  title={labels.inline}
                  aria-label={labels.inline}
                  aria-pressed={effectiveView === "inline"}
                  onClick={() => setView("inline")}
                >
                  <Rows2 size={16} />
                </button>
                <button
                  type="button"
                  className={`hcd-icon${effectiveView === "split" ? " hcd-on" : ""}`}
                  title={labels.split}
                  aria-label={labels.split}
                  aria-pressed={effectiveView === "split"}
                  onClick={() => setView("split")}
                >
                  <Columns2 size={16} />
                </button>
              </>
            )}
            <button
              type="button"
              className={`hcd-icon${collapse ? " hcd-on" : ""}`}
              title={collapse ? labels.showAll : labels.collapseUnchanged}
              aria-label={collapse ? labels.showAll : labels.collapseUnchanged}
              aria-pressed={collapse}
              onClick={() => setCollapse((c) => !c)}
            >
              <UnfoldVertical size={16} />
            </button>
          </span>
          <button
            type="button"
            className="hcd-btn"
            onClick={onReject}
            disabled={disabled}
          >
            <X size={15} />
            {labels.discard}
          </button>
          <button
            type="button"
            className="hcd-btn hcd-btn-primary"
            onClick={apply}
            disabled={disabled || total === 0 || kept === 0}
          >
            <Check size={15} />
            {primaryLabel}
          </button>
        </div>
      </div>

      {effectiveView === "split" && (
        <div className="hcd-colheads">
          <span>{labels.original}</span>
          <span>{labels.modified}</span>
        </div>
      )}

      <div className="hcd-body">
        <div
          ref={scrollRef}
          className={`hcd-scroll${effectiveView === "split" ? " hcd-is-split" : ""}`}
        >
          {total === 0 && <div className="hcd-empty-state">{labels.noChanges}</div>}
          {effectiveView === "split"
            ? splitItems.map(renderSplit)
            : items.map(renderInline)}
        </div>
        {ruler.length > 0 && (
          <div className="hcd-ruler" aria-hidden={false}>
            {ruler.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`hcd-mark-${m.type}${m.id === active ? " hcd-mark-active" : ""}`}
                style={{ top: `${m.pos}%` }}
                aria-label={fill(labels.jumpToChange, { n: m.id + 1 })}
                onClick={() => {
                  setActive(m.id);
                  scrollToHunk(m.id, true);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChordProDiffEditor;
