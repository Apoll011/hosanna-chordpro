/**
 * Dependency-free diff engine for ChordPro sources.
 *
 * - Line diff (Myers O(ND)) with common prefix/suffix trimming.
 * - Intra-line diff that treats `[chords]` as atomic tokens.
 * - Hunk model with per-hunk accept/reject and source re-assembly.
 */

/* -------------------------------------------------------------------------- */
/* Generic sequence diff (Myers)                                               */
/* -------------------------------------------------------------------------- */

export type DiffOpType = "equal" | "delete" | "insert";

export interface SequenceOp {
  type: DiffOpType;
  /** Index in `a` (-1 for inserts). */
  aIndex: number;
  /** Index in `b` (-1 for deletes). */
  bIndex: number;
}

/** Above this edit distance we stop searching and fall back to replace-all. */
const MAX_EDIT_DISTANCE = 2500;

/**
 * Minimal edit script between two sequences. Equal runs are kept, everything
 * else is expressed as deletes (from `a`) and inserts (into `b`).
 */
export function diffSequences<T>(
  a: readonly T[],
  b: readonly T[],
  eq: (x: T, y: T) => boolean = (x, y) => x === y,
): SequenceOp[] {
  const n = a.length;
  const m = b.length;

  let prefix = 0;
  while (prefix < n && prefix < m && eq(a[prefix], b[prefix])) prefix++;
  let suffix = 0;
  while (
    suffix < n - prefix &&
    suffix < m - prefix &&
    eq(a[n - 1 - suffix], b[m - 1 - suffix])
  ) {
    suffix++;
  }

  const ops: SequenceOp[] = [];
  for (let i = 0; i < prefix; i++) {
    ops.push({ type: "equal", aIndex: i, bIndex: i });
  }

  const aMid = a.slice(prefix, n - suffix);
  const bMid = b.slice(prefix, m - suffix);
  for (const op of myers(aMid, bMid, eq)) {
    ops.push({
      type: op.type,
      aIndex: op.aIndex < 0 ? -1 : op.aIndex + prefix,
      bIndex: op.bIndex < 0 ? -1 : op.bIndex + prefix,
    });
  }

  for (let i = 0; i < suffix; i++) {
    ops.push({
      type: "equal",
      aIndex: n - suffix + i,
      bIndex: m - suffix + i,
    });
  }
  return ops;
}

function replaceAll(n: number, m: number): SequenceOp[] {
  const ops: SequenceOp[] = [];
  for (let i = 0; i < n; i++) ops.push({ type: "delete", aIndex: i, bIndex: -1 });
  for (let j = 0; j < m; j++) ops.push({ type: "insert", aIndex: -1, bIndex: j });
  return ops;
}

function myers<T>(
  a: readonly T[],
  b: readonly T[],
  eq: (x: T, y: T) => boolean,
): SequenceOp[] {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  if (n === 0 || m === 0) return replaceAll(n, m);

  const max = Math.min(n + m, MAX_EDIT_DISTANCE);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];

  let found = false;
  let finalD = 0;
  outer: for (let d = 0; d <= max; d++) {
    // Only the window [-d-1, d+1] is ever read back (keeps memory O(D²)).
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && eq(a[x], b[y])) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        finalD = d;
        break outer;
      }
    }
  }
  if (!found) return replaceAll(n, m);

  // Backtrack.
  const reversed: SequenceOp[] = [];
  let x = n;
  let y = m;
  for (let d = finalD; d > 0; d--) {
    const vd = trace[d];
    const at = (kk: number) => vd[kk + d + 1];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && at(k - 1) < at(k + 1))) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
      reversed.push({ type: "equal", aIndex: x, bIndex: y });
    }
    if (x === prevX) {
      y--;
      reversed.push({ type: "insert", aIndex: -1, bIndex: y });
    } else {
      x--;
      reversed.push({ type: "delete", aIndex: x, bIndex: -1 });
    }
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    reversed.push({ type: "equal", aIndex: x, bIndex: y });
  }
  return reversed.reverse();
}

