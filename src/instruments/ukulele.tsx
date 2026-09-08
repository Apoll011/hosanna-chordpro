import { chordDictionary } from "../parser/chordDictionary";
import type { InstrumentFingering, InstrumentProfile } from "./types";

export interface UkuleleShape {
  frets: number[]; // 4 numbers, G-C-E-A (standard reentrant tuning). -1 = muted.
  fingers?: number[];
}

const CANONICAL_SUFFIX: Record<string, string> = {
  major: "",
  minor: "m",
  dom7: "7",
  maj7: "maj7",
  m7: "m7",
  sus2: "sus2",
  sus4: "sus4",
};

// Curated open/common-position shapes for standard GCEA ukulele tuning.
// This table is intentionally small and honest: chords without a well-known
// beginner-friendly shape simply have no diagram, same as the guitar table's
// fallback behaviour, rather than guessing something misleading.
const UKULELE_SHAPES: Record<string, UkuleleShape> = {
  // Major
  C: { frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3] },
  "C#": { frets: [1, 1, 1, 4], fingers: [1, 1, 1, 4] },
  D: { frets: [2, 2, 2, 0], fingers: [1, 2, 3, 0] },
  "D#": { frets: [3, 3, 3, 1], fingers: [2, 3, 4, 1] },
  E: { frets: [4, 4, 4, 2], fingers: [2, 3, 4, 1] },
  F: { frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0] },
  "F#": { frets: [3, 1, 2, 1], fingers: [3, 1, 2, 1] },
  G: { frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2] },
  "G#": { frets: [5, 3, 4, 3], fingers: [4, 1, 3, 2] },
  A: { frets: [2, 1, 0, 0], fingers: [2, 1, 0, 0] },
  "A#": { frets: [3, 2, 1, 1], fingers: [3, 2, 1, 1] },
  B: { frets: [4, 3, 2, 2], fingers: [4, 2, 1, 1] },
  // Minor
  Cm: { frets: [0, 3, 3, 3], fingers: [0, 1, 2, 3] },
  "C#m": { frets: [1, 4, 4, 4], fingers: [1, 2, 3, 4] },
  Dm: { frets: [2, 2, 1, 0], fingers: [2, 3, 1, 0] },
  "D#m": { frets: [3, 3, 2, 1], fingers: [3, 4, 2, 1] },
  Em: { frets: [0, 4, 3, 2], fingers: [0, 4, 3, 1] },
  Fm: { frets: [1, 0, 1, 3], fingers: [1, 0, 2, 4] },
  "F#m": { frets: [2, 1, 2, 0], fingers: [2, 1, 3, 0] },
  Gm: { frets: [0, 2, 3, 1], fingers: [0, 2, 3, 1] },
  "G#m": { frets: [1, 3, 4, 2], fingers: [1, 3, 4, 2] },
  Am: { frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0] },
  "A#m": { frets: [3, 1, 1, 1], fingers: [3, 1, 1, 1] },
  Bm: { frets: [4, 2, 2, 2], fingers: [4, 1, 1, 1] },
  // Dominant 7th
  C7: { frets: [0, 0, 0, 1], fingers: [0, 0, 0, 1] },
  D7: { frets: [2, 2, 2, 3], fingers: [1, 1, 1, 2] },
  E7: { frets: [1, 2, 0, 2], fingers: [1, 2, 0, 3] },
  F7: { frets: [2, 3, 1, 0], fingers: [3, 4, 1, 0] },
  G7: { frets: [0, 2, 1, 2], fingers: [0, 2, 1, 3] },
  A7: { frets: [0, 1, 0, 0], fingers: [0, 1, 0, 0] },
  B7: { frets: [2, 3, 2, 2], fingers: [1, 3, 1, 1] },
};

