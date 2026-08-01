/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BookOpen,
  Disc,
  Flame,
  HelpCircle,
  Key,
  Music,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  User,
  X,
} from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import YouTube, { type YouTubePlayer } from "react-youtube";
import { chordDictionary } from "../chordpro/chordDictionary";
import { LineAST, parseChordPro } from "../chordpro/parser";
import { transposeChord } from "../chordpro/transpose";
import { ChordRoll, GuitarDiagram, PianoDiagram } from "./ChordRoll";

// ---------------------------------------------------------------------------
// Helper: extract YouTube video ID from a URL or raw ID string
// ---------------------------------------------------------------------------
const YT_ID_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/;

function extractYoutubeId(urlOrId: string): string {
  const match = urlOrId.match(YT_ID_REGEX);
  return match?.[1] || urlOrId;
}

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
interface ChordProPreviewProps {
  content: string;
  showChords: boolean;

  /** Semitones to transpose. Defaults to 0. */
  transposeVal?: number;
  /** Callback to change transpose value. Required for the "Repor Tom" button. just the function to change transpose like if its a state the setTransposeVal */
  onTransposeChange?: (val: number) => void;

  /** Font size in px for the body content. */
  fontSize?: number;

  /** Instrument for chord diagrams. */
  instrument?: "guitar" | "piano";

  /** Whether to show chord diagrams in the ChordRoll. */
  showDiagrams?: boolean;

  /** Source file name shown in the footer. */
  fileName?: string;

