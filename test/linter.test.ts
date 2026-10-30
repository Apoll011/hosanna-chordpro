import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lintChordPro } from "../src/parser/linter";

describe("ChordPro linter", () => {
  it("reports malformed brackets and timing", () => {
    const diagnostics = lintChordPro("[C Lyrics\n[G@bad]text");
    assert.ok(diagnostics.some((d) => d.code === "unclosed-bracket"));
    assert.ok(diagnostics.some((d) => d.code === "malformed-timing"));
  });

  it("reports structural block errors", () => {
    const diagnostics = lintChordPro("{end_of_verse}\n{start_of_chorus}\ntext");
    assert.ok(diagnostics.some((d) => d.code === "unmatched-block-end"));
    assert.ok(diagnostics.some((d) => d.code.includes("unclosed")));
  });

  it("accepts valid annotations and chords", () => {
    const diagnostics = lintChordPro(
      "{start_of_verse}\n[Cmaj7@2x]Hello\n{end_of_verse}",
    );
    assert.equal(diagnostics.length, 0);
  });
});

describe("ChordPro linter — chorus recall / tags", () => {
  it("warns when {chorus} has no previous chorus", () => {
    const d = lintChordPro("{start_of_verse}\nHi\n{end_of_verse}\n{chorus}");
    assert.ok(d.some((x) => x.code === "chorus-recall-without-chorus"));
  });

  it("accepts {chorus} after a chorus block", () => {
    const d = lintChordPro(
      "{start_of_chorus}\n[G]Hi\n{end_of_chorus}\n{chorus}",
    );
    assert.equal(d.length, 0);
  });

  it("warns on empty key_note / tag", () => {
    const d = lintChordPro("{key_note}\n{tag: }\n{key_note: D}");
    assert.equal(
      d.filter((x) => x.code === "empty-directive-value").length,
      2,
    );
  });
});
