import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseChordPro,
  parseChordProDocument,
  selectVersion,
  slugifyVariantName,
} from "../src/parser/parser";

describe("ChordPro Song Variants System", () => {
  // 1. A song with no variants
  it("1. Song with no variants maintains standard AST structure and behavior", () => {
    const chordpro = `{title: Amazing Grace}
{artist: John Newton}
{key: E}
{tempo: 72}

{start_of_verse}
[A]Amazing grace, how sweet the sound
That saved a [E]wretch like me
{end_of_verse}`;

    const doc = parseChordProDocument(chordpro);
    assert.strictEqual(doc.variants.length, 0);
    assert.strictEqual(doc.errors.length, 0);
    assert.strictEqual(doc.default.id, "default");
    assert.strictEqual(doc.default.metadata.title, "Amazing Grace");
    assert.strictEqual(doc.default.metadata.artist, "John Newton");
    assert.strictEqual(doc.default.metadata.key, "E");
    assert.strictEqual(doc.default.metadata.tempo, "72");
    assert.strictEqual(doc.default.body.length, 1);
    assert.strictEqual(doc.default.body[0].type, "verse");

    // Also check backward compatibility via parseChordPro
    const song = parseChordPro(chordpro);
    assert.strictEqual(song.metadata.title, "Amazing Grace");
    assert.strictEqual(song.metadata.key, "E");
    assert.strictEqual(song.sections.length, 1);
    assert.strictEqual(song.variants?.length, 0);
  });

  // 2. One variant
  it("2. One variant parses cleanly and separates bodies", () => {
    const chordpro = `{title: Amazing Grace}
{artist: John Newton}
{key: E}

{start_of_verse}
[A]Amazing grace
{end_of_verse}

{start_of_version: Simplificada}
{key: G}
{start_of_verse}
[G]Amazing grace
{end_of_verse}
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    assert.strictEqual(doc.errors.length, 0);
    assert.strictEqual(doc.variants.length, 1);

    const v1 = doc.variants[0];
    assert.strictEqual(v1.id, "simplificada");
    assert.strictEqual(v1.name, "Simplificada");
    assert.strictEqual(v1.metadata.title, "Amazing Grace");
    assert.strictEqual(v1.metadata.artist, "John Newton");
    assert.strictEqual(v1.metadata.key, "G");
    assert.strictEqual(v1.body.length, 1);

    // Default song should remain in key E
    assert.strictEqual(doc.default.metadata.key, "E");
    assert.strictEqual(doc.default.body.length, 1);
  });

  // 3. Multiple variants
  it("3. Multiple variants are recognized in sequence", () => {
    const chordpro = `{title: Amazing Grace}
{artist: John Newton}
{key: E}
{tempo: 72}

{start_of_verse}
[A]Amazing grace
{end_of_verse}

{start_of_version: Simplificada}
{key: G}
{start_of_verse}
[G]Simple
{end_of_verse}
{end_of_version}

{start_of_version: Versão de Estúdio}
{tempo: 82}
{start_of_verse}
[G]Studio
{end_of_verse}
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    assert.strictEqual(doc.errors.length, 0);
    assert.strictEqual(doc.variants.length, 2);
    assert.strictEqual(doc.variants[0].id, "simplificada");
    assert.strictEqual(doc.variants[1].id, "versao-de-estudio");
    assert.strictEqual(doc.variants[1].name, "Versão de Estúdio");
  });

  // 4. Unlimited/sequential variants
  it("4. Unlimited/sequential variants parsed correctly", () => {
    let chordpro = `{title: Test Song}\n{key: C}\nDefault line\n`;
    for (let i = 1; i <= 10; i++) {
      chordpro += `\n{start_of_version: Version ${i}}\n{key: D${i}}\nVariant ${i} body\n{end_of_version}\n`;
    }

    const doc = parseChordProDocument(chordpro);
    assert.strictEqual(doc.errors.length, 0);
    assert.strictEqual(doc.variants.length, 10);
    assert.strictEqual(doc.variants[9].id, "version-10");
    assert.strictEqual(doc.variants[9].metadata.key, "D10");
    assert.strictEqual(doc.variants[9].metadata.title, "Test Song");
  });

  // 5. Metadata inheritance
  it("5. Metadata inheritance from default to first variant", () => {
    const chordpro = `{title: Song A}
{artist: Artist A}
{composer: Composer A}
{tempo: 120}

{start_of_version: Acoustic}
{tempo: 90}
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    const acoustic = doc.variants[0];
    assert.strictEqual(acoustic.metadata.title, "Song A");
    assert.strictEqual(acoustic.metadata.artist, "Artist A");
    assert.strictEqual(acoustic.metadata.composer, "Composer A");
    assert.strictEqual(acoustic.metadata.tempo, "90");
  });

  // 6. Cumulative metadata inheritance across multiple variants
  it("6. Cumulative metadata inheritance (Variant N inherits from Variant N-1)", () => {
    const chordpro = `{title: Amazing Grace}
{artist: John Newton}
{key: E}
{tempo: 72}

{start_of_verse}
[A]Amazing grace
{end_of_verse}

{start_of_version: Simplificada}
{key: G}
{start_of_verse}
[G]Amazing grace
{end_of_verse}
{end_of_version}

{start_of_version: Versão de Estúdio}
{tempo: 82}
{start_of_verse}
[G]Amazing grace
{end_of_verse}
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    assert.strictEqual(doc.errors.length, 0);

    // Default: key: E, tempo: 72
    assert.strictEqual(doc.default.metadata.key, "E");
    assert.strictEqual(doc.default.metadata.tempo, "72");

    // Simplificada: key: G, tempo: 72 (inherited from default)
    assert.strictEqual(doc.variants[0].metadata.title, "Amazing Grace");
    assert.strictEqual(doc.variants[0].metadata.artist, "John Newton");
    assert.strictEqual(doc.variants[0].metadata.key, "G");
    assert.strictEqual(doc.variants[0].metadata.tempo, "72");

    // Versão de Estúdio: key: G (inherited from Simplificada), tempo: 82 (overridden)
    assert.strictEqual(doc.variants[1].metadata.title, "Amazing Grace");
    assert.strictEqual(doc.variants[1].metadata.artist, "John Newton");
    assert.strictEqual(doc.variants[1].metadata.key, "G");
    assert.strictEqual(doc.variants[1].metadata.tempo, "82");
  });

  // 7. Metadata overrides
  it("7. Metadata overrides don't mutate previous versions", () => {
    const chordpro = `{title: Base Song}
{key: C}

{start_of_version: V1}
{key: D}
{end_of_version}

{start_of_version: V2}
{key: F}
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    assert.strictEqual(doc.default.metadata.key, "C");
    assert.strictEqual(doc.variants[0].metadata.key, "D");
    assert.strictEqual(doc.variants[1].metadata.key, "F");
  });

  // 8. Variant-specific body content
  it("8. Variant-specific body content is not merged with default body", () => {
    const chordpro = `{title: Test}
[C]Default body line 1
[G]Default body line 2
{start_of_version: Live}
[F]Live body line 1
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    const defaultLines = doc.default.body[0].lines;
    assert.strictEqual(defaultLines.length, 2);
    assert.strictEqual(defaultLines[0].segments?.[0].chord, "C");
    assert.strictEqual(defaultLines[1].segments?.[0].chord, "G");

    const liveLines = doc.variants[0].body[0].lines;
    assert.strictEqual(liveLines.length, 1);
    assert.strictEqual(liveLines[0].segments?.[0].chord, "F");
    assert.strictEqual(liveLines[0].segments?.[0].text, "Live body line 1");
  });

  // 9. Default version selection
  it("9. Default version selection when no version specified or 'default' passed", () => {
    const chordpro = `{title: Song}
{start_of_version: Alt}
Alt body
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    const selected1 = selectVersion(doc);
    assert.strictEqual(selected1.id, "default");

    const selected2 = selectVersion(doc, "default");
    assert.strictEqual(selected2.id, "default");
  });

  // 10. Selecting a nonexistent variant falls back to default
  it("10. Selecting nonexistent variant safely falls back to default", () => {
    const chordpro = `{title: Song}
{start_of_version: Alt}
Alt body
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    const selected = selectVersion(doc, "nonexistent-id");
    assert.strictEqual(selected.id, "default");
    assert.strictEqual(selected.name, "Padrão");
  });

  // 11. Nested variants report error
  it("11. Nested variants report an error and do not corrupt parser", () => {
    const chordpro = `{title: Song}
{start_of_version: Outer}
Outer content
{start_of_version: Inner}
Inner content
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    assert.ok(doc.errors.length > 0);
    assert.ok(doc.errors.some((e) => e.includes("Nested version block detected")));
    // Outer is still completed at end_of_version
    assert.strictEqual(doc.variants.length, 1);
    assert.strictEqual(doc.variants[0].id, "outer");
  });

  // 12. Duplicate variants report error
  it("12. Duplicate variants report an error", () => {
    const chordpro = `{title: Song}
{start_of_version: Acoustic}
Body 1
{end_of_version}
{start_of_version: Acoustic}
Body 2
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    assert.ok(doc.errors.length > 0);
    assert.ok(doc.errors.some((e) => e.includes("Duplicate or invalid variant identifier")));
    assert.strictEqual(doc.variants.length, 1);
  });

  // 13. Missing {end_of_version}
  it("13. Missing {end_of_version} reports error on file end", () => {
    const chordpro = `{title: Song}
{start_of_version: Unfinished}
Some lyrics`;

    const doc = parseChordProDocument(chordpro);
    assert.ok(doc.errors.length > 0);
    assert.ok(doc.errors.some((e) => e.includes("Missing \"{end_of_version}\"")));
    assert.strictEqual(doc.variants.length, 1);
    assert.strictEqual(doc.variants[0].id, "unfinished");
  });

  // 14. {end_of_version} without a corresponding start
  it("14. {end_of_version} without start reports error", () => {
    const chordpro = `{title: Song}
[C]Lyrics
{end_of_version}`;

    const doc = parseChordProDocument(chordpro);
    assert.ok(doc.errors.length > 0);
    assert.ok(doc.errors.some((e) => e.includes("without an active version block")));
    assert.strictEqual(doc.variants.length, 0);
  });

  // 15. Slug generation
  it("15. Generates clean IDs from accented and spaced names", () => {
    assert.strictEqual(slugifyVariantName("Simplificada"), "simplificada");
    assert.strictEqual(slugifyVariantName("Versão de Estúdio"), "versao-de-estudio");
    assert.strictEqual(slugifyVariantName("  Ao Vivo (2024)!  "), "ao-vivo-2024");
  });
});