/* -------------------------------------------------------------------------- */
/* Line model                                                                  */
/* -------------------------------------------------------------------------- */

export type DiffLineType = "equal" | "delete" | "insert";

export interface DiffLine {
  type: DiffLineType;
  /** 1-based line number in the original (undefined for inserts). */
  oldNo?: number;
  /** 1-based line number in the modified text (undefined for deletes). */
  newNo?: number;
  text: string;
  /** Hunk id for changed lines, -1 for unchanged lines. */
  hunk: number;
  /** Changed character ranges inside `text` (intra-line highlight). */
  ranges?: Array<[number, number]>;
}

export interface DiffHunk {
  id: number;
  /** Index of the first line of this hunk inside `DiffResult.lines`. */
  start: number;
  /** One past the last line of this hunk inside `DiffResult.lines`. */
  end: number;
  added: number;
  removed: number;
  oldStart: number;
  newStart: number;
}

export interface DiffStats {
  added: number;
  removed: number;
  /** Number of hunks. */
  changes: number;
}

export interface DiffResult {
  lines: DiffLine[];
  hunks: DiffHunk[];
  stats: DiffStats;
  identical: boolean;
  /** Normalised sources the diff was computed from. */
  originalText: string;
  modifiedText: string;
}

/** Split into lines, normalising CRLF and dropping one trailing newline. */
export function splitLines(text: string): string[] {
  const normalised = text.replace(/\r\n?/g, "\n");
  const body = normalised.endsWith("\n") ? normalised.slice(0, -1) : normalised;
  return body === "" && normalised === "" ? [] : body.split("\n");
}

/* -------------------------------------------------------------------------- */
/* Intra-line (word) diff                                                      */
/* -------------------------------------------------------------------------- */

const TOKEN_RE = /\[[^\]\n]*\]|\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

export function tokenizeLine(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

export interface WordDiff {
  oldRanges: Array<[number, number]>;
  newRanges: Array<[number, number]>;
  /** 0..1 — share of the longer line that is unchanged. */
  similarity: number;
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [s, e] of ranges) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

export function wordDiff(oldText: string, newText: string): WordDiff {
  const a = tokenizeLine(oldText);
  const b = tokenizeLine(newText);
  const ops = diffSequences(a, b);

  const aStarts: number[] = [];
  let pos = 0;
  for (const t of a) {
    aStarts.push(pos);
    pos += t.length;
  }
  const bStarts: number[] = [];
  pos = 0;
  for (const t of b) {
    bStarts.push(pos);
    pos += t.length;
  }

  const oldRanges: Array<[number, number]> = [];
  const newRanges: Array<[number, number]> = [];
  let equalChars = 0;
  for (const op of ops) {
    if (op.type === "equal") {
      equalChars += a[op.aIndex].length;
    } else if (op.type === "delete") {
      const s = aStarts[op.aIndex];
      oldRanges.push([s, s + a[op.aIndex].length]);
    } else {
      const s = bStarts[op.bIndex];
      newRanges.push([s, s + b[op.bIndex].length]);
    }
  }
  const longest = Math.max(oldText.length, newText.length) || 1;
  return {
    oldRanges: mergeRanges(oldRanges),
    newRanges: mergeRanges(newRanges),
    similarity: equalChars / longest,
  };
}

/** Below this similarity a paired line is just "replaced", no word marks. */
const WORD_DIFF_MIN_SIMILARITY = 0.35;

/* -------------------------------------------------------------------------- */
/* Main entry                                                                  */
/* -------------------------------------------------------------------------- */

export function computeDiff(original: string, modified: string): DiffResult {
  const a = splitLines(original);
  const b = splitLines(modified);
  const ops = diffSequences(a, b);

  const lines: DiffLine[] = [];
  const hunks: DiffHunk[] = [];
  const stats: DiffStats = { added: 0, removed: 0, changes: 0 };

  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === "equal") {
      lines.push({
        type: "equal",
        oldNo: op.aIndex + 1,
        newNo: op.bIndex + 1,
        text: a[op.aIndex],
        hunk: -1,
      });
      i++;
      continue;
    }

    // Collect a contiguous change block (deletes first, then inserts).
    let j = i;
    const dels: SequenceOp[] = [];
    const ins: SequenceOp[] = [];
    while (j < ops.length && ops[j].type !== "equal") {
      (ops[j].type === "delete" ? dels : ins).push(ops[j]);
      j++;
    }

    const hunkId = hunks.length;
    const start = lines.length;
    const delLines: DiffLine[] = dels.map((d) => ({
      type: "delete",
      oldNo: d.aIndex + 1,
      text: a[d.aIndex],
      hunk: hunkId,
    }));
    const insLines: DiffLine[] = ins.map((d) => ({
      type: "insert",
      newNo: d.bIndex + 1,
      text: b[d.bIndex],
      hunk: hunkId,
    }));

    const pairs = Math.min(delLines.length, insLines.length);
    for (let k = 0; k < pairs; k++) {
      const wd = wordDiff(delLines[k].text, insLines[k].text);
      if (wd.similarity >= WORD_DIFF_MIN_SIMILARITY) {
        if (wd.oldRanges.length) delLines[k].ranges = wd.oldRanges;
        if (wd.newRanges.length) insLines[k].ranges = wd.newRanges;
      }
    }

    lines.push(...delLines, ...insLines);
    hunks.push({
      id: hunkId,
      start,
      end: lines.length,
      added: insLines.length,
      removed: delLines.length,
      oldStart: dels.length ? dels[0].aIndex + 1 : (ops[i - 1]?.aIndex ?? -1) + 2,
      newStart: ins.length ? ins[0].bIndex + 1 : (ops[i - 1]?.bIndex ?? -1) + 2,
    });
    stats.added += insLines.length;
    stats.removed += delLines.length;
    i = j;
  }

  stats.changes = hunks.length;
  return {
    lines,
    hunks,
    stats,
    identical: hunks.length === 0,
    originalText: original,
    modifiedText: modified,
  };
}

