import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getChordProCapabilities,
  explainChordProDirective,
} from "../src/parser/capabilities";
import { transposeChordProSource } from "../src/parser/transposeSource";

describe("transposeChordProSource", () => {
  it("transposes chords and key by semitones while preserving lyrics", () => {
    const source = `{title: Test}
{key: C}
{start_of_verse}
[C]Hello [G]world
{end_of_verse}
`;
    const result = transposeChordProSource(source, 2);
    assert.equal(result.semitones, 2);
    assert.equal(result.fromKey, "C");
    assert.match(result.content, /\{key: D\}/);
    assert.match(result.content, /\[D\]Hello \[A\]world/);
    assert.match(result.content, /\{title: Test\}/);
    assert.match(result.content, /\{start_of_verse\}/);
  });

  it("transposes to a target key", () => {
    const source = `{key: G}\n[G]Praise [C]Him`;
    const result = transposeChordProSource(source, { toKey: "A" });
    assert.equal(result.semitones, 2);
    assert.equal(result.toKey, "A");
    assert.match(result.content, /\{key: A\}/);
    assert.match(result.content, /\[A\]Praise \[D\]Him/);
  });

  it("preserves timing annotations and variants", () => {
    const source = `{key: C}
{start_of_version: Acoustic}
[Am@2x]softly
{end_of_version}
`;
    const result = transposeChordProSource(source, 2);
    assert.match(result.content, /\[Bm@2x\]softly/);
    assert.match(result.content, /\{start_of_version: Acoustic\}/);
  });

  it("is a no-op for zero semitones", () => {
    const source = `{key: C}\n[C]Hi`;
    const result = transposeChordProSource(source, 0);
    assert.equal(result.content, source);
  });
});

describe("getChordProCapabilities", () => {
  it("reports variants as implemented", () => {
    const manifest = getChordProCapabilities();
    const variants = manifest.features.find((f) => f.id === "variants");
    assert.equal(variants?.support, "implemented");
  });

  it("explains directives by alias", () => {
    const title = explainChordProDirective("t");
    assert.equal(title?.name, "title");
    const version = explainChordProDirective("start_of_version");
    assert.equal(version?.support, "parsed");
  });
});
