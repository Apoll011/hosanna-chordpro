// ---------------------------------------------------------------------------
// Chord transposition
// ---------------------------------------------------------------------------

const NOTE_TO_VAL: { [key: string]: number } = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11,
  DO: 0,
  RE: 2,
  RÉ: 2,
  MI: 4,
  FA: 5,
  FÁ: 5,
  SOL: 7,
  LA: 9,
  LÁ: 9,
  SI: 11,
};

const SHARPS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function getNoteValue(note: string): number | undefined {
  if (!note) return undefined;
  const match = note.match(
    /^([A-G][#b]?|Do|Ré|Mi|Fá|Sol|Lá|Si|DO|RE|RÉ|MI|FA|FÁ|SOL|LA|LÁ|SI)/i,
  );
  if (!match) return undefined;
  return NOTE_TO_VAL[match[1].toUpperCase()];
}

export function getSuggestedCapo(
  originalKey: string | undefined,
  transposeVal: number,
): { capo: number; chordShape: string } | null {
  const baseKeyVal = originalKey ? getNoteValue(originalKey) : 0;
  const keyVal = baseKeyVal !== undefined ? baseKeyVal : 0;
  const soundingVal = (keyVal + transposeVal + 240) % 12;

  const EASY_SHAPES: { [val: number]: string } = {
    0: "C",
    7: "G",
    2: "D",
    9: "A",
    4: "E",
  };

  const PREFERRED_OPEN_VALS = [0, 7, 2, 9, 4];

  for (const targetShapeVal of PREFERRED_OPEN_VALS) {
    const neededCapo = (soundingVal - targetShapeVal + 12) % 12;
    if (neededCapo >= 1 && neededCapo <= 7) {
      return {
        capo: neededCapo,
        chordShape: EASY_SHAPES[targetShapeVal],
      };
    }
  }

  return null;
}

export function transposeNote(
  note: string,
  semitones: number,
  preferFlats = false,
): string {
  const upper = note.toUpperCase();
  if (NOTE_TO_VAL[upper] === undefined) return note;

  const val = NOTE_TO_VAL[upper];
  const newVal = (val + semitones + 24) % 12;

  const targetScale = preferFlats ? FLATS : SHARPS;
  let transposed = targetScale[newVal];

  if (note[0] === note[0].toLowerCase()) {
    transposed = transposed.toLowerCase();
  }
  return transposed;
}

export function transposeChord(chord: string, semitones: number): string {
  if (!chord || semitones === 0) return chord;

  if (chord.includes("/")) {
    return chord
      .split("/")
      .map((part) => transposeChord(part.trim(), semitones))
      .join("/");
  }

  const noteRegex =
    /^([A-G][#b]?|Do|Ré|Mi|Fá|Sol|Lá|Si|DO|RE|RÉ|MI|FA|FÁ|SOL|LA|LÁ|SI)/;
  const match = chord.match(noteRegex);

  if (!match) return chord;

  const note = match[1];
  const suffix = chord.slice(note.length);
  const preferFlats = chord.includes("b") || chord.includes("B");
  const transposedNote = transposeNote(note, semitones, preferFlats);

  return transposedNote + suffix;
}