function svgFor({ frets, fingers }: UkuleleShape) {
  const numFrets = 4;
  const width = 76;
  const height = 100;
  const getStringX = (index: number) => 12 + index * 16;
  const getFretY = (index: number) => 22 + index * 20;
  const maxFret = Math.max(...frets);
  const startFret = maxFret > 4 ? Math.min(...frets.filter((f) => f > 0)) : 1;

  return (
    <svg width={width} height={height} className="text-m3-text dark:text-m3-dark-text select-none">
      <line
        x1={getStringX(0)}
        y1={getFretY(0) - (startFret === 1 ? 3 : 0)}
        x2={getStringX(3)}
        y2={getFretY(0) - (startFret === 1 ? 3 : 0)}
        className="stroke-zinc-800 dark:stroke-zinc-200"
        strokeWidth={startFret === 1 ? 3.5 : 1.5}
      />
      {startFret > 1 && (
        <text
          x={getStringX(0) - 6}
          y={getFretY(0) + 12}
          fontSize="8"
          className="font-mono font-black fill-m3-primary dark:fill-m3-dark-primary"
          textAnchor="end"
        >
          {startFret}ª
        </text>
      )}
      {[0, 1, 2, 3].map((idx) => (
        <line
          key={idx}
          x1={getStringX(idx)}
          y1={getFretY(0)}
          x2={getStringX(idx)}
          y2={getFretY(numFrets)}
          className="stroke-zinc-400 dark:stroke-zinc-600"
          strokeOpacity="0.5"
          strokeWidth="1.2"
        />
      ))}
      {[0, 1, 2, 3, 4].map((idx) => (
        <line
          key={idx}
          x1={getStringX(0)}
          y1={getFretY(idx)}
          x2={getStringX(3)}
          y2={getFretY(idx)}
          className="stroke-zinc-400 dark:stroke-zinc-600"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
      ))}
      {frets.map((fret, stringIdx) => {
        if (fret === 0) {
          return (
            <circle
              key={stringIdx}
              cx={getStringX(stringIdx)}
              cy={10}
              r={2}
              fill="none"
              className="stroke-emerald-500"
              strokeWidth="1.2"
            />
          );
        }
        const fretInWindow = fret - startFret;
        if (fretInWindow >= 0 && fretInWindow < numFrets) {
          const cx = getStringX(stringIdx);
          const cy = getFretY(fretInWindow) + 10;
          const finger = fingers ? fingers[stringIdx] : 0;
          return (
            <g key={stringIdx}>
              <circle cx={cx} cy={cy} r={5} className="fill-m3-primary dark:fill-m3-dark-primary" />
              {finger > 0 && (
                <text
                  x={cx}
                  y={cy + 2.5}
                  fontSize="6.5"
                  fontWeight="bold"
                  fill="white"
                  textAnchor="middle"
                  className="font-bold fill-white"
                >
                  {finger}
                </text>
              )}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

export function UkuleleDiagram({ frets, fingers }: UkuleleShape) {
  return svgFor({ frets, fingers });
}

/**
 * Ukulele instrument profile. Demonstrates that adding a brand-new
 * instrument to the modular system is self-contained: its own curated shape
 * table + its own small diagram renderer, registered once in `./index.ts`.
 */
export const ukuleleInstrument: InstrumentProfile<UkuleleShape> = {
  id: "ukulele",
  displayName: "Ukulele",
  category: "string",
  supportsCapo: true,
  layoutWidthClass: "w-20",
  unavailableLabel: "Sem forma conhecida",

  getFingering(chord: string): InstrumentFingering<UkuleleShape> | null {
    const parsed = chordDictionary.parse?.(chord);
    if (!parsed) return null;

    const suffix = CANONICAL_SUFFIX[parsed.qualityId];
    if (suffix === undefined) return null;

    const shape = UKULELE_SHAPES[parsed.rootDisplay + suffix];
    if (!shape) return null;

    return {
      chord,
      qualityId: parsed.qualityId,
      qualityLabel: parsed.qualityLabel,
      shape,
    };
  },

  renderDiagram(shape: UkuleleShape) {
    return <UkuleleDiagram frets={shape.frets} fingers={shape.fingers} />;
  },
};