/**
 * Re-assemble the source keeping every hunk except the rejected ones.
 * With no rejections this is exactly `modified`; with all rejected, exactly
 * `original`.
 */
export function resolveHunks(
  diff: DiffResult,
  rejected: ReadonlySet<number> | readonly number[] = [],
): string {
  const rejectedSet =
    rejected instanceof Set ? rejected : new Set(rejected as readonly number[]);
  if (rejectedSet.size === 0) return diff.modifiedText;
  if (diff.hunks.length > 0 && rejectedSet.size >= diff.hunks.length) {
    let all = true;
    for (const h of diff.hunks) if (!rejectedSet.has(h.id)) all = false;
    if (all) return diff.originalText;
  }

  const out: string[] = [];
  for (const line of diff.lines) {
    if (line.type === "equal") out.push(line.text);
    else if (line.type === "delete" && rejectedSet.has(line.hunk))
      out.push(line.text);
    else if (line.type === "insert" && !rejectedSet.has(line.hunk))
      out.push(line.text);
  }
  const joined = out.join("\n");
  return diff.modifiedText.replace(/\r\n?/g, "\n").endsWith("\n")
    ? `${joined}\n`
    : joined;
}

/* -------------------------------------------------------------------------- */
/* Display helpers                                                             */
/* -------------------------------------------------------------------------- */

export interface FoldItem {
  kind: "fold";
  /** Stable id (index of first folded line). */
  id: number;
  lines: DiffLine[];
}
export interface LineItem {
  kind: "line";
  line: DiffLine;
  /** True for the first line of a hunk (hosts the hunk action bar). */
  hunkStart: boolean;
}
export type DiffItem = FoldItem | LineItem;

/**
 * Collapse long runs of unchanged lines (keeping `context` lines around every
 * hunk), unless their fold id is listed in `expanded`.
 */
