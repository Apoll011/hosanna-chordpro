import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChordFinder } from "../src/editor/ChordFinder";

describe("editor helpers", () => {
  it("extracts and ranks repeated chord completions", () => {
    assert.deepEqual(ChordFinder.getChords("[C]one [G]two [C]three"), [
      { value: "[C]", meta: "2 occurrences", score: 2 },
      { value: "[G]", meta: "1 occurrence", score: 1 },
    ]);
  });

  it("returns no completions for lyric-only text", () => {
    assert.deepEqual(ChordFinder.getChords("Amazing grace"), []);
    assert.deepEqual(ChordFinder.getChords(null as unknown as string), []);
  });
});
