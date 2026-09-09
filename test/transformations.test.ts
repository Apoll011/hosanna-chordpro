import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseChordPro } from "../src/parser/parser";

describe("Song transformation pipeline", () => {
  it("composes immutable transformations on the selected song", () => {
    const song = parseChordPro(`{title: Test}
{key: C}
[Cmaj7]Halle---lu---jha
{start_of_version: Acoustic}
[Am7]Acoustic line
{end_of_version}`);

    const transformed = song
      .selectVariant("acoustic")
      .transpose(2)
      .withCapo(3)
      .simplifyChords(2)
      .instrument("guitar");

    assert.equal(song.metadata.key, "C");
    assert.equal(song.sections[0].lines[0].segments?.[0].chord, "Cmaj7");
    assert.equal(transformed.metadata.key, "E");
    assert.equal(transformed.metadata.capo, "3");
    assert.equal(transformed.metadata.instrument, "guitar");
    assert.equal(
      transformed.sections[0].lines[0].segments?.[0].chord,
      "Abm",
    );
    assert.equal(transformed.variants?.length, 0);
  });

  it("removes chord visibility from the AST and cleans display hyphenation", () => {
    const song = parseChordPro("[C]Halle---lu---jha");
    const lyricsOnly = song.removeChords(true);
    const line = lyricsOnly.sections[0].lines[0];

    assert.equal(line.segments?.[0].chord, "");
    assert.equal(line.segments?.[0].text, "Hallelujha");
    assert.equal(song.sections[0].lines[0].segments?.[0].chord, "C");
  });
});
