import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getNoteValue,
  getSuggestedCapo,
  transposeChord,
  transposeNote,
} from "../src/parser/transpose";

describe("transposition engine", () => {
  it("resolves English and solfege note names", () => {
    assert.equal(getNoteValue("C#"), 1);
    assert.equal(getNoteValue("Ré"), 2);
    assert.equal(getNoteValue("sol"), 7);
    assert.equal(getNoteValue("unknown"), undefined);
  });

  it("transposes notes with accidentals, octave wrapping, and flat preference", () => {
    assert.equal(transposeNote("C", 2), "D");
    assert.equal(transposeNote("Bb", 2, true), "C");
    assert.equal(transposeNote("a", -2), "g");
    assert.equal(transposeNote("H", 2), "H");
  });

  it("transposes slash chords without changing their quality", () => {
    assert.equal(transposeChord("Cmaj7/E", 2), "Dmaj7/F#");
    assert.equal(transposeChord("Bb7", -2), "Ab7");
    assert.equal(transposeChord("N.C.", 4), "N.C.");
  });

  it("suggests a playable capo position", () => {
    const suggestion = getSuggestedCapo("C", 2);
    assert.deepEqual(suggestion, { capo: 2, chordShape: "C" });
    assert.equal(getSuggestedCapo("C", 0)?.capo, 5);
  });
});
