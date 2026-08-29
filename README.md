# @hosanna/chordpro

> A modern, modular ChordPro toolkit for JavaScript & TypeScript. Includes an AST parser, music-theory transposition engine, chord dictionary with interactive guitar & piano diagrams, universal sheet converter, and React editor & renderer components.

[![npm version](https://img.shields.io/npm/v/@hosanna/chordpro.svg)](https://www.npmjs.com/package/@hosanna/chordpro)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6.svg)](https://www.typescriptlang.org/)

---

## ✨ Features

- 🎼 **AST Parser**: Full-featured ChordPro AST parser supporting verses, choruses, bridges, grids, tabs, barlines, timing directives (`[Am@1.5x]`), repeats, and rich metadata.
- 🔄 **Transposition Engine**: Interval-safe key transposition and smart capo calculation (`getSuggestedCapo`, `transposeChord`, `transposeNote`).
- 🎹 **Dynamic Chord Dictionary**: Music theory-driven fingering calculations for piano (keys & pitch classes) and guitar (CAGED barres, open chords, and fret charts).
- 📝 **Universal Sheet Converter**: Converts plain chord-over-lyric text, Ultimate-Guitar tabs, and CifraClub sheets into valid ChordPro format.
- 🎨 **Interactive React Renderer**: Beautiful lyric and chord rendering with responsive chord rolls, instrument switching (guitar/piano), YouTube playback synchronization, and print optimization.
- ⚡ **Ace ChordPro Editor**: Feature-packed code editor component with autocompletion, section wrapping shortcuts (`Alt+V`, `Alt+R`, `Alt+B`), snippets, and customizable visual settings.

---

## 📦 Installation

```bash
npm install @hosanna/chordpro
```

### Peer Dependencies (Optional if using React UI / Editor)

```bash
npm install react react-dom ace-builds react-ace
```

---

## 🧩 Modular Architecture

`@hosanna/chordpro` is organized into 3 modular entry points:

| Entry Point | Description |
| :--- | :--- |
| `@hosanna/chordpro/parser` | AST parsing, transposition, chord dictionary, text-to-ChordPro conversion |
| `@hosanna/chordpro/renderer` | `ChordProRenderer`, `ChordRoll`, `GuitarDiagram`, `PianoDiagram` |
| `@hosanna/chordpro/editor` | `Editor`, `ChordFinder`, ChordPro Ace modes & snippets |
| `@hosanna/chordpro` | Re-exports everything from all 3 modules |

---

## 🚀 Quick Start

### 1. Parsing & Transposing ChordPro

```typescript
import { parseChordPro, transposeChord } from "@hosanna/chordpro/parser";

const chordproText = `
{title: Amazing Grace}
{key: G}
{start_of_verse}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
{end_of_verse}
`;

// Parse into structured AST
const songAst = parseChordPro(chordproText);
console.log(songAst.metadata.title); // "Amazing Grace"

// Transpose chords (+2 semitones: G -> A)
const transposed = transposeChord("G", 2);
console.log(transposed); // "A"
```

---

### 2. Converting Plain Chords to ChordPro

```typescript
import { toChordPro } from "@hosanna/chordpro/parser";

const rawSheet = `
Title: Let It Be
Artist: The Beatles

Am         C/G        F          C
Let it be, let it be, let it be, let it be
`;

const chordpro = toChordPro(rawSheet);
console.log(chordpro);
// Output:
// {title: Let It Be}
// {artist: The Beatles}
// [Am]Let it be, [C/G]let it be, [F]let it be, [C]let it be
```

---

### 3. Rendering a Song in React

```tsx
import React, { useState } from "react";
import { ChordProRenderer } from "@hosanna/chordpro/renderer";

export function SongViewer({ chordproContent }: { chordproContent: string }) {
  const [transposeVal, setTransposeVal] = useState(0);

  return (
    <div className="h-screen flex flex-col">
      <ChordProRenderer
        content={chordproContent}
        showChords={true}
        transposeVal={transposeVal}
        onTransposeChange={setTransposeVal}
        instrument="guitar"
        showDiagrams={true}
      />
    </div>
  );
}
```

---

### 4. Embedding the ChordPro Editor

```tsx
import React, { useState } from "react";
import { Editor } from "@hosanna/chordpro/editor";

export function SongEditor() {
  const [content, setContent] = useState("{title: New Song}\n[C]Hello world");

  return (
    <div className="h-96 w-full">
      <Editor
        value={content}
        onChange={setContent}
        onSave={(val) => console.log("Saved:", val)}
        settings={{
          theme: "textmate",
          fontSize: 14,
          wordWrap: true,
          showLineNumbers: true,
        }}
      />
    </div>
  );
}
```

---

### 5. Chord Dictionary & Diagrams

```typescript
import { chordDictionary } from "@hosanna/chordpro/parser";

const fingering = chordDictionary.getFingering("Cmaj7");

console.log(fingering?.guitar?.frets); // [-1, 3, 2, 0, 0, 0]
console.log(fingering?.piano?.notes);  // ["C", "E", "G", "B"]
```

---

## 📜 Supported Directives

- **Metadata**: `{title}`, `{subtitle}`, `{artist}`, `{composer}`, `{album}`, `{key}`, `{original_key}`, `{capo}`, `{tempo}`, `{time}`, `{duration}`, `{ccli}`, `{youtube}`
- **Sections**: `{start_of_verse}` / `{end_of_verse}`, `{start_of_chorus}` / `{end_of_chorus}`, `{start_of_bridge}` / `{end_of_bridge}`, `{start_of_tab}` / `{end_of_tab}`, `{start_of_grid}` / `{end_of_grid}`
- **Inline shorthand**: `{sov}`, `{eov}`, `{soc}`, `{eoc}`, `{sob}`, `{eob}`, `{c: comment}`, `{cb: comment_box}`
- **Directives with repeats**: `{repeat: 2}`

---

## 📄 License

Licensed under the [Apache License, Version 2.0](LICENSE.md).
