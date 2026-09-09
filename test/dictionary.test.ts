import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeChordSymbol,
  chordDictionary,
  getChordTheory,
  pitchClassName,
} from "../src/parser/chordDictionary";

describe("chord theory and dictionary", () => {
  it("analyzes roots, qualities, and slash bass notes", () => {
    const analysis = analyzeChordSymbol("C#m7/G#");
    assert.equal(analysis.hasValidRoot, true);
    assert.equal(analysis.qualityRecognized, true);
    assert.equal(getChordTheory("C#m7/G#")?.rootSemitone, 1);
    assert.equal(getChordTheory("C#m7/G#")?.rootDisplay, "C#");
  });

  it("rejects malformed chord symbols", () => {
    assert.equal(analyzeChordSymbol("not-a-chord").hasValidRoot, false);
    assert.equal(getChordTheory("Cmaj7")?.intervals.includes(11), true);
    assert.equal(getChordTheory("???"), null);
  });

  it("generates theory-driven piano and guitar data", () => {
    const fingering = chordDictionary.getFingering("G7");
    assert.ok(fingering);
    assert.equal(fingering.qualityId, "dom7");
    assert.deepEqual(fingering.piano.notes.length, 4);
    assert.equal(fingering.guitar?.frets.length, 6);
    assert.equal(pitchClassName(13), "C#");
  });
});
