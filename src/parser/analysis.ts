import type { ChordProVersion, SegmentAST, SongAST } from "./parser";
import { getNoteValue } from "./transpose";

export interface SongAnalysis {
  key?: string;
  detectedKey?: string;
  tempo?: number;
  chordCount: number;
  uniqueChords: string[];
  sections: number;
  lyricsLength: number;
  hasTabs: boolean;
  hasAnnotations: boolean;
  hasVariants: boolean;
}

const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

function versions(song: SongAST): ChordProVersion[] {
  return song.default ? [song.default, ...(song.variants ?? [])] : [];
}

function segments(song: SongAST): SegmentAST[] {
  return versions(song).flatMap((version) =>
    version.body.flatMap((section) =>
      section.lines.flatMap((line) => [
        ...(line.segments ?? []),
        ...(line.measures?.flatMap((measure) => measure.chords) ?? []),
      ]),
    ),
  );
}

function chordRoot(chord: string): number | undefined {
  const match = chord.match(/^([A-G](?:#|b)?|Do|Ré|Mi|Fá|Sol|Lá|Si)/i);
  return match ? getNoteValue(match[1]) : undefined;
}

function detectKey(chords: string[]): string | undefined {
  const usable = chords
    .map((chord) => ({ chord, root: chordRoot(chord) }))
    .filter((entry): entry is { chord: string; root: number } => entry.root !== undefined);
  if (usable.length === 0) return undefined;

  let best: { score: number; root: number; minor: boolean } | undefined;
  for (let root = 0; root < 12; root++) {
    for (const minor of [false, true]) {
      const scale = minor ? MINOR_SCALE : MAJOR_SCALE;
      const score = usable.reduce((total, entry) => {
        const interval = (entry.root - root + 12) % 12;
        const inScale = scale.includes(interval);
        const isMinor = /m(?!aj)|dim/i.test(entry.chord);
        const expectedMinor = minor
          ? [0, 3, 5, 7, 10].includes(interval)
          : [2, 4, 9, 11].includes(interval);
        return total + (inScale ? 2 : -3) + (isMinor === expectedMinor ? 1 : 0);
      }, 0);
      if (!best || score > best.score) best = { score, root, minor };
    }
  }
  return best ? `${NOTES[best.root]}${best.minor ? "m" : ""}` : undefined;
}

export function analyzeSong(song: SongAST): SongAnalysis {
  const allSegments = segments(song);
  const chordSegments = allSegments.filter((segment) => segment.chord);
  const uniqueChords = [...new Set(chordSegments.map((segment) => segment.chord))];
  const lyricsLength = versions(song)
    .flatMap((version) => version.body)
    .flatMap((section) => section.lines)
    .filter((line) => line.type === "lyrics")
    .map((line) => line.segments?.map((segment) => segment.text).join("") ?? "")
    .join("").length;
  const hasAnnotations = versions(song).some((version) =>
    version.body.some((section) =>
      section.type === "comment" ||
      section.lines.some((line) =>
        ["comment", "comment_italic", "comment_box"].includes(line.type),
      ),
    ),
  );
  const detectedKey = detectKey(uniqueChords);
  const parsedTempo = Number(song.metadata.tempo);

  return {
    key: song.metadata.key,
    detectedKey,
    tempo: Number.isFinite(parsedTempo) ? parsedTempo : undefined,
    chordCount: chordSegments.length,
    uniqueChords,
    sections: song.sections.length,
    lyricsLength,
    hasTabs: song.sections.some((section) => section.type === "tab"),
    hasAnnotations,
    hasVariants: (song.variants?.length ?? 0) > 0,
  };
}
