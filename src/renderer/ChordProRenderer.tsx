/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Disc,
  Flame,
  HelpCircle,
  Info,
  Key,
  Lightbulb,
  Music,
  User,
  X,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import "../instruments"; // ensure built-in instruments are registered
import { instrumentRegistry } from "../instruments/registry";
import {
  LineAST,
  SegmentAST,
  parseChordProDocument,
  selectVersion,
} from "../parser/parser";
import { transposeChord } from "../parser/transpose";
import { ChordRoll } from "./ChordRoll";

function getDuration(duration: string): string {
  const seconds = Number(duration);

  if (isNaN(seconds)) {
    return "00:00";
  } else {
    return `${Math.trunc(seconds / 60)}:${seconds % 60}`;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ChordProPreviewProps {
  content: string;
  showChords: boolean;
  transposeVal?: number;
  capoVal?: number;
  onTransposeChange?: (val: number) => void;
  onCapoChange?: (val: number) => void;
  twoColumnLayout?: boolean;
  fontSize?: number;
  /** Instrument id, e.g. "guitar", "piano", "ukulele", or any instrument
   *  registered via `instrumentRegistry.register(...)`. */
  instrument?: string;
  showDiagrams?: boolean;
  fileName?: string;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  selectedVersionId?: string;
  onSelectVersion?: (versionId: string) => void;
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------
const ChordProRenderer = React.memo(
  ({
    content,
    showChords,
    transposeVal = 0,
    capoVal = 0,
    onTransposeChange,
    onCapoChange,
    twoColumnLayout = false,
    fontSize,
    instrument = "guitar",
    showDiagrams = false,
    fileName,
    scrollContainerRef,
    selectedVersionId: selectedVersionIdProp,
    onSelectVersion,
  }: ChordProPreviewProps) => {
    const [internalVersionId, setInternalVersionId] =
      useState<string>("default");

    const activeVersionId = selectedVersionIdProp ?? internalVersionId;

    const parsedDocument = useMemo(() => {
      return parseChordProDocument(content);
    }, [content]);

    const activeVersion = useMemo(() => {
      return selectVersion(parsedDocument, activeVersionId);
    }, [parsedDocument, activeVersionId]);

    const parsedSong = useMemo(() => {
      return {
        id: activeVersion.id,
        name: activeVersion.name,
        metadata: activeVersion.metadata,
        sections: activeVersion.body,
      };
    }, [activeVersion]);

    const { metadata } = parsedSong;

    const handleVersionChange = useCallback(
      (id: string) => {
        setInternalVersionId(id);
        onSelectVersion?.(id);
      },
      [onSelectVersion],
    );

    const instrumentProfile = instrumentRegistry.get(instrument);
    const effectiveCapo = instrumentProfile?.supportsCapo ? capoVal : 0;
    const effectiveTranspose = transposeVal - effectiveCapo;

    const soundingKey = useMemo(() => {
      return transposeChord(metadata.key || "C", transposeVal);
    }, [metadata.key, transposeVal]);

    const renderedKey = useMemo(() => {
      return transposeChord(metadata.key || "C", effectiveTranspose);
    }, [metadata.key, effectiveTranspose]);

    const resolvedUniqueChords = useMemo(() => {
      const chords = new Set<string>();
      for (const section of parsedSong.sections) {
        for (const line of section.lines) {
          if (line.segments) {
            for (const seg of line.segments) {
              if (seg.chord) chords.add(seg.chord);
            }
          }
          if (line.measures) {
            for (const m of line.measures) {
              for (const c of m.chords) {
                if (c.chord) chords.add(c.chord);
              }
            }
          }
        }
      }
      return Array.from(chords);
    }, [parsedSong]);

    const [selectedChord, setSelectedChord] = useState<string | null>(null);
    const [modalInstrument, setModalInstrument] = useState<string>(
      instrument,
    );
    const availableInstruments = useMemo(
      () => instrumentRegistry.list(),
      [],
    );

    const modalFingering = useMemo(() => {
      if (!selectedChord) return null;
      const profile = instrumentRegistry.get(modalInstrument);
      return profile?.getFingering(selectedChord) ?? null;
    }, [selectedChord, modalInstrument]);

    const handleChordClick = (chord: string) => {
      setModalInstrument(instrument);
      setSelectedChord(chord);
    };

    return (
      <div className="relative flex flex-col flex-1 overflow-hidden h-full">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 bg-slate-50 dark:bg-slate-950 print-page select-text leading-relaxed no-scrollbar relative"
        >
          <div className="max-w-3xl mx-auto print-song-card">
            {/* ───── Title and Metadata Header ───── */}
            <div className="mb-6 border-b border-neutral-100 dark:border-slate-800 pb-5 select-none">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                      {metadata.title}
                    </h2>
                    {parsedDocument.variants.length > 0 && (
                      <div className="relative inline-flex items-center">
                        <select
                          value={activeVersion.id}
                          onChange={(e) => handleVersionChange(e.target.value)}
                          className="appearance-none bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold pl-2.5 pr-7 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-xs transition-colors"
                          title="Selecionar versão da música"
                        >
                          <option value="default">
                            {parsedDocument.default.name || "Padrão"}
                          </option>
                          {parsedDocument.variants.map((variant) => (
                            <option key={variant.id} value={variant.id}>
                              {variant.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-indigo-500 pointer-events-none absolute right-2" />
                      </div>
                    )}
                  </div>

                  {metadata.subtitle && (
                    <h3 className="text-[15px] font-medium text-neutral-600 dark:text-neutral-400 mt-1">
                      {metadata.subtitle}
                    </h3>
                  )}

                  {(metadata.artist || metadata.composer) && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-2 font-medium flex-wrap">
                      <User className="w-3.5 h-3.5 text-[#0284c7]" />
                      <span>
                        Por:{" "}
                        {[metadata.artist, metadata.composer]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    </div>
                  )}

                  {metadata.translator && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-2 font-medium flex-wrap">
                      <User className="w-3.5 h-3.5 text-[#0284c7]" />
                      <span>Traduzido por: {metadata.translator}</span>
                    </div>
                  )}

                  {metadata.album && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-1 font-medium">
                      <Disc className="w-3.5 h-3.5 text-[#0284c7]" />
                      <span>Álbum: {metadata.album}</span>
                    </div>
                  )}
                </div>

                {/* Floating Metadata Pills */}
                <div className="flex flex-wrap items-center gap-1.5 justify-end">
                  {metadata.songNumber && (
                    <span className="text-[10px] font-bold bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-400 px-2 py-1 rounded-lg border border-neutral-200 dark:border-slate-700">
                      Nº {metadata.songNumber}
                    </span>
                  )}
                  {(metadata.key || transposeVal !== 0) && (
                    <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-950/50 flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      Tom: {soundingKey}
                    </span>
                  )}
                  {effectiveCapo > 0 && (
                    <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-950/50">
                      Capo: {effectiveCapo}ª casa
                    </span>
                  )}
                  {effectiveCapo > 0 && (
                    <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-950/50">
                      Formato: {renderedKey}
                    </span>
                  )}
                  {metadata.originalKey && (
                    <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-lg border border-purple-100 dark:border-purple-950/50">
                      Tom Orig: {metadata.originalKey}
                    </span>
                  )}
                  {metadata.capo &&
                    metadata.capo !== "0" &&
                    effectiveCapo === 0 && (
                      <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-950/50">
                        Capo Orig: {metadata.capo}ª casa
                      </span>
                    )}
                  {metadata.tempo && (
                    <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-950/50 flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      {metadata.tempo} BPM
                    </span>
                  )}
                  {metadata.time && (
                    <span className="text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 px-2.5 py-1 rounded-lg border border-cyan-100 dark:border-cyan-950/50">
                      {metadata.time}
                    </span>
                  )}
                  {metadata.ccli && (
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      CCLI: {metadata.ccli}
                    </span>
                  )}
                </div>
              </div>

              {(metadata.copyright || metadata.duration) && (
                <div className="flex items-center gap-4 text-[10px] text-neutral-400 dark:text-neutral-500 mt-3 pt-3 border-t border-neutral-100 dark:border-slate-800/50">
                  {metadata.copyright && <span>© {metadata.copyright}</span>}
                  {metadata.duration && (
                    <span>Duração: {getDuration(metadata.duration)}</span>
                  )}
                </div>
              )}

              {(transposeVal !== 0 || effectiveCapo !== 0) && (
                <div className="mt-4 bg-indigo-50 dark:bg-indigo-950/40 text-xs px-3 py-2 rounded-xl text-indigo-700 dark:text-indigo-300 flex items-center justify-between border border-indigo-100 dark:border-indigo-950/50 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      Tom:{" "}
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border ml-0.5 text-xs">
                        {soundingKey}
                      </span>
                    </span>
                    {effectiveCapo > 0 && (
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        • Capo:{" "}
                        <span className="text-amber-700 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 text-xs ml-0.5">
                          {effectiveCapo}ª casa ({renderedKey})
                        </span>
                      </span>
                    )}
                  </div>
                  {(onTransposeChange || onCapoChange) && (
                    <button
                      type="button"
                      onClick={() => {
                        onTransposeChange?.(0);
                        onCapoChange?.(0);
                      }}
                      className="text-[10px] font-bold hover:underline underline-offset-2 uppercase text-indigo-600 dark:text-indigo-400 cursor-pointer"
                    >
                      Repor Tom / Capo
                    </button>
                  )}
                </div>
              )}
            </div>

            <ChordRoll
              uniqueChords={resolvedUniqueChords}
              transposeVal={transposeVal}
              capoVal={effectiveCapo}
              onChordClick={handleChordClick}
              instrument={instrument}
              showDiagrams={showDiagrams}
              showChords={showChords}
            />

            {/* ───── Custom AST Renderer ───── */}
            <div
              className={`font-sans leading-relaxed text-sm select-text ${
                twoColumnLayout
                  ? "columns-1 sm:columns-2 gap-8 space-y-6 [column-fill:_balance]"
                  : "space-y-6"
              }`}
              style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
            >
              {parsedSong.sections.map((section, secIdx) => {
                const isChorus = section.type === "chorus";
                const isBridge = section.type === "bridge";

                // Suporte à diretiva {new_song}
                if (section.type === "new_song") {
                  return (
                    <div
                      key={secIdx}
                      className="w-full my-12 flex items-center justify-center select-none break-before-column"
                    >
                      <div className="flex-1 border-t-2 border-slate-200 dark:border-slate-800 border-dashed"></div>
                      <Music className="w-5 h-5 mx-4 text-slate-300 dark:text-slate-700" />
                      <div className="flex-1 border-t-2 border-slate-200 dark:border-slate-800 border-dashed"></div>
                    </div>
                  );
                }

                // Grid (Instrumental) Renderer com alinhamento perfeito de compassos
                if (section.type === "grid" && showChords) {
                  return (
                    <div
                      key={secIdx}
                      className={`pl-3 my-6 border-l-2 border-slate-200 dark:border-slate-800 ${
                        twoColumnLayout
                          ? "break-inside-avoid-column inline-block w-full"
                          : ""
                      }`}
                    >
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5 select-none">
                        {section.label || "Instrumental"}
                        {section.repeat && (
                          <span> · repetir {section.repeat}×</span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {section.lines.map((line, lineIdx) => (
                          <ChordSectionRenderer
                            key={lineIdx}
                            line={line}
                            showChords={showChords}
                            transpose={effectiveTranspose}
                            onChordClick={handleChordClick}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                // Verse / Chorus / Bridge
                if (isChorus || isBridge) {
                  const borderColor = isChorus
                    ? "border-m3-primary/30 dark:border-m3-dark-primary/30"
                    : "border-amber-500/30 dark:border-amber-400/30";
                  const labelColor = isChorus
                    ? "text-m3-text dark:text-m3-dark-text"
                    : "text-amber-700 dark:text-amber-400";
                  const iconColor = isChorus
                    ? "text-m3-secondary"
                    : "text-amber-500";

                  return (
                    <div
                      key={secIdx}
                      className={`pl-4 md:pl-6 border-l-2 my-6 ${borderColor} ${
                        twoColumnLayout
                          ? "break-inside-avoid-column inline-block w-full"
                          : ""
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider mb-3 select-none ${labelColor}`}
                      >
                        <Music
                          className={`w-3.5 h-3.5 shrink-0 ${iconColor}`}
                        />
                        <span>
                          {section.label || (isChorus ? "Refrão" : "Ponte")}
                        </span>

                        {/* Indicador visual de {repeat} */}
                        {section.repeat && (
                          <span
                            className={`ml-2 px-2 py-0.5 rounded text-[10px] font-black border ${
                              isChorus
                                ? "bg-blue-100/50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300"
                                : "bg-amber-100/50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300"
                            }`}
                          >
                            {section.repeat}x
                          </span>
                        )}
                      </div>
                      <div className="space-y-4 font-medium">
                        {section.lines.length === 0 ? (
                          <div
                            className={`text-xs italic my-1 opacity-70 ${labelColor}`}
                          >
                            (Repete o refrão)
                          </div>
                        ) : (
                          section.lines.map((line, lineIdx) => (
                            <LineRenderer
                              key={lineIdx}
                              line={line}
                              showChords={showChords}
                              transpose={effectiveTranspose}
                              onChordClick={handleChordClick}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                }

                // Tablaturas melhoradas
                if (section.type === "tab" && showChords) {
                  return (
                    <div
                      key={secIdx}
                      className={`bg-slate-900 p-4 pt-6 rounded-xl shadow-inner border border-slate-800 my-6 select-text relative group ${
                        twoColumnLayout
                          ? "break-inside-avoid-column inline-block w-full"
                          : ""
                      }`}
                    >
                      <div className="absolute top-0 left-4 -translate-y-1/2 bg-slate-800 text-[10px] font-bold text-slate-300 uppercase tracking-widest px-2 py-0.5 rounded border border-slate-700 shadow-sm select-none">
                        {section.label || "Tablatura"}
                      </div>
                      <div className="overflow-x-auto no-scrollbar">
                        <pre className="font-mono text-[13px] md:text-sm text-slate-300 leading-relaxed whitespace-pre drop-shadow-sm">
                          {section.lines
                            .map((line) => line.text || "")
                            .join("\n")}
                        </pre>
                      </div>
                    </div>
                  );
                }

                if (section.type === "comment") {
                  return (
                    <div
                      key={secIdx}
                      className={`my-2 select-none pl-3 text-[11px] italic text-m3-secondary/70 dark:text-m3-dark-secondary/70 ${twoColumnLayout ? "break-inside-avoid-column inline-block w-full" : ""}`}
                    >
                      {section.lines.map((l) => l.text).join(", ")}
                    </div>
                  );
                }

                return (
                  <div
                    key={secIdx}
                    className={`relative pl-6 sm:pl-8 border-l border-m3-border/30 dark:border-m3-dark-border/30 py-1.5 my-4 ${
                      twoColumnLayout
                        ? "break-inside-avoid-column inline-block w-full"
                        : ""
                    }`}
                  >
                    {section.label && (
                      <div className="absolute -left-0.5 top-0 bottom-0 w-0.5 bg-m3-secondary/20 dark:bg-m3-dark-secondary/20 rounded-full"></div>
                    )}
                    {section.label && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-m3-text/60 dark:text-m3-dark-text/60 uppercase tracking-wider mb-3 select-none">
                        <Music className="w-3.5 h-3.5 text-m3-secondary/60 shrink-0" />
                        <span>{section.label}</span>

                        {section.repeat && (
                          <span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-black border border-slate-200 dark:border-slate-700">
                            {section.repeat}x
                          </span>
                        )}
                      </div>
                    )}
                    <div className="space-y-4">
                      {section.lines.map((line, lineIdx) => (
                        <LineRenderer
                          key={lineIdx}
                          line={line}
                          showChords={showChords}
                          transpose={effectiveTranspose}
                          onChordClick={handleChordClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ───── Footer info & copyrights ───── */}
            <div className="border-t border-neutral-100 dark:border-zinc-900 pt-6 mt-12 pb-12 text-center text-[10px] text-neutral-400 dark:text-neutral-500 select-none space-y-1.5">
              {metadata.artist && <p>Artista Original: {metadata.artist}</p>}
              {metadata.composer && <p>Compositor: {metadata.composer}</p>}
              {metadata.lyricist && <p>Letra: {metadata.lyricist}</p>}
              {metadata.arranger && <p>Arranjo: {metadata.arranger}</p>}
              {metadata.year && <p>Ano: {metadata.year}</p>}
              {metadata.originalKey && (
                <p>Tom Original: {metadata.originalKey}</p>
              )}

              <div className="pt-2 mt-2 border-t border-neutral-50/50 dark:border-zinc-900/50 inline-block">
                {metadata.copyright && <p>© Copyright: {metadata.copyright}</p>}
                {metadata.ccli && <p>CCLI: {metadata.ccli}</p>}
              </div>

              {fileName && (
                <p className="mt-4 opacity-50">Ficheiro base: {fileName}</p>
              )}
            </div>
          </div>
        </div>

        {selectedChord && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
            <div className="bg-m3-card dark:bg-m3-dark-card border border-m3-border dark:border-m3-dark-border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-m3-primary dark:text-m3-dark-primary" />
                  <h3 className="text-sm font-black text-m3-text dark:text-m3-dark-text uppercase tracking-wider">
                    Dicionário: {selectedChord}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedChord(null)}
                  className="p-1 rounded-full hover:bg-m3-hover dark:hover:bg-m3-dark-hover text-m3-secondary dark:text-m3-dark-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex bg-m3-sidebar dark:bg-m3-dark-sidebar p-1 rounded-2xl border border-m3-border dark:border-m3-dark-border">
                {availableInstruments.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => setModalInstrument(profile.id)}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                      modalInstrument === profile.id
                        ? "bg-m3-primary text-white shadow-sm"
                        : "text-m3-secondary dark:text-m3-dark-secondary hover:text-m3-text"
                    }`}
                  >
                    {profile.displayName}
                  </button>
                ))}
              </div>

              <div className="py-4 flex flex-col items-center justify-center min-h-[140px] border border-m3-border/30 dark:border-m3-dark-border/30 rounded-2xl bg-m3-sidebar/30 dark:bg-m3-dark-sidebar/10">
                {modalFingering ? (
                  instrumentRegistry
                    .get(modalInstrument)
                    ?.renderDiagram(modalFingering.shape) ?? (
                    <div className="text-center p-4">
                      <HelpCircle className="w-8 h-8 mx-auto text-amber-500 opacity-80 mb-2" />
                      <p className="text-xs text-m3-secondary dark:text-m3-dark-secondary font-medium">
                        O diagrama para{" "}
                        {instrumentRegistry.get(modalInstrument)?.displayName}{" "}
                        não pôde ser calculado.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <HelpCircle className="w-8 h-8 mx-auto text-amber-500 opacity-80" />
                    <p className="text-xs text-m3-text dark:text-m3-dark-text font-bold">
                      Acorde &quot;{selectedChord}&quot; não registado
                    </p>
                    <p className="text-[10px] text-m3-secondary dark:text-m3-dark-secondary max-w-[200px] leading-normal">
                      Este acorde não se encontra no nosso dicionário estrito,
                      mas pode tocá-lo com as notas de acompanhamento habituais.
                    </p>
                  </div>
                )}
              </div>

              {modalFingering && (
                <>
                  {(() => {
                    const subLabel = instrumentRegistry
                      .get(modalInstrument)
                      ?.getSubLabel?.(modalFingering.shape);
                    if (!subLabel) return null;
                    return (
                      <div className="text-center font-mono text-xs text-m3-secondary dark:text-m3-dark-secondary bg-m3-sidebar dark:bg-m3-dark-sidebar py-2 rounded-xl">
                        Notas do Acorde:{" "}
                        <span className="font-bold text-m3-primary dark:text-m3-dark-primary">
                          {subLabel}
                        </span>
                      </div>
                    );
                  })()}
                </>
              )}

              <button
                onClick={() => setSelectedChord(null)}
                className="w-full bg-m3-sidebar dark:bg-m3-dark-sidebar hover:bg-m3-hover dark:hover:bg-m3-dark-hover text-m3-text dark:text-m3-dark-text text-xs py-3 rounded-2xl border border-m3-border dark:border-m3-dark-border font-bold active:scale-95 transition-all"
              >
                Voltar ao Cântico
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Render Dispatchers & Sub-components
// ---------------------------------------------------------------------------

interface LineRendererProps {
  line: LineAST;
  showChords: boolean;
  transpose?: number;
  onChordClick?: (chord: string) => void;
}

const LineRenderer = React.memo(
  ({ line, showChords, transpose = 0, onChordClick }: LineRendererProps) => {
    if (line.type === "empty") return <div className="h-2"></div>;
    if (line.type === "comment") return <CommentRenderer line={line} />;
    if (line.type === "comment_italic")
      return <CommentItalicRenderer line={line} />;
    if (line.type === "comment_box") return <CommentBoxRenderer line={line} />;

    if (line.type === "chord-section")
      return (
        <ChordSectionRenderer
          line={line}
          showChords={showChords}
          transpose={transpose}
          onChordClick={onChordClick}
        />
      );

    return (
      <LyricsRenderer
        line={line}
        showChords={showChords}
        transpose={transpose}
        onChordClick={onChordClick}
      />
    );
  },
);

// Plain, unobtrusive comment (`{comment}` / `{c}`) — small, muted, upright text.
const CommentRenderer = React.memo(({ line }: { line: LineAST }) => (
  <div className="text-xs text-slate-400 dark:text-slate-500 my-1">
    {line.text}
  </div>
));

// Italic comment (`{comment_italic}` / `{ci}`) — same weight as a plain
// comment but visually distinct so the two directives don't collapse into
// one look.
const CommentItalicRenderer = React.memo(({ line }: { line: LineAST }) => (
  <div className="text-xs text-slate-400 dark:text-slate-500 italic my-1">
    {line.text}
  </div>
));

/** Visual styles available to `{comment_box}` (and, via `|style=`, to
 *  `{comment}`/`{comment_italic}`). Adding a new style here is enough to
 *  make it usable from ChordPro source — no parser changes required. */
const COMMENT_BOX_STYLES: Record<
  string,
  { container: string; iconClass: string; Icon: typeof Info }
> = {
  info: {
    container:
      "bg-amber-100 dark:bg-amber-900/30 border-l-4 border-amber-500 text-amber-900 dark:text-amber-200",
    iconClass: "text-amber-600 dark:text-amber-500",
    Icon: Info,
  },
  warning: {
    container:
      "bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-900 dark:text-red-200",
    iconClass: "text-red-600 dark:text-red-500",
    Icon: AlertTriangle,
  },
  success: {
    container:
      "bg-emerald-100 dark:bg-emerald-900/30 border-l-4 border-emerald-500 text-emerald-900 dark:text-emerald-200",
    iconClass: "text-emerald-600 dark:text-emerald-500",
    Icon: CheckCircle2,
  },
  tip: {
    container:
      "bg-sky-100 dark:bg-sky-900/30 border-l-4 border-sky-500 text-sky-900 dark:text-sky-200",
    iconClass: "text-sky-600 dark:text-sky-500",
    Icon: Lightbulb,
  },
};

const CommentBoxRenderer = React.memo(({ line }: { line: LineAST }) => {
  const style = COMMENT_BOX_STYLES[line.style ?? "info"] ?? COMMENT_BOX_STYLES.info;
  const { Icon } = style;
  return (
    <div
      className={`${style.container} p-2.5 my-2.5 rounded-r-md text-xs font-bold tracking-wide flex items-center gap-2 shadow-sm max-w-fit`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${style.iconClass}`} />
      <span>{line.text}</span>
    </div>
  );
});

const LyricsRenderer = React.memo(
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
    const segments: SegmentAST[] = line.segments || [];

    return (
      <div className="flex flex-wrap items-end leading-relaxed">
        {segments.map((seg, segIdx) => {
          const hasChord = !!seg.chord;
          const transposed = hasChord
            ? transposeChord(seg.chord, transpose)
            : "";

          return (
            <div
              key={segIdx}
              className="flex flex-col justify-end relative select-text"
              style={{
                minWidth:
                  hasChord && showChords
                    ? `${Math.max(1.1, transposed.length * 0.65)}em`
                    : undefined,
              }}
            >
              {showChords && hasChord && (
                <span
                  className="font-black text-[#0284c7] font-mono select-none pr-1 inline-block pb-0.5 transition-all cursor-pointer hover:opacity-80"
                  style={{ fontSize: "0.85em", lineHeight: "1" }}
                  onClick={() => onChordClick?.(transposed)}
                >
                  {transposed}
                </span>
              )}
              <span className="text-slate-800 dark:text-slate-200 whitespace-pre">
                {seg.text || "\u00A0"}
              </span>
            </div>
          );
        })}
      </div>
    );
  },
);

const ChordSectionRenderer = React.memo(
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

    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {line.startBarline && renderBarline(line.startBarline)}

        {measures.map((measure, mIdx) => (
          <React.Fragment key={mIdx}>
            <span className="flex items-baseline gap-1.5">
              {measure.chords.map((chordSeg, cIdx) => {
                const transposed = transposeChord(chordSeg.chord, transpose);
                const timing = chordSeg.timing ?? 1;

                return (
                  <span
                    key={cIdx}
                    className="font-mono text-[14px] text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                    onClick={() => onChordClick?.(transposed)}
                    title={timing !== 1 ? `Duração: ${timing}x` : undefined}
                  >
                    {transposed}
                    {timing !== 1 && (
                      <sub className="text-[9px] text-slate-400 dark:text-slate-600 ml-px">
                        {timing}×
                      </sub>
                    )}
                  </span>
                );
              })}
            </span>
            {measure.endBarline && renderBarline(measure.endBarline)}
          </React.Fragment>
        ))}
      </div>
    );
  },
);

function renderBarline(barline: string): React.ReactNode {
  const wrapperStyle =
    "flex items-center justify-center flex-shrink-0 select-none";
  const repeatStyle =
    "text-indigo-400 dark:text-indigo-500 text-[18px] leading-none";
  const normalStyle =
    "text-slate-300 dark:text-slate-600 font-black text-[16px] leading-none";

  switch (barline) {
    case "|:":
      return (
        <span className={wrapperStyle} title="Start repeat">
          <span className={repeatStyle}>𝄆</span>
        </span>
      );
    case ":|":
      return (
        <span className={wrapperStyle} title="End repeat">
          <span className={repeatStyle}>𝄇</span>
        </span>
      );
    case "||":
      return (
        <span className={wrapperStyle} title="Double barline">
          <span className={normalStyle}>‖</span>
        </span>
      );
    case "|]":
      return (
        <span className={wrapperStyle} title="End of piece">
          <span className={normalStyle}>𝄂</span>
        </span>
      );
    case "|":
      return (
        <span className={wrapperStyle}>
          <span className={normalStyle}>|</span>
        </span>
      );
    default:
      return (
        <span
          className={`${wrapperStyle} text-slate-400 dark:text-slate-500 text-xs font-bold tracking-widest`}
        >
          {barline}
        </span>
      );
  }
}

export { ChordProRenderer };
export default ChordProRenderer;
