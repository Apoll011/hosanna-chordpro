import React from "react";
import { LineAST } from "../chordpro/parser";
import { transposeChord } from "../chordpro/transpose";

export const ChordSectionRenderer = React.memo(
  ({
    line,
    showChords,
    transpose = 0,
    onChordClick,
  }: {
    line: LineAST;
    showChords: boolean;
    transpose?: number;
    onChordClick?: (chord: string) => void;
  }) => {
    if (!showChords) return null;

    const measures = line.measures || [];
    const hasTiming = measures.some((m) =>
      m.chords.some((c) => c.timing !== undefined && c.timing !== 1)
    );

    return (
      <div className="flex items-stretch my-2 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden w-full max-w-max">
        {line.startBarline && (
          <div className="flex items-center px-2 bg-slate-100/50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800">
            <span className="text-slate-400 dark:text-slate-500 font-bold select-none text-sm tracking-widest">
              {renderBarline(line.startBarline)}
            </span>
          </div>
        )}

        <div className="flex flex-1 min-w-0">
          {measures.map((measure, mIdx) => {
            return (
              <React.Fragment key={mIdx}>
                <div className="flex-1 flex items-center px-3 py-2 min-w-12 gap-1">
                  {measure.chords.map((chordSeg, cIdx) => {
                    const transposed = transposeChord(
                      chordSeg.chord,
                      transpose,
                    );
                    const timing = chordSeg.timing ?? 1;

                    return (
                      <span
                        key={cIdx}
                        className="font-black text-[#0284c7] font-mono select-none text-[15px] cursor-pointer hover:opacity-80 flex items-center justify-center gap-1 transition-all"
                        style={{ flexGrow: timing, flexBasis: 0 }}
                        onClick={() => onChordClick?.(transposed)}
                        title={
                          timing !== 1
                            ? `Duração: ${timing}x`
                            : undefined
                        }
                      >
                        {transposed}
                        {hasTiming && timing !== 1 && (
                          <span className="text-[10px] font-bold text-indigo-400 dark:text-indigo-500 opacity-70">
                            {timing}×
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>

                {measure.endBarline && (
                  <div className="flex items-center px-1.5 bg-slate-100/50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 dark:text-slate-500 font-bold select-none text-sm tracking-widest">
                      {renderBarline(measure.endBarline)}
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  },
);

/**
 * Renders barline symbols with visual distinction:
 * - `||` → double bar (thicker)
 * - `|:` → repeat start
 * - `:|` → repeat end
 * - `|`  → normal bar
 */
function renderBarline(barline: string): React.ReactNode {
  switch (barline) {
    case '|:':
      return (
        <span className="flex items-center gap-0.5">
          <span className="text-indigo-400 dark:text-indigo-500 text-xs">𝄆</span>
        </span>
      );
    case ':|':
      return (
        <span className="flex items-center gap-0.5">
          <span className="text-indigo-400 dark:text-indigo-500 text-xs">𝄇</span>
        </span>
      );
    case '||':
      return <span className="font-black">‖</span>;
    default:
      return barline;
  }
}
