import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildItems,
  buildSplitItems,
  computeDiff,
  diffSequences,
  resolveHunks,
  segmentLine,
  splitLines,
  wordDiff,
} from "../src/diff/diff";

const song = (body: string) => `{title: T}\n${body}\n{end}\n`;

describe("diffSequences", () => {
  it("returns only equals for identical input", () => {
    const ops = diffSequences(["a", "b"], ["a", "b"]);
    assert.ok(ops.every((o) => o.type === "equal"));
  });

  it("produces a minimal script and reconstructs b from a", () => {
    const a = "the quick brown fox jumps".split(" ");
    const b = "the slow brown dog jumps high".split(" ");
    const ops = diffSequences(a, b);
    const rebuilt = ops
      .filter((o) => o.type !== "delete")
      .map((o) => b[o.bIndex]);
    assert.deepEqual(rebuilt, b);
    const kept = ops.filter((o) => o.type === "delete" || o.type === "equal");
    assert.deepEqual(
      kept.map((o) => a[o.aIndex]),
      a,
    );
    const edits = ops.filter((o) => o.type !== "equal").length;
    assert.equal(edits, 5); // -quick -fox +slow +dog +high
  });

  it("handles empty sides", () => {
    assert.equal(diffSequences([], []).length, 0);
    assert.deepEqual(
      diffSequences([], ["x"]).map((o) => o.type),
      ["insert"],
    );
    assert.deepEqual(
      diffSequences(["x"], []).map((o) => o.type),
      ["delete"],
    );
  });
});

describe("splitLines", () => {
  it("normalises CRLF and a single trailing newline", () => {
    assert.deepEqual(splitLines("a\r\nb\n"), ["a", "b"]);
    assert.deepEqual(splitLines(""), []);
    assert.deepEqual(splitLines("a"), ["a"]);
  });
});

describe("computeDiff", () => {
  it("reports identical text", () => {
    const r = computeDiff("a\nb\n", "a\nb\n");
    assert.equal(r.identical, true);
    assert.equal(r.stats.changes, 0);
  });

  it("groups changes into hunks with stats", () => {
    const original = song("[C]one\n[G]two\nthree\nfour\nfive\nsix\nseven");
    const modified = song("[D]one\n[G]two\nthree\nfour\nfive\nsix\nseven\neight");
    const r = computeDiff(original, modified);
    assert.equal(r.stats.changes, 2);
    assert.equal(r.stats.added, 2);
    assert.equal(r.stats.removed, 1);
    assert.equal(r.hunks[0].removed, 1);
    assert.equal(r.hunks[0].added, 1);
    assert.equal(r.hunks[1].added, 1);
  });

  it("adds word-level ranges treating chords as atomic", () => {
    const wd = wordDiff("[C]Amazing grace", "[D]Amazing grace");
    assert.deepEqual(wd.oldRanges, [[0, 3]]);
    assert.deepEqual(wd.newRanges, [[0, 3]]);
    assert.ok(wd.similarity > 0.5);

    const r = computeDiff("[C]Amazing grace", "[D]Amazing grace");
    const del = r.lines.find((l) => l.type === "delete");
    assert.deepEqual(del?.ranges, [[0, 3]]);
  });

  it("skips word marks for unrelated lines", () => {
    const r = computeDiff("completely different", "xyz");
    assert.equal(r.lines.find((l) => l.type === "insert")?.ranges, undefined);
  });
});

