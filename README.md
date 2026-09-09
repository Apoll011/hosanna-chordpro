# @hosanna/chordpro

> A modular ChordPro parser, transformation pipeline, formatter, instrument registry, React renderer, and Ace editor for JavaScript and TypeScript.

## Features

- ChordPro AST parsing with metadata, sections, tabs, grids, comments, repeats, and named variants.
- Immutable, chainable song transformations: transpose, capo, chord simplification, chord removal, variant selection, and instrument selection.
- Extensible formatting and linting utilities.
- Registry-based instrument diagrams for guitar, piano, ukulele, and consumer-defined instruments.
- React rendering from an already transformed `SongAST`.
- Lazy Ace editor with ChordPro syntax support, snippets, linting, formatting, and transpose commands.

## Installation

```bash
npm install @hosanna/chordpro
```

React consumers also need the peer dependencies:

```bash
npm install react react-dom ace-builds react-ace
```

## Modular entry points

| Entry point | Contents |
| --- | --- |
| `@hosanna/chordpro` | All public APIs |
| `@hosanna/chordpro/parser` | Parser, AST types, transformations, transposition, dictionary, and converters |
| `@hosanna/chordpro/renderer` | `ChordProRenderer`, `ChordRoll`, and diagram components |
| `@hosanna/chordpro/editor` | `Editor`, `ChordFinder`, Ace modes, snippets, and editor integrations |
| `@hosanna/chordpro/formatter` | ChordPro formatter and formatter types |
| `@hosanna/chordpro/instruments` | Instrument profiles and the instrument registry |

## Parse and transform a song

`parseChordPro` returns a `SongAST`. Every transformation returns a new song, so pipelines can be reused safely without mutating the parsed source:

```ts
import { parseChordPro } from "@hosanna/chordpro/parser";

const source = `
{title: Hallelujah}
{key: C}
{start_of_version: Acoustic}
[C]Halle---lu---jha
{end_of_version}
`;

const song = parseChordPro(source)
  .transpose(2)
  .withCapo(3)
  .simplifyChords(1)
  .removeChords(true)
  .selectVariant("acoustic")
  .instrument("guitar");
```

### Transformation operations

| Operation | Description |
| --- | --- |
| `.transpose(semitones)` | Transposes every chord, key, and bass note by the requested interval. |
| `.withCapo(position)` | Stores the capo and moves chord shapes into capo-relative notation. `0` disables it. |
| `.simplifyChords(level)` | Simplifies chord qualities. `0` original, `1` slightly simplified, `2` beginner, `3` basic triads only. |
| `.removeChords(cleanText)` | Removes chord annotations from every variant. With `true`, also joins display-only hyphenation such as `Halle---lu---jha`. |
| `.selectVariant(id)` | Selects a named variant (`null`, `undefined`, or `"default"` selects the default) and returns a song containing only that version. |
| `.instrument(id)` | Stores the instrument used by downstream renderers. Pass `null` to clear it. |

The functional equivalent is available for consumers that prefer an explicit pipeline entry point:

```ts
import { transformSong } from "@hosanna/chordpro/parser";

const transformed = transformSong(parseChordPro(source))
  .transpose(2)
  .withCapo(3);
```

The pipeline is extensible: custom transformations can clone a `SongAST`, update its sections or metadata, and return the result for the next operation.

## Render a transformed song

Pass the transformed AST to the renderer. The renderer does not parse source text or apply a second transformation:

```tsx
import { ChordProRenderer } from "@hosanna/chordpro/renderer";

export function SongViewer({ source }: { source: string }) {
  const song = parseChordPro(source)
    .selectVariant("acoustic")
    .transpose(2)
    .withCapo(3)
    .instrument("guitar");

  return (
    <ChordProRenderer
      song={song}
      showChords
      showDiagrams
      instrument={song.metadata.instrument}
    />
  );
}
```

`content` remains available as a backwards-compatible renderer prop. New code should parse and transform once, then pass `song`.

## Variants

Use version blocks in ChordPro:

```chordpro
{title: Amazing Grace}
[G]Amazing grace

{start_of_version: Acoustic}
[C]Amazing grace
{end_of_version}
```

Variant IDs are generated as stable slugs (`"Acoustic"` becomes `"acoustic"`). Variant metadata inherits from the preceding version and can override individual fields.

## Instruments

Instrument diagrams use a registry rather than renderer conditionals:

```ts
import { instrumentRegistry } from "@hosanna/chordpro/instruments";

instrumentRegistry.register({
  id: "mandolin",
  displayName: "Mandolin",
  category: "string",
  supportsCapo: true,
  getFingering: (chord) => resolveMandolinShape(chord),
  renderDiagram: (shape) => <MandolinDiagram shape={shape} />,
});
```

An `InstrumentProfile` resolves a chord into instrument-specific shape data and renders that data. Custom instruments work with `ChordRoll` and `ChordProRenderer` without changing either component.

## Formatting and editor

```ts
import { formatChordPro } from "@hosanna/chordpro/formatter";

const result = formatChordPro(source, {
  normalizeNotationAliases: true,
  expandDirectiveAliases: true,
});
```

```tsx
import { Editor } from "@hosanna/chordpro/editor";

<Editor
  value={source}
  onChange={setSource}
  onSave={(nextSource) => save(nextSource)}
  settings={{ theme: "textmate", fontSize: 14, wordWrap: true }}
/>
```

The editor includes ChordPro completion, diagnostics, section shortcuts (`Alt+V`, `Alt+R`, `Alt+B`), transpose (`Alt+T`), and formatting (`Ctrl/Cmd+Shift+F`).

## Supported directives

Metadata includes `title`, `subtitle`, `artist`, `composer`, `album`, `copyright`, `key`, `original_key`, `capo`, `tempo`, `time`, `duration`, `ccli`, and `youtube`. Sections include verses, choruses, bridges, tabs, grids, comments, repeats, and named versions.

## License

Licensed under the [Apache License 2.0](LICENSE.md).
