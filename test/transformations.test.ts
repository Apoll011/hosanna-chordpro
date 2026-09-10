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
    assert.equal(transformed.metadata.key, "D");
    assert.equal(transformed.metadata.capo, "3");
    assert.equal(transformed.metadata.instrument, "guitar");
    assert.equal(transformed.sections[0].lines[0].segments?.[0].chord, "Abm");
    assert.equal(transformed.variants?.length, 0);
  });

  it("removes chord visibility from the AST and cleans display hyphenation", () => {
    const song = parseChordPro("[C]A   Ti  ó  Deus fi____el e bom Senhor");
    const lyricsOnly = song.removeChords(true);
    const line = lyricsOnly.sections[0].lines[0];

    assert.equal(line.segments?.[0].chord, "");
    assert.equal(line.segments?.[0].text, "A Ti ó Deus fiel e bom Senhor");
    assert.equal(song.sections[0].lines[0].segments?.[0].chord, "C");
  });

  it("joins syllabified words while preserving normal word boundaries", () => {
    const song = parseChordPro(`ben - fei - tor
A - aleluia alelu - ia.....`);
    const lyricsOnly = song.removeChords(true);
    const lines = lyricsOnly.sections
      .flatMap((section) => section.lines)
      .map((line) => line.segments?.[0].text);

    assert.deepEqual(lines, ["benfeitor", "A aleluia aleluia..."]);
  });

  it("analyzes chord content and detects a likely key", () => {
    const analysis = parseChordPro(`{key: G}
{tempo: 72}
{c: intro}
{start_of_verse}
[G]One [C]two [Em]three [D]four
{end_of_verse}`).analyze();

    assert.equal(analysis.key, "G");
    assert.equal(analysis.detectedKey, "G");
    assert.equal(analysis.tempo, 72);
    assert.equal(analysis.chordCount, 4);
    assert.deepEqual(analysis.uniqueChords, ["G", "C", "Em", "D"]);
    assert.equal(analysis.sections, 2);
    assert.equal(analysis.hasAnnotations, true);
    assert.equal(analysis.hasVariants, false);
  });
});