describe("resolveHunks", () => {
  const original = song("a\nb\nc\nd\ne\nf\ng\nh");
  const modified = song("A\nb\nc\nd\ne\nf\ng\nH");

  it("accepting everything yields the modified text exactly", () => {
    const r = computeDiff(original, modified);
    assert.equal(resolveHunks(r), modified);
    assert.equal(resolveHunks(r, new Set()), modified);
  });

  it("rejecting everything yields the original text exactly", () => {
    const r = computeDiff(original, modified);
    assert.equal(r.hunks.length, 2);
    assert.equal(resolveHunks(r, new Set([0, 1])), original);
  });

  it("can keep one hunk and undo the other", () => {
    const r = computeDiff(original, modified);
    const keepFirst = resolveHunks(r, new Set([1]));
    assert.equal(keepFirst, song("A\nb\nc\nd\ne\nf\ng\nh"));
    const keepSecond = resolveHunks(r, new Set([0]));
    assert.equal(keepSecond, song("a\nb\nc\nd\ne\nf\ng\nH"));
  });

  it("handles pure insertions and deletions", () => {
    const r = computeDiff("a\nb\nc", "a\nc");
    assert.equal(r.stats.removed, 1);
    assert.equal(resolveHunks(r, new Set([0])), "a\nb\nc");
    assert.equal(resolveHunks(r), "a\nc");
  });
});

describe("buildItems / buildSplitItems", () => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i}`);
  const modified = [...lines];
  modified[15] = "CHANGED";

  it("folds long unchanged runs but keeps context", () => {
    const r = computeDiff(lines.join("\n"), modified.join("\n"));
    const items = buildItems(r, 3);
    const folds = items.filter((i) => i.kind === "fold");
    assert.equal(folds.length, 2);
    const shown = items.filter((i) => i.kind === "line");
    // 3 context + del + ins + 3 context
    assert.equal(shown.length, 8);
  });

  it("expands a fold when requested", () => {
    const r = computeDiff(lines.join("\n"), modified.join("\n"));
    const first = buildItems(r, 3).find((i) => i.kind === "fold");
    assert.ok(first && first.kind === "fold");
    const expanded = buildItems(r, 3, new Set([first.id]));
    assert.equal(expanded.filter((i) => i.kind === "fold").length, 1);
  });

  it("aligns deletes with inserts for split view", () => {
    const r = computeDiff("a\nb\nc", "a\nB\nX\nc");
    const rows = buildSplitItems(buildItems(r, 3)).filter(
      (i) => i.kind === "row" && i.hunk >= 0,
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].kind === "row" && rows[0].left?.text, "b");
    assert.equal(rows[0].kind === "row" && rows[0].right?.text, "B");
    assert.equal(rows[1].kind === "row" && rows[1].left, undefined);
    assert.equal(rows[1].kind === "row" && rows[1].right?.text, "X");
  });
});

describe("segmentLine", () => {
  it("tags chords, directives and comments", () => {
    const segs = segmentLine("[Am]Hello {c: x}");
    assert.deepEqual(
      segs.map((s) => [s.text, s.syntax]),
      [
        ["[Am]", "chord"],
        ["Hello ", "text"],
        ["{c: x}", "directive"],
      ],
    );
    assert.equal(segmentLine("# note")[0].syntax, "comment");
  });

  it("marks changed ranges across syntax boundaries", () => {
    const segs = segmentLine("[C]love", [[0, 3]]);
    assert.equal(segs[0].changed, true);
    assert.equal(segs[1].changed, false);
  });
});

describe("fuzz", () => {
  it("round-trips original/modified through resolveHunks", () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const vocab = ["[C]a", "[G]b", "{sot}", "{eot}", "", "love", "grace", "x y"];
    const make = () =>
      Array.from({ length: Math.floor(rand() * 25) }, () =>
        vocab[Math.floor(rand() * vocab.length)],
      );
    for (let n = 0; n < 200; n++) {
      const a = make().join("\n");
      const b = make().join("\n");
      const r = computeDiff(a, b);
      assert.equal(resolveHunks(r), b);
      assert.equal(resolveHunks(r, new Set(r.hunks.map((h) => h.id))), a);
      // Stats must match the edit script.
      assert.equal(
        r.lines.filter((l) => l.type === "insert").length,
        r.stats.added,
      );
    }
  });
});
