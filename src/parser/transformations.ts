import { analyzeSong } from "./analysis";
import type {
  ChordProVersion,
  LineAST,
  SectionAST,
  SegmentAST,
  SongAST,
} from "./parser";
import { scoreSong } from "./score";
import { transposeChord } from "./transpose";

export type SimplifyLevel = 0 | 1 | 2 | 3;

export interface SongTransformations {
  transpose(semitones: number): SongAST;
  withCapo(capo: number): SongAST;
  simplifyChords(level: SimplifyLevel): SongAST;
  removeChords(cleanText?: boolean): SongAST;
  selectVariant(id?: string | null): SongAST;
  instrument(id?: string | null): SongAST;
}

function cloneSegment(segment: SegmentAST): SegmentAST {
  return { ...segment };
}

function cloneLine(line: LineAST): LineAST {
  return {
    ...line,
    segments: line.segments?.map(cloneSegment),
    measures: line.measures?.map((measure) => ({
      ...measure,
      chords: measure.chords.map(cloneSegment),
    })),
  };
}

function cloneSections(sections: SectionAST[]): SectionAST[] {
  return sections.map((section) => ({
    ...section,
    lines: section.lines.map(cloneLine),
  }));
}

function cloneVersion(version: ChordProVersion): ChordProVersion {
  return {
    ...version,
    metadata: { ...version.metadata },
    body: cloneSections(version.body),
  };
}

function cloneSong(song: SongAST): SongAST {
  const clone: SongAST = {
    ...song,
    metadata: { ...song.metadata },
    sections: cloneSections(song.sections),
    default: song.default ? cloneVersion(song.default) : undefined,
    variants: song.variants?.map(cloneVersion),
    errors: song.errors ? [...song.errors] : undefined,
  };
  return attachSongTransformations(clone);
}

function forEachVersion(
  song: SongAST,
  callback: (version: ChordProVersion) => void,
) {
  if (song.default) callback(song.default);
  for (const variant of song.variants ?? []) callback(variant);
}

function forEachSegment(
  song: SongAST,
  callback: (segment: SegmentAST) => void,
) {
  forEachVersion(song, (version) => {
    for (const section of version.body) {
      for (const line of section.lines) {
        line.segments?.forEach(callback);
        line.measures?.forEach((measure) => measure.chords.forEach(callback));
      }
    }
  });
}

function cleanLyrics(text: string): string {
  let cleaned = text
    .replace(/_+/g, "")
    .replace(/\.{4,}/g, "...")
    .replace(/\s+/g, " ")
    .trim();

  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned.replace(
      /([^\s-]+)\s+-\s+([^\s-]+)/g,
      (_match, left: string, right: string) =>
        left.length > 1 && right.length > 1 ? left + right : `${left} ${right}`,
    );
    cleaned = cleaned.replace(/([^\s-]{2,})-([^\s-]{2,})/g, "$1$2");
  }

  return cleaned.replace(/\s+-\s+/g, " ").replace(/\s+([,.;!?])/g, "$1");
}

function simplifyChord(chord: string, level: SimplifyLevel): string {
  if (level === 0 || !chord) return chord;
  const parts = chord.split("/");
  const root = parts[0].match(/^([A-G](?:#|b)?|Do|Ré|Mi|Fá|Sol|Lá|Si)/i);
  if (!root) return chord;

  const rootText = root[1];
  const suffix = parts[0].slice(rootText.length);
  let simplified = suffix;
  if (level >= 1) simplified = simplified.replace(/(add)?(?:9|11|13)/gi, "");
  if (level >= 2) {
    simplified = simplified
      .replace(/maj(?:7|9|11|13)/gi, "")
      .replace(/(?:sus[24]|dim|aug|[+o])/gi, "")
      .replace(/7/g, "");
  }
  if (level >= 3) simplified = simplified.replace(/m(?!aj)/i, "");
  return rootText + simplified + (parts[1] ? `/${parts[1]}` : "");
}

function updateSong(song: SongAST, update: (next: SongAST) => void): SongAST {
  const next = cloneSong(song);
  update(next);
  return next;
}

export function attachSongTransformations(song: SongAST): SongAST {
  const target = song as SongAST & SongTransformations;
  target.transpose = (semitones) =>
    updateSong(song, (next) => {
      forEachSegment(next, (segment) => {
        segment.chord = transposeChord(segment.chord, semitones);
      });
      forEachVersion(next, (version) => {
        if (version.metadata.key)
          version.metadata.key = transposeChord(
            version.metadata.key,
            semitones,
          );
      });
    });
  target.withCapo = (capo) =>
    updateSong(song, (next) => {
      const normalized = Math.max(0, Math.trunc(capo));
      forEachVersion(next, (version) => {
        const previous = Number(version.metadata.capo ?? 0);
        const delta = previous - normalized;
        version.metadata.capo = String(normalized);
        for (const section of version.body) {
          for (const line of section.lines) {
            line.segments?.forEach((segment) => {
              segment.chord = transposeChord(segment.chord, delta);
            });
            line.measures?.forEach((measure) =>
              measure.chords.forEach((segment) => {
                segment.chord = transposeChord(segment.chord, delta);
              }),
            );
          }
        }
      });
    });
  target.simplifyChords = (level) =>
    updateSong(song, (next) => {
      forEachSegment(next, (segment) => {
        segment.chord = simplifyChord(segment.chord, level);
      });
    });
  target.removeChords = (cleanText = false) =>
    updateSong(song, (next) => {
      forEachVersion(next, (version) => {
        for (const section of version.body) {
          for (const line of section.lines) {
            if (line.type === "chord-section") {
              line.type = "empty";
              delete line.segments;
              delete line.measures;
              continue;
            }
            if (line.segments) {
              const text = line.segments
                .map((segment) => segment.text)
                .join("");
              line.segments = [
                { chord: "", text: cleanText ? cleanLyrics(text) : text },
              ];
            }
          }
        }
      });
    });
  target.selectVariant = (id) =>
    updateSong(song, (next) => {
      const selected =
        !id || id === "default"
          ? next.default
          : next.variants?.find((variant) => variant.id === id);
      if (!selected) return;
      next.id = selected.id;
      next.name = selected.name;
      next.metadata = { ...selected.metadata };
      next.sections = cloneSections(selected.body);
      next.default = cloneVersion(selected);
      next.variants = [];
    });
  target.instrument = (id) =>
    updateSong(song, (next) => {
      forEachVersion(next, (version) => {
        if (id) version.metadata.instrument = id;
        else delete version.metadata.instrument;
      });
    });
  target.analyze = () => analyzeSong(song);
  target.score = () => scoreSong(song);
  if (song.default) {
    song.sections = song.default.body;
    song.metadata = song.default.metadata;
  }
  return song;
}

export function transformSong(song: SongAST): SongTransformations {
  return attachSongTransformations(song) as SongAST & SongTransformations;
}
