import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChordPro } from "../src/parser/parser";
import { scoreSong } from "../src/parser/score";

describe("song scoring", () => {
  it("awards all points for a complete song", () => {
    const song = parseChordPro(`{title: Amazing Grace}
{artist: John Newton}
{key: G}
{tempo: 90}
{song_number: 123}
{youtube: https://youtube.com/watch?v=example}
{duration: 4:30}
{start_of_verse}
[G]Amazing [C]grace
{end_of_verse}`);

    assert.deepEqual(scoreSong(song), { score: 100, missing: [] });
  });

  it("only requires a verse section", () => {
    const song = parseChordPro(`{title: Simple Song}
{start_of_verse}
[C]Sing along
{end_of_verse}`);

    assert.deepEqual(scoreSong(song), {
      score: 50,
      missing: ["artist", "tempo", "songNumber", "youtube", "duration"],
    });
  });
});
