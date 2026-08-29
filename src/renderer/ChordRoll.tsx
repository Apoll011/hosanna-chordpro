import { useMemo } from "react";
import { chordDictionary } from "../parser/chordDictionary";
import { transposeChord } from "../parser/transpose";

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

export interface ChordRollProps {
  uniqueChords: string[];
  transposeVal: number;
  capoVal?: number;
  onChordClick?: (chord: string) => void;
  instrument: "guitar" | "piano";
  showDiagrams: boolean;
  showChords: boolean;
}

export function ChordRoll({
  uniqueChords,
  transposeVal,
  capoVal = 0,
  onChordClick,
  instrument,
  showDiagrams,
  showChords,
}: ChordRollProps) {
  const isGuitar = instrument === "guitar";
  const effectiveTranspose = transposeVal - (isGuitar ? capoVal : 0);

  // Transpose and fetch chord details
  const chordItems = useMemo(() => {
    return uniqueChords.map((chord) => {
      const transposed = transposeChord(chord, effectiveTranspose);
      const fingering = chordDictionary.getFingering(transposed);
      return {
        original: chord,
        transposed,
        fingering,
      };
    });
  }, [uniqueChords, effectiveTranspose]);

  if (uniqueChords.length === 0 || !showDiagrams || !showChords) return null;

  return (
    <div
      className="w-full select-none mb-6"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {isGuitar && capoVal > 0 && (
        <div className="px-4 mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/40">
            Capo na {capoVal}ª casa — acordes em formato relativo
          </span>
        </div>
      )}
      {/* Scrollable list integrated seamlessly into the background */}
      <div className="flex flex-row overflow-x-auto gap-6 py-2 px-4 no-scrollbar scroll-smooth">
        {chordItems.map((item, idx) => {
          const isPiano = instrument === "piano";

          return (
            <div
              key={idx}
              onClick={() => onChordClick?.(item.transposed)}
              className={`flex flex-col items-center p-2 transition-all cursor-pointer hover:opacity-85 shrink-0 ${
                isPiano ? "w-48" : "w-24"
              }`}
              title="Clique para ver detalhes do acorde"
            >
              {/* Chord Name Header */}
              <span className="text-xs font-black text-m3-primary dark:text-m3-dark-primary font-mono mb-1.5">
                {item.transposed}
              </span>

              {/* Diagram visual */}
              <div className="flex items-center justify-center flex-1 min-h-17.5">
                {item.fingering ? (
                  isPiano && item.fingering.piano ? (
                    <PianoDiagram
                      highlightKeys={item.fingering.piano.highlightKeys}
                    />
                  ) : !isPiano && item.fingering.guitar ? (
                    <GuitarDiagram
                      frets={item.fingering.guitar.frets}
                      fingers={item.fingering.guitar.fingers}
                      barre={item.fingering.guitar.barre}
                    />
                  ) : (
                    <div className="text-[10px] text-zinc-400 font-mono italic">
                      Sem visual
                    </div>
                  )
                ) : (
                  <div className="text-[10px] text-zinc-400 font-mono italic">
                    Não registado
                  </div>
                )}
              </div>

              {/* Notes list */}
              {item.fingering?.piano && (
                <span className="text-[9px] font-bold text-m3-secondary dark:text-m3-dark-secondary mt-1.5 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  {item.fingering.piano.notes.join(" - ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