export function buildItems(
  diff: DiffResult,
  context: number,
  expanded: ReadonlySet<number> = new Set(),
): DiffItem[] {
  const { lines, hunks } = diff;
  const hunkStarts = new Set(hunks.map((h) => h.start));
  const items: DiffItem[] = [];

  let i = 0;
  while (i < lines.length) {
    if (lines[i].type !== "equal") {
      items.push({ kind: "line", line: lines[i], hunkStart: hunkStarts.has(i) });
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j].type === "equal") j++;
    const run = lines.slice(i, j);
    const isFirst = i === 0;
    const isLast = j === lines.length;
    const head = isFirst ? 0 : context;
    const tail = isLast ? 0 : context;
    const foldable = run.length - head - tail;

    if (foldable > 1 && !expanded.has(i + head)) {
      run.slice(0, head).forEach((line) =>
        items.push({ kind: "line", line, hunkStart: false }),
      );
      items.push({
        kind: "fold",
        id: i + head,
        lines: run.slice(head, run.length - tail),
      });
      run.slice(run.length - tail).forEach((line) =>
        items.push({ kind: "line", line, hunkStart: false }),
      );
    } else {
      run.forEach((line) => items.push({ kind: "line", line, hunkStart: false }));
    }
    i = j;
  }
  return items;
}

export interface SplitRow {
  left?: DiffLine;
  right?: DiffLine;
  hunk: number;
  hunkStart: boolean;
}
export type SplitItem = FoldItem | ({ kind: "row" } & SplitRow);

/** Align deletes (left) with inserts (right) for side-by-side display. */
export function buildSplitItems(items: DiffItem[]): SplitItem[] {
  const out: SplitItem[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.kind === "fold") {
      out.push(item);
      i++;
      continue;
    }
    if (item.line.type === "equal") {
      out.push({
        kind: "row",
        left: item.line,
        right: item.line,
        hunk: -1,
        hunkStart: false,
      });
      i++;
      continue;
    }
    const hunk = item.line.hunk;
    const dels: DiffLine[] = [];
    const ins: DiffLine[] = [];
    let j = i;
    while (j < items.length) {
      const it = items[j];
      if (it.kind !== "line" || it.line.hunk !== hunk) break;
      (it.line.type === "delete" ? dels : ins).push(it.line);
      j++;
    }
    const rows = Math.max(dels.length, ins.length);
    for (let r = 0; r < rows; r++) {
      out.push({
        kind: "row",
        left: dels[r],
        right: ins[r],
        hunk,
        hunkStart: r === 0,
      });
    }
    i = j;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* ChordPro syntax segments                                                    */
/* -------------------------------------------------------------------------- */

export type SyntaxKind = "chord" | "directive" | "comment" | "text";

export interface LineSegment {
  text: string;
  syntax: SyntaxKind;
  changed: boolean;
}

const SYNTAX_RE = /\[[^\]]*\]|\{[^}]*\}/g;

/**
 * Split a line into segments by ChordPro syntax and intra-line change ranges.
 */
export function segmentLine(
  text: string,
  ranges: ReadonlyArray<readonly [number, number]> = [],
): LineSegment[] {
  if (text === "") return [];
  const isComment = /^\s*#/.test(text);

  const spans: Array<{ s: number; e: number; kind: SyntaxKind }> = [];
  if (isComment) {
    spans.push({ s: 0, e: text.length, kind: "comment" });
  } else {
    for (const m of text.matchAll(SYNTAX_RE)) {
      const s = m.index ?? 0;
      spans.push({
        s,
        e: s + m[0].length,
        kind: m[0].startsWith("[") ? "chord" : "directive",
      });
    }
  }

  const cuts = new Set<number>([0, text.length]);
  for (const sp of spans) {
    cuts.add(sp.s);
    cuts.add(sp.e);
  }
  for (const [s, e] of ranges) {
    cuts.add(Math.max(0, s));
    cuts.add(Math.min(text.length, e));
  }
  const points = [...cuts].sort((x, y) => x - y);

  const segments: LineSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i];
    const e = points[i + 1];
    if (e <= s) continue;
    const span = spans.find((sp) => s >= sp.s && e <= sp.e);
    segments.push({
      text: text.slice(s, e),
      syntax: span?.kind ?? "text",
      changed: ranges.some(([rs, re]) => s >= rs && e <= re),
    });
  }
  return segments;
}