  // --- YouTube mini player (optional controlled mode) ------------------------
  /** Whether the YouTube mini player bar is visible (controlled). */
  showYoutubePlayer?: boolean;
  /** Callback when the player visibility changes. Not used*/
  onShowYoutubePlayerChange?: (show: boolean) => void;
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------
const ChordProRenderer = React.memo(
  ({
    content,
    showChords,
    transposeVal = 0,
    onTransposeChange,
    fontSize,
    instrument = "guitar",
    showDiagrams = false,
    fileName,
    showYoutubePlayer: showYoutubePlayerProp,
    onShowYoutubePlayerChange,
  }: ChordProPreviewProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // ── YouTube internal state ──────────────────────────────────────────
    const [ytPlayerRef, setYtPlayerRef] = useState<YouTubePlayer | null>(null);
    const [isPlayingYoutube, setIsPlayingYoutube] = useState(false);
    const [isYoutubeRepeat, setIsYoutubeRepeat] = useState(false);
    const [showYoutubeInternal, setShowYoutubeInternal] = useState(false);

    // Support controlled mode for showYoutubePlayer
    const showYoutubePlayer = showYoutubePlayerProp ?? showYoutubeInternal;
    const setShowYoutubePlayer = useCallback(
      (val: boolean) => {
        setShowYoutubeInternal(val);
        onShowYoutubePlayerChange?.(val);
      },
      [onShowYoutubePlayerChange],
    );

    // Keep a ref to isYoutubeRepeat so the onEnd callback always sees the latest value
    const isYoutubeRepeatRef = useRef(isYoutubeRepeat);
    isYoutubeRepeatRef.current = isYoutubeRepeat;

    const parsedSong = useMemo(() => {
      return parseChordPro(content);
    }, [content]);

    const { metadata } = parsedSong;

    // Derive unique chords from the AST if the caller didn't provide them
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

    // ── Chord Dictionary Modal state ──────────────────────────────────
    const [selectedChord, setSelectedChord] = useState<string | null>(null);
    const [modalInstrument, setModalInstrument] = useState<"guitar" | "piano">(
      instrument,
    );

    const chordFingering = useMemo(() => {
      if (!selectedChord) return null;
      return chordDictionary.getFingering(selectedChord);
    }, [selectedChord]);

    const handleChordClick = (chord: string) => {
      setModalInstrument(instrument); // reset to caller's default each time
      setSelectedChord(chord);
    };

    return (
      <div className="relative flex flex-col flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 bg-slate-50 dark:bg-slate-950 print-page select-text leading-relaxed no-scrollbar relative"
        >
          <div className="max-w-3xl mx-auto print-song-card">
            {/* ───── Title and Metadata Header ───── */}
            <div className="mb-6 border-b border-neutral-100 dark:border-slate-800 pb-5 select-none">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                    {metadata.title}
                  </h2>

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
                  {metadata.key && (
                    <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-950/50 flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      Tom: {metadata.key}
                    </span>
                  )}
                  {metadata.originalKey && (
                    <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-lg border border-purple-100 dark:border-purple-950/50">
                      Tom Orig: {metadata.originalKey}
                    </span>
                  )}
                  {metadata.capo && metadata.capo !== "0" && (
                    <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-100 dark:border-amber-950/50">
                      Capo: {metadata.capo}ª casa
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

              {/* Informações Auxiliares (Copyright, Duration) */}
              {(metadata.copyright || metadata.duration) && (
                <div className="flex items-center gap-4 text-[10px] text-neutral-400 dark:text-neutral-500 mt-3 pt-3 border-t border-neutral-100 dark:border-slate-800/50">
                  {metadata.copyright && <span>© {metadata.copyright}</span>}
                  {metadata.duration && (
                    <span>Duração: {getDuration(metadata.duration)}</span>
                  )}
                </div>
              )}

              {/* ───── Transposition Indicator Banner ───── */}
              {transposeVal !== 0 && (
                <div className="mt-4 bg-indigo-50 dark:bg-indigo-950/40 text-xs px-3 py-2 rounded-xl text-indigo-700 dark:text-indigo-300 flex items-center justify-between border border-indigo-100 dark:border-indigo-950/50">
                  <span className="font-semibold">
                    Transposto para:{" "}
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border ml-1 text-sm">
                      {transposeChord(metadata.key || "C", transposeVal)}
                    </span>
                  </span>
                  {onTransposeChange && (
                    <button
                      onClick={() => onTransposeChange(0)}
                      className="text-[10px] font-bold hover:underline underline-offset-2 uppercase text-indigo-600 dark:text-indigo-400"
                    >
                      Repor Tom
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ───── Scrollable Chord Visualizer Row ───── */}
            <ChordRoll
              uniqueChords={resolvedUniqueChords}
              transposeVal={transposeVal}
              onChordClick={handleChordClick}
              instrument={instrument}
              showDiagrams={showDiagrams}
              showChords={showChords}
            />

            {/* ───── Custom AST Renderer ───── */}
            <div
              className="space-y-6 font-sans leading-relaxed text-sm select-text"
              style={fontSize ? { fontSize: `${fontSize}px` } : undefined}
            >
              {parsedSong.sections.map((section, secIdx) => {
                const isChorus = section.type === "chorus";
                const isBridge = section.type === "bridge";

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
                      data-section-index={secIdx}
                      className={`pl-4 md:pl-6 border-l-2 my-6 ${borderColor}`}
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
                              transpose={transposeVal}
                              onChordClick={handleChordClick}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                }

                if (section.type === "tab") {
                  return (
                    <div
                      key={secIdx}
                      data-section-index={secIdx}
                      className="bg-m3-sidebar dark:bg-m3-dark-sidebar p-4 rounded-xl border border-m3-border dark:border-m3-dark-border my-4 select-text"
                    >
                      <div className="text-[10px] font-bold text-m3-secondary dark:text-m3-dark-secondary uppercase tracking-wider mb-2 select-none">
                        {section.label || "Tablatura"}
                      </div>
                      <pre className="font-mono text-xs text-m3-text dark:text-m3-dark-text overflow-x-auto leading-relaxed whitespace-pre">
                        {section.lines
                          .map((line) => line.text || "")
                          .join("\n")}
                      </pre>
                    </div>
                  );
                }

                if (section.type === "comment") {
                  return (
                    <div
                      key={secIdx}
                      data-section-index={secIdx}
                      className="my-2 select-none pl-3 text-[11px] italic text-m3-secondary/70 dark:text-m3-dark-secondary/70"
                    >
                      {section.lines.map((l) => l.text).join(", ")}
                    </div>
                  );
                }

                // Standard verse / general lines fallback
                return (
                  <div
                    key={secIdx}
                    data-section-index={secIdx}
                    className="relative pl-6 sm:pl-8 border-l border-m3-border/30 dark:border-m3-dark-border/30 py-1.5 my-4"
                  >
                    {section.label && (
                      <div className="absolute -left-0.5 top-0 bottom-0 w-0.5 bg-m3-secondary/20 dark:bg-m3-dark-secondary/20 rounded-full"></div>
                    )}
                    {section.label && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-m3-text/60 dark:text-m3-dark-text/60 uppercase tracking-wider mb-3 select-none">
                        <Music className="w-3.5 h-3.5 text-m3-secondary/60 shrink-0" />
                        <span>{section.label}</span>
                      </div>
                    )}
                    <div className="space-y-4">
                      {section.lines.map((line, lineIdx) => (
                        <LineRenderer
                          key={lineIdx}
                          line={line}
                          showChords={showChords}
                          transpose={transposeVal}
                          onChordClick={handleChordClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ───── Footer info & copyrights ───── */}
            <div className="border-t border-neutral-100 dark:border-zinc-900 pt-6 mt-12 text-center text-[10px] text-neutral-400 dark:text-neutral-500 select-none space-y-1">
              {metadata.artist && <p>Artista: {metadata.artist}</p>}
              {metadata.composer && <p>Compositor: {metadata.composer}</p>}
              {metadata.copyright && <p>© Copyright: {metadata.copyright}</p>}
              {metadata.album && <p>Álbum: {metadata.album}</p>}
              {fileName && (
                <p className="mt-4">
                  Carregado a partir do ficheiro: {fileName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ───── Hidden react-youtube embed ───── */}
        {metadata.youtube && showYoutubePlayer && (
          <div className="hidden">
            <YouTube
              videoId={extractYoutubeId(metadata.youtube)}
              opts={{
                height: "0",
                width: "0",
                playerVars: {
                  autoplay: 1,
                  controls: 0,
                  disablekb: 1,
                },
              }}
              onReady={(e: { target: YouTubePlayer }) => {
                setYtPlayerRef(e.target);
                e.target.pauseVideo();
                setIsPlayingYoutube(false);
              }}
              onPlay={() => setIsPlayingYoutube(true)}
              onPause={() => setIsPlayingYoutube(false)}
              onEnd={(e: { target: YouTubePlayer }) => {
                if (isYoutubeRepeatRef.current) {
                  e.target.seekTo(0, true);
                  e.target.playVideo();
                } else {
                  setIsPlayingYoutube(false);
                }
              }}
            />
          </div>
        )}

        {/* ───── YouTube Spotify-like Mini Player Bottom Bar ───── */}
        {showYoutubePlayer && metadata.youtube && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-m3-card dark:bg-m3-dark-card border-t border-m3-border dark:border-m3-dark-border shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-30 px-4 flex items-center justify-between animate-in slide-in-from-bottom-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-m3-border/50">
                {metadata.youtube.match(YT_ID_REGEX) ||
                metadata.youtube.match(/^[^&?]+$/) ? (
                  <img
                    src={`https://img.youtube.com/vi/${extractYoutubeId(metadata.youtube)}/default.jpg`}
                    alt="YouTube Thumbnail"
                    className="w-full h-full object-cover scale-150"
                  />
                ) : (
                  <Disc className="w-5 h-5 m-auto mt-2.5 text-m3-secondary opacity-50" />
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-black text-m3-text dark:text-m3-dark-text truncate max-w-[120px]">
                  {metadata.title}
                </p>
                <p className="text-[9px] text-m3-secondary font-medium">
                  Áudio do YouTube
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={async () => {
                  if (!ytPlayerRef) return;
                  const t = await ytPlayerRef.getCurrentTime();
                  ytPlayerRef.seekTo(Math.max(0, t - 10), true);
                }}
                className="text-m3-secondary hover:text-m3-primary transition-colors active:scale-95"
                title="Retroceder 10s"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (!ytPlayerRef) return;
                  if (isPlayingYoutube) {
                    ytPlayerRef.pauseVideo();
                  } else {
                    ytPlayerRef.playVideo();
                  }
                }}
                className="w-10 h-10 rounded-full bg-m3-primary text-white flex items-center justify-center hover:opacity-95 shadow-md active:scale-95 transition-all"
              >
                {isPlayingYoutube ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-1" />
                )}
              </button>

              <button
                onClick={async () => {
                  if (!ytPlayerRef) return;
                  const t = await ytPlayerRef.getCurrentTime();
                  ytPlayerRef.seekTo(t + 10, true);
                }}
                className="text-m3-secondary hover:text-m3-primary transition-colors active:scale-95"
                title="Avançar 10s"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsYoutubeRepeat((r) => !r)}
                className={`ml-2 transition-colors active:scale-95 ${isYoutubeRepeat ? "text-m3-primary" : "text-m3-secondary hover:text-m3-text"}`}
                title="Repetir Áudio"
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  ytPlayerRef?.pauseVideo();
                  setIsPlayingYoutube(false);
                  setShowYoutubePlayer(false);
                }}
                className="p-2 text-m3-secondary hover:text-red-500 transition-colors"
                title="Fechar Player"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ───── Chord Fingering Dictionary Modal Overlay ───── */}
        {selectedChord && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
            <div className="bg-m3-card dark:bg-m3-dark-card border border-m3-border dark:border-m3-dark-border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-6 space-y-4 animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
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

              {/* Instrument switcher inside modal */}
              <div className="flex bg-m3-sidebar dark:bg-m3-dark-sidebar p-1 rounded-2xl border border-m3-border dark:border-m3-dark-border">
                <button
                  onClick={() => setModalInstrument("guitar")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    modalInstrument === "guitar"
                      ? "bg-m3-primary text-white shadow-sm"
                      : "text-m3-secondary dark:text-m3-dark-secondary hover:text-m3-text"
                  }`}
                >
                  Diagrama de Guitarra
                </button>
                <button
                  onClick={() => setModalInstrument("piano")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                    modalInstrument === "piano"
                      ? "bg-m3-primary text-white shadow-sm"
                      : "text-m3-secondary dark:text-m3-dark-secondary hover:text-m3-text"
                  }`}
                >
                  Teclado de Piano
                </button>
              </div>

              {/* Fingering render */}
              <div className="py-4 flex flex-col items-center justify-center min-h-[140px] border border-m3-border/30 dark:border-m3-dark-border/30 rounded-2xl bg-m3-sidebar/30 dark:bg-m3-dark-sidebar/10">
                {chordFingering ? (
                  modalInstrument === "guitar" && chordFingering.guitar ? (
                    <GuitarDiagram
                      frets={chordFingering.guitar.frets}
                      fingers={chordFingering.guitar.fingers}
                      barre={chordFingering.guitar.barre}
                    />
                  ) : modalInstrument === "piano" && chordFingering.piano ? (
                    <PianoDiagram
                      highlightKeys={chordFingering.piano.highlightKeys}
                    />
                  ) : (
                    <div className="text-center p-4">
                      <HelpCircle className="w-8 h-8 mx-auto text-amber-500 opacity-80 mb-2" />
                      <p className="text-xs text-m3-secondary dark:text-m3-dark-secondary font-medium">
                        O diagrama para{" "}
                        {modalInstrument === "guitar" ? "Guitarra" : "Piano"}{" "}
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

              {/* Modal Notes representation */}
              {chordFingering?.piano && (
                <div className="text-center font-mono text-xs text-m3-secondary dark:text-m3-dark-secondary bg-m3-sidebar dark:bg-m3-dark-sidebar py-2 rounded-xl">
                  Notas do Acorde:{" "}
                  <span className="font-bold text-m3-primary dark:text-m3-dark-primary">
                    {chordFingering.piano.notes.join(" - ")}
                  </span>
                </div>
              )}

              {/* Close button */}
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

const CommentRenderer = React.memo(({ line }: { line: LineAST }) => (
  <div className="text-xs text-slate-400 dark:text-slate-500 italic my-1">
    {line.text}
  </div>
));

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
    const segments = line.segments || [];

    return (
      <div className="flex flex-wrap items-end leading-relaxed">
        {segments.map((seg: any, segIdx: number) => {
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
    const hasTiming = measures.some((m) =>
      m.chords.some((c) => c.timing !== undefined && c.timing !== 1),
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
                        title={timing !== 1 ? `Duração: ${timing}x` : undefined}
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
    case "|:":
      return (
        <span className="flex items-center gap-0.5">
          <span className="text-indigo-400 dark:text-indigo-500 text-xs">
            𝄆
          </span>
        </span>
      );
    case ":|":
      return (
        <span className="flex items-center gap-0.5">
          <span className="text-indigo-400 dark:text-indigo-500 text-xs">
            𝄇
          </span>
        </span>
      );
    case "||":
      return <span className="font-black">‖</span>;
    default:
      return barline;
  }
}

export default ChordProRenderer;
