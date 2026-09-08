import { chordDictionary } from "../parser/chordDictionary";
import type { InstrumentFingering, InstrumentProfile } from "./types";

export interface GuitarShape {
  frets: number[]; // 6 numbers, low-E to high-E. -1 = muted string.
  fingers?: number[]; // 1=index, 2=middle, 3=ring, 4=pinky, 0=open/none
  barre?: number; // fret of the barre, if any
}

/**
 * Guitar dynamic SVG drawer
 */
export function GuitarDiagram({
  frets,
  fingers,
  barre,
}: {
  frets: number[];
  fingers?: number[];
  barre?: number;
}) {
  const maxFret = Math.max(...frets);
  let startFret = 1;
  if (maxFret > 4) {
    const minFret = Math.min(...frets.filter((f) => f > 0));
    startFret = minFret;
  }

  const numFrets = 4;
  const width = 100;
  const height = 110;

  const getStringX = (index: number) => 14 + index * 14;
  const getFretY = (index: number) => 22 + index * 20;

  return (
    <svg
      width={width}
      height={height}
      className="text-m3-text dark:text-m3-dark-text select-none"
    >
      {/* Nut or Top thick line */}
      <line
        x1={getStringX(0)}
        y1={getFretY(0) - (startFret === 1 ? 3 : 0)}
        x2={getStringX(5)}
        y2={getFretY(0) - (startFret === 1 ? 3 : 0)}
        className="stroke-zinc-800 dark:stroke-zinc-200"
        strokeWidth={startFret === 1 ? 3.5 : 1.5}
      />

      {/* Fret marker if shifted */}
      {startFret > 1 && (
        <text
          x={getStringX(0) - 4}
          y={getFretY(0) + 12}
          fontSize="8"
          className="font-mono font-black fill-m3-primary dark:fill-m3-dark-primary"
          textAnchor="end"
        >
          {startFret}ª
        </text>
      )}

      {/* 6 vertical strings lines */}
      {[0, 1, 2, 3, 4, 5].map((idx) => (
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

      {/* 4 horizontal fret lines */}
      {[0, 1, 2, 3, 4].map((idx) => (
        <line
          key={idx}
          x1={getStringX(0)}
          y1={getFretY(idx)}
          x2={getStringX(5)}
          y2={getFretY(idx)}
          className="stroke-zinc-400 dark:stroke-zinc-600"
          strokeOpacity="0.4"
          strokeWidth="1"
        />
      ))}

      {/* Barre Chord Indicator if any */}
      {barre !== undefined &&
        (() => {
          const barreFretInWindow = barre - startFret;
          if (barreFretInWindow >= 0 && barreFretInWindow < numFrets) {
            const y = getFretY(barreFretInWindow) + 10;
            const startStr = frets.findIndex((f) => f === barre);
            const endStr = 5;
            if (startStr !== -1) {
              return (
                <rect
                  x={getStringX(startStr) - 4}
                  y={y - 4}
                  width={getStringX(endStr) - getStringX(startStr) + 8}
                  height={8}
                  rx={4}
                  className="fill-m3-primary dark:fill-m3-dark-primary opacity-80"
                />
              );
            }
          }
          return null;
        })()}

      {/* Frets and Fingers Dots */}
      {frets.map((fret, stringIdx) => {
        if (fret === -1) {
          return (
            <text
              key={stringIdx}
              x={getStringX(stringIdx)}
              y={12}
              fontSize="10"
              fontWeight="bold"
              className="fill-red-500 font-black"
              textAnchor="middle"
            >
              ×
            </text>
          );
        }

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
              {/* Skip drawing the individual dot if barred */}
              {!(
                barre !== undefined &&
                fret === barre &&
                stringIdx >= frets.findIndex((f) => f === barre)
              ) && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={5}
                  className="fill-m3-primary dark:fill-m3-dark-primary"
                />
              )}
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

export const guitarInstrument: InstrumentProfile<GuitarShape> = {
  id: "guitar",
  displayName: "Guitar",
  category: "string",
  supportsCapo: true,
  layoutWidthClass: "w-24",
  unavailableLabel: "Não registado",

  getFingering(chord: string): InstrumentFingering<GuitarShape> | null {
    const fingering = chordDictionary.getFingering(chord);
    if (!fingering || !fingering.guitar) return null;

    return {
      chord,
      qualityId: fingering.qualityId,
      qualityLabel: fingering.qualityLabel,
      approximate: fingering.guitar.approximate,
      shape: {
        frets: fingering.guitar.frets,
        fingers: fingering.guitar.fingers,
        barre: fingering.guitar.barre,
      },
    };
  },

  renderDiagram(shape: GuitarShape) {
    return (
      <GuitarDiagram
        frets={shape.frets}
        fingers={shape.fingers}
        barre={shape.barre}
      />
    );
  },
};
