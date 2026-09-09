import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatChordPro } from "../src/formatter";
import {
  buildDirectiveLine,
  detectMalformedDirective,
  normalizeDirectiveValue,
  parseDirectiveContent,
} from "../src/formatter/directives";
import {
  isValidChord,
  normalizeChordContent,
  normalizeNotationAlias,
} from "../src/formatter/chords";

describe("ChordPro formatter", () => {
  it("parses and rebuilds directive aliases", () => {
    const parsed = parseDirectiveContent("t:  Song");
    assert.equal(parsed?.name, "title");
    assert.equal(parsed?.wasAlias, true);
    assert.equal(buildDirectiveLine(parsed!, { expandDirectiveAliases: true }), "{title: Song}");
    assert.equal(normalizeDirectiveValue("tempo", "72 bpm"), "72 bpm");
  });

  it("normalizes chord notation and validates chord tokens", () => {
    assert.equal(isValidChord("CΔ7"), true);
    assert.equal(normalizeNotationAlias("Δ7"), "maj7");
    assert.equal(normalizeChordContent(" c / e ", { normalizeNotationAliases: true }).result, "C/E");
  });

  it("formats aliases, whitespace, and malformed directives", () => {
    const result = formatChordPro("{t: Song}\n\n[C]  Hello");
    assert.equal(result.changed, true);
    assert.match(result.content, /\{title: Song\}/);
    assert.equal(detectMalformedDirective("{title: Song", 4)?.type, "malformed_directive");
  });
});
