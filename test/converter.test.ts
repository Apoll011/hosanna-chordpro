import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertToChordProDetailed,
  detectSourceFormat,
  slugifyTitle,
  toChordPro,
} from "../src/parser/txt-to-chordpro";

describe("text-to-ChordPro conversion", () => {
  it("detects supported source formats", () => {
    assert.equal(
      detectSourceFormat("[Verse]\nC   G\nHello"),
      "ultimate-guitar",
    );
    assert.equal(
      detectSourceFormat("Tom: G\nIntérprete: Banda\nC G\nLetra"),
      "cifraclub",
    );
    assert.equal(detectSourceFormat("C       G\nHello"), "plain");
  });

  it("converts plain chord-over-lyric text", () => {
    const result = convertToChordProDetailed("C       G\nLet it be");
    assert.equal(result.detectedSource, "plain");
    assert.match(result.chordpro, /\[C\]/);
    assert.match(result.chordpro, /\[G\]/);
    assert.equal(toChordPro("C       G\nLet it be"), result.chordpro);
  });

  it("normalizes titles and reports conversion metadata", () => {
    assert.equal(slugifyTitle("  My Song! "), "My_Song");
    const result = convertToChordProDetailed("Title: Amazing Grace\n[C]Grace");
    assert.equal(result.title, "Amazing Grace");
    assert.equal(Array.isArray(result.warnings), true);
  });
});
