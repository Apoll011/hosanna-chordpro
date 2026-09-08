import { chordDictionary } from "../parser/chordDictionary";
import type { InstrumentFingering, InstrumentProfile } from "./types";

export interface PianoShape {
  notes: string[]; // pitch-class names in the chord, root first
  highlightKeys: number[]; // semitone indices (0-23, spans 2 octaves) to light up
}

/**
 * Piano keys dynamic SVG drawer
 */
export function PianoDiagram({ highlightKeys }: { highlightKeys: number[] }) {
  const whiteKeySemitones = [
    0,
    2,
    4,
    5,
    7,
    9,
    11, // Octave 1
    12,
    14,
    16,
    17,
    19,
    21,
    23, // Octave 2
  ];

  const keyWidth = 14;
  const keyHeight = 56;
  const blackWidth = 9;
  const blackHeight = 34;

  const blackKeySemitones = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];

  const getBlackKeyX = (semitone: number) => {
    const octave = Math.floor(semitone / 12);
    const semitoneInOctave = semitone % 12;
    let whiteIndexBefore = 0;
    if (semitoneInOctave === 1) whiteIndexBefore = 1;
    else if (semitoneInOctave === 3) whiteIndexBefore = 2;
    else if (semitoneInOctave === 6) whiteIndexBefore = 4;
    else if (semitoneInOctave === 8) whiteIndexBefore = 5;
    else if (semitoneInOctave === 10) whiteIndexBefore = 6;

    const absoluteWhiteIndex = octave * 7 + whiteIndexBefore;
    return absoluteWhiteIndex * keyWidth - blackWidth / 2;
  };

  return (
    <svg
      width={14 * keyWidth + 2}
      height={keyHeight + 4}
      className="text-m3-text dark:text-m3-dark-text p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-m3-border dark:border-m3-dark-border select-none"
    >
      {/* Draw white keys first */}
      {whiteKeySemitones.map((st, idx) => {
        const isHighlighted = highlightKeys.includes(st);
        const x = idx * keyWidth + 1;
        return (
          <g key={st}>
            <rect
              x={x}
              y={2}
              width={keyWidth - 1}
              height={keyHeight}
              rx={1.5}
              className={`${
                isHighlighted
                  ? "fill-m3-primary dark:fill-m3-dark-primary"
                  : "fill-white dark:fill-zinc-800"
              } stroke-zinc-300 dark:stroke-zinc-700`}
              strokeWidth="0.8"
            />
            {isHighlighted && (
              <circle
                cx={x + (keyWidth - 1) / 2}
                cy={keyHeight - 8}
                r={2}
                className="fill-white dark:fill-zinc-900"
              />
            )}
          </g>
        );
      })}

      {/* Draw black keys on top */}
      {blackKeySemitones.map((st) => {
        const isHighlighted = highlightKeys.includes(st);
        const x = getBlackKeyX(st) + 1;
        return (
          <g key={st}>
            <rect
              x={x}
              y={2}
              width={blackWidth}
              height={blackHeight}
              rx={1}
              className={`${
                isHighlighted
                  ? "fill-m3-primary dark:fill-m3-dark-primary"
                  : "fill-zinc-800 dark:fill-zinc-950"
              } stroke-zinc-900 dark:stroke-black`}
              strokeWidth="0.8"
            />
          </g>
        );
      })}
    </svg>
  );
}

export const pianoInstrument: InstrumentProfile<PianoShape> = {
  id: "piano",
  displayName: "Piano",
  category: "keyboard",
  supportsCapo: false,
  layoutWidthClass: "w-48",
  unavailableLabel: "Não registado",

  getFingering(chord: string): InstrumentFingering<PianoShape> | null {
    const fingering = chordDictionary.getFingering(chord);
    if (!fingering || !fingering.piano) return null;

    return {
      chord,
      qualityId: fingering.qualityId,
      qualityLabel: fingering.qualityLabel,
      shape: fingering.piano,
    };
  },

  renderDiagram(shape: PianoShape) {
    return <PianoDiagram highlightKeys={shape.highlightKeys} />;
  },

  getSubLabel(shape: PianoShape) {
    return shape.notes.length ? shape.notes.join(" - ") : null;
  },
};
