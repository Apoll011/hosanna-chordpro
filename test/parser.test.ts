import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildChordProText,
  parseChordPro,
  parseChordProDocument,
  parseLineSegments,
  selectVersion,
  slugifyVariantName,
} from "../src/parser/parser";

describe("ChordPro parser", () => {
  it("parses inline chords, timings, and lyric text", () => {
    const segments = parseLineSegments("[C@2x]Hello [G]world");
    assert.equal(segments.length, 2);
    assert.deepEqual(segments[0], { chord: "C", text: "Hello ", timing: 2 });
    assert.equal(segments[1].chord, "G");
    assert.equal(segments[1].text, "world");
  });

  it("parses comments, grids, tabs, repeats, and metadata", () => {
    const song = parseChordPro(`{title: Song}
{duration: 1:23}
{comment_box: Note|warning}
{start_of_grid: Intro}
| [C] | [G] |
{end_of_grid}
{start_of_tab}
e|---0---|
{end_of_tab}
{start_of_verse}
{repeat: 2}
Lyrics
{end_of_verse}`);
    assert.equal(song.metadata.duration, "83");
    assert.equal(
      song.sections.some((section) => section.type === "grid"),
      true,
    );
    assert.equal(
      song.sections.some((section) => section.type === "tab"),
      true,
    );
    assert.equal(
      song.sections.some((section) => section.repeat === "2"),
      true,
    );
    assert.equal(
      song.sections.some((section) => section.lines[0]?.type === "comment_box"),
      true,
    );
  });

  it("selects variants and serializes metadata", () => {
    const document = parseChordProDocument(
      "{title: Song}\n{start_of_version: Live}\nLive\n{end_of_version}",
    );
    assert.equal(selectVersion(document, "live").name, "Live");
    assert.equal(slugifyVariantName("  Versão Ao Vivo! "), "versao-ao-vivo");
    assert.match(
      buildChordProText({ title: "Song", key: "G" }, "[G]Lyrics"),
      /\{key: G\}/,
    );
    assert.equal(parseChordPro("{title: Song}").analyze().sections, 0);
  });
});

describe("key_note / tag / chorus directives", () => {
  it("stores key_note as metadata.keyNote", () => {
    const song = parseChordPro(
      "{title: X}\n{key_note: Verso 4 e final modulam para D (meio tom acima)}",
    );
    assert.equal(
      song.metadata.keyNote,
      "Verso 4 e final modulam para D (meio tom acima)",
    );
  });

  it("accumulates repeated {tag} directives", () => {
    const song = parseChordPro("{title: X}\n{tag: adoração}\n{tag: lenta}");
    assert.equal(song.metadata.tag, "adoração, lenta");
  });

  it("{chorus} recalls the previous chorus body", () => {
    const song = parseChordPro(
      "{start_of_chorus}\n[G]Holy\n{end_of_chorus}\n{start_of_verse}\nVerse\n{end_of_verse}\n{chorus}",
    );
    const choruses = song.sections.filter((s) => s.type === "chorus");
    assert.equal(choruses.length, 2);
    assert.equal(choruses[1].lines.length, choruses[0].lines.length);
  });
});
