import { useMemo } from "react";
import "../instruments"; // ensure built-in instruments are registered
import { instrumentRegistry } from "../instruments/registry";

// Re-exported for backwards compatibility — these used to live here.
export { GuitarDiagram } from "../instruments/guitar";
export { PianoDiagram } from "../instruments/piano";

export interface ChordRollProps {
  uniqueChords: string[];
  onChordClick?: (chord: string) => void;
  /** Instrument id, e.g. "guitar", "piano", "ukulele", or any instrument
   *  registered via `instrumentRegistry.register(...)`. */
  instrument: string;
  showDiagrams: boolean;
  showChords: boolean;
}

export function ChordRoll({
  uniqueChords,
  onChordClick,
  instrument,
  showDiagrams,
  showChords,
}: ChordRollProps) {
  const profile = instrumentRegistry.get(instrument);
  const chordItems = useMemo(() => {
    if (!profile) return [];
    return uniqueChords.map((chord) => {
      const fingering = profile.getFingering(chord);
      return {
        original: chord,
        transposed: chord,
        fingering,
      };
    });
  }, [uniqueChords, profile]);

  if (
    uniqueChords.length === 0 ||
    !showDiagrams ||
    !showChords ||
    !profile
  )
    return null;

  const cardWidthClass = profile.layoutWidthClass ?? "w-24";

  return (
    <div
      className="w-full select-none mb-6"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Scrollable list integrated seamlessly into the background */}
      <div className="flex flex-row overflow-x-auto gap-6 py-2 px-4 no-scrollbar scroll-smooth">
        {chordItems.map((item, idx) => {
          const subLabel = item.fingering
            ? profile.getSubLabel?.(item.fingering.shape) ?? null
            : null;

          return (
            <div
              key={idx}
              onClick={() => onChordClick?.(item.transposed)}
              className={`flex flex-col items-center p-2 transition-all cursor-pointer hover:opacity-85 shrink-0 ${cardWidthClass}`}
              title="Clique para ver detalhes do acorde"
            >
              {/* Chord Name Header */}
              <span className="text-xs font-black text-m3-primary dark:text-m3-dark-primary font-mono mb-1.5">
                {item.transposed}
              </span>

              {/* Diagram visual */}
              <div className="flex items-center justify-center flex-1 min-h-17.5">
                {item.fingering ? (
                  profile.renderDiagram(item.fingering.shape)
                ) : (
                  <div className="text-[10px] text-zinc-400 font-mono italic">
                    {profile.unavailableLabel ?? "Não registado"}
                  </div>
                )}
              </div>

              {/* Secondary label (e.g. note names for piano) */}
              {subLabel && (
                <span className="text-[9px] font-bold text-m3-secondary dark:text-m3-dark-secondary mt-1.5 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                  {subLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
