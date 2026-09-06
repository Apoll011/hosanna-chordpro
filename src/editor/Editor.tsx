import { ArrowRightLeft, Music } from "lucide-react";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { IAceEditorProps } from "react-ace";
import { registerFormatShortcut } from "../formatter/integrations/ace";
import type { FormatResult } from "../formatter/types";
import { ChordFinder } from "./ChordFinder";
import { registerChordproMode } from "./mode-chordpro";
import { registerChordproSnippets } from "./snippets-chordpro";

let aceLoaderPromise: Promise<React.ComponentType<IAceEditorProps>> | null =
  null;

/**
 * Preloads Ace Editor, its themes, and ChordPro syntax modes in the background.
 * Call this after your app finishes loading or in an idle callback so that clicking
 * a song or opening the editor renders immediately with zero delay.
 */
export function preloadEditor(): Promise<React.ComponentType<IAceEditorProps>> {
  if (!aceLoaderPromise) {
    aceLoaderPromise = (async () => {
      try {
        // 1. First import and initialize ace-builds
        const aceModule = await import("ace-builds");
        const ace = (aceModule as any)?.default || aceModule;

        if (typeof window !== "undefined" && ace) {
          (window as any).ace = ace;
        }

        // 2. Once window.ace is defined, import react-ace and all themes/extensions
        const [reactAceModule] = await Promise.all([
          import("react-ace"),
          import("ace-builds/src-noconflict/ext-language_tools"),
          import("ace-builds/src-noconflict/theme-dracula"),
          import("ace-builds/src-noconflict/theme-github"),
          import("ace-builds/src-noconflict/theme-monokai"),
          import("ace-builds/src-noconflict/theme-solarized_dark"),
          import("ace-builds/src-noconflict/theme-solarized_light"),
          import("ace-builds/src-noconflict/theme-textmate"),
          import("ace-builds/src-noconflict/theme-tomorrow"),
          import("ace-builds/src-noconflict/theme-tomorrow_night"),
        ]);

        const AceEditor = (reactAceModule as any)?.default || reactAceModule;

        if (ace) {
          await registerChordproMode(ace);
          await registerChordproSnippets(ace);

          if (typeof ace.require === "function") {
            try {
              const langTools = ace.require("ace/ext/language_tools");
              if (
                langTools &&
                typeof langTools.addCompleter === "function" &&
                typeof window !== "undefined" &&
                !(window as any)._chordproCompleterRegistered
              ) {
                const chordCompleter = {
                  getCompletions: (
                    editor: any,
                    _session: any,
                    _pos: any,
                    _prefix: string,
                    callback: any,
                  ) => {
                    if (!editor || typeof editor.getValue !== "function") {
                      callback(null, []);
                      return;
                    }
                    const text = editor.getValue();
                    const chords = ChordFinder.getChords(text);
                    callback(null, chords);
                  },
                };

                langTools.addCompleter(chordCompleter);
                (window as any)._chordproCompleterRegistered = true;
              }
            } catch {
              // Ignore completer registration errors
            }
          }
        }

        if (!AceEditor) {
          throw new Error("Failed to resolve AceEditor component");
        }

        return AceEditor;
      } catch (error) {
        console.error("Failed to load Ace editor:", error);
        aceLoaderPromise = null; // allow retry if failed
        const ErrorFallback: React.FC<any> = () => (
          <div className="w-full h-full flex items-center justify-center p-4 text-center text-sm text-red-500 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/30">
            Failed to load code editor. Please ensure &apos;ace-builds&apos; and
            &apos;react-ace&apos; are installed.
          </div>
        );
        return ErrorFallback;
      }
    })();
  }
  return aceLoaderPromise;
}

// Dynamically lazy-load AceEditor and all Ace themes/extensions on demand
const LazyAce = React.lazy<React.ComponentType<IAceEditorProps>>(async () => {
  const Component = await preloadEditor();
  return { default: Component };
});

// ---------------------------------------------------------------------------
// Wrap-in-section helper
// ---------------------------------------------------------------------------
type SectionType = "verse" | "chorus" | "bridge";

const SECTION_LABELS: Record<
  SectionType,
  { start: string; end: string; defaultLabel: string }
> = {
  verse: {
    start: "start_of_verse",
    end: "end_of_verse",
    defaultLabel: "Verso",
  },
  chorus: {
    start: "start_of_chorus",
    end: "end_of_chorus",
    defaultLabel: "Refrão",
  },
  bridge: {
    start: "start_of_bridge",
    end: "end_of_bridge",
    defaultLabel: "Ponte",
  },
};

/** Count existing verses in the full document text to determine next verse number. */
function countVerses(text: string): number {
  const matches = text.match(/\{start_of_verse[^}]*\}/gi);
  return matches ? matches.length : 0;
}

function wrapSelectionInSection(editor: any, sectionType: SectionType) {
  if (!editor || !editor.getSelection || !editor.session) return;
  if (
    typeof editor.session.getTextRange !== "function" ||
    typeof editor.session.replace !== "function"
  ) {
    return;
  }

  const selection = editor.getSelection();
  if (!selection || typeof selection.getRange !== "function") return;

  const range = selection.getRange();
  if (!range) return;

  const selectedText = editor.session.getTextRange(range);
  if (!selectedText || !selectedText.trim()) return;

  const info = SECTION_LABELS[sectionType];

  let label = info.defaultLabel;
  if (sectionType === "verse" && typeof editor.getValue === "function") {
    const currentText = editor.getValue();
    const existingCount = countVerses(currentText);
    label = `${info.defaultLabel} ${existingCount + 1}`;
  }

  const wrapped = `{${info.start}: ${label}}\n${selectedText}\n{${info.end}}`;

  editor.session.replace(range, wrapped);
}

// ---------------------------------------------------------------------------
// Transpose helpers
// ---------------------------------------------------------------------------
const ALL_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const NOTE_MAP: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};
const SHARPS_SCALE = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const FLATS_SCALE = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

function transposeChordInline(chord: string, semitones: number): string {
  if (chord.includes("/")) {
    return chord
      .split("/")
      .map((p) => transposeChordInline(p.trim(), semitones))
      .join("/");
  }
  const match = chord.match(/^([A-G][#b]?)/);
  if (!match) return chord;
  const note = match[1];
  const suffix = chord.slice(note.length);
  const val = NOTE_MAP[note];
  if (val === undefined) return chord;
  const newVal = (val + semitones + 120) % 12;
  const preferFlats = chord.includes("b");
  return (preferFlats ? FLATS_SCALE : SHARPS_SCALE)[newVal] + suffix;
}

function transposeText(text: string, semitones: number): string {
  if (semitones === 0) return text;
  return text.replace(
    /\[([^\]]+)\]/g,
    (_match, chord) => `[${transposeChordInline(chord, semitones)}]`,
  );
}

function getKeyFromText(text: string): string | null {
  const match = text.match(/\{key:\s*([^}]+)\}/i);
  return match ? match[1].trim() : null;
}

function getOriginalKeyFromText(text: string): string | null {
  const match = text.match(/\{original_key:\s*([^}]+)\}/i);
  return match ? match[1].trim() : null;
}

function getSemitones(fromNote: string, toNote: string): number {
  const from = NOTE_MAP[fromNote];
  const to = NOTE_MAP[toNote];
  if (from === undefined || to === undefined) return 0;
  return (to - from + 12) % 12;
}

// ---------------------------------------------------------------------------
// Transpose Modal
// ---------------------------------------------------------------------------
interface TransposeModalProps {
  visible: boolean;
  currentText: string;
  onConfirm: (newText: string, targetNote: string) => void;
  onClose: () => void;
}

function TransposeModal({
  visible,
  currentText,
  onConfirm,
  onClose,
}: TransposeModalProps) {
  const currentKey =
    getKeyFromText(currentText) ?? getOriginalKeyFromText(currentText) ?? "C";
  const [targetNote, setTargetNote] = useState(currentKey);

  useEffect(() => {
    if (visible) setTargetNote(currentKey);
  }, [visible, currentKey]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (visible) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [visible, onClose]);

  if (!visible) return null;

  const semitones = getSemitones(currentKey, targetNote);
  const previewText = transposeText(currentText, semitones);

  const handleConfirm = () => {
    onConfirm(previewText, targetNote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            Transpor Tonalidade
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4 overflow-y-auto flex-1">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Tom Atual
              </label>
              <div className="h-11 px-3 flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300">
                {currentKey}
              </div>
            </div>

            <div className="mt-5 shrink-0 w-8 h-8 rounded-full bg-m3-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="w-3.5 h-3.5 text-m3-primary" />
            </div>

            <div className="flex-1">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Novo Tom
              </label>
              <select
                value={targetNote}
                onChange={(e) => setTargetNote(e.target.value)}
                className="w-full h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-m3-primary"
              >
                {ALL_NOTES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {semitones !== 0 && (
            <span className="inline-flex self-start text-[10px] font-black uppercase tracking-wider text-m3-primary bg-sky-50 dark:bg-sky-950 px-2 py-1 rounded-md border border-sky-200 dark:border-sky-800">
              {semitones > 0 ? `+${semitones}` : semitones} semitons
            </span>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              <Music className="w-3 h-3" />
              Pré-visualização
            </label>
            <pre className="text-xs bg-slate-50 dark:bg-slate-950 rounded-xl p-3 overflow-auto max-h-[200px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 whitespace-pre-wrap font-mono">
              {previewText}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 h-10 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 h-10 text-xs font-bold rounded-xl bg-m3-primary hover:opacity-90 text-white transition-opacity cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Transpor
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context menu component
// ---------------------------------------------------------------------------
interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

const MENU_ITEMS: { type: SectionType; label: string; shortcut: string }[] = [
  { type: "verse", label: "Envolver em Verso", shortcut: "Alt+V" },
  { type: "chorus", label: "Envolver em Refrão", shortcut: "Alt+R" },
  { type: "bridge", label: "Envolver em Ponte", shortcut: "Alt+B" },
];

function EditorContextMenu({
  state,
  onAction,
  onTranspose,
  onClose,
}: {
  state: ContextMenuState;
  onAction: (type: SectionType) => void;
  onTranspose: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (state.visible) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state.visible, onClose]);

  if (!state.visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[240px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: state.x, top: state.y }}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider select-none border-b border-zinc-100 dark:border-zinc-800 mb-1">
        Envolver seleção em
      </div>
      {MENU_ITEMS.map((item) => (
        <button
          key={item.type}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          onClick={() => {
            onAction(item.type);
            onClose();
          }}
        >
          <span className="flex-1 font-medium">{item.label}</span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            {item.shortcut}
          </span>
        </button>
      ))}
      <div className="border-t border-zinc-100 dark:border-zinc-800 mt-1 pt-1">
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-700 dark:text-zinc-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          onClick={() => {
            onTranspose();
            onClose();
          }}
        >
          <span className="flex-1 font-medium">Transpor</span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
            Alt+T
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Editor component
// ---------------------------------------------------------------------------
export interface EditorSettings {
  theme?: string;
  fontSize?: number;
  wordWrap?: boolean;
  showLineNumbers?: boolean;
}

const DEFAULT_EDITOR_SETTINGS: Required<EditorSettings> = {
  theme: "textmate",
  fontSize: 14,
  wordWrap: true,
  showLineNumbers: true,
};

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  /**
   * Called after a format operation (Ctrl/Cmd+Shift+F) completes.
   * Provides the FormatResult so the consumer can show toast/notification feedback.
   */
  onFormat?: (result: FormatResult) => void;
  settings?: EditorSettings;
  mode?: string;
  readOnly?: boolean;
  fallback?: React.ReactNode;
}

export function Editor({
  value,
  onChange,
  onSave,
  onFormat,
  settings,
  mode = "chordpro",
  readOnly = false,
  fallback = null,
}: EditorProps) {
  const activeSettings = {
    ...DEFAULT_EDITOR_SETTINGS,
    ...settings,
  };
  const editorRef = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    visible: false,
  });
  const [transposeModal, setTransposeModal] = useState(false);

  const handleContextMenuAction = useCallback((type: SectionType) => {
    if (editorRef.current) {
      wrapSelectionInSection(editorRef.current, type);
    }
  }, []);

  const openTransposeModal = useCallback(() => {
    setTransposeModal(true);
  }, []);

  const handleTransposeConfirm = useCallback(
    (newText: string, targetNote: string) => {
      let result = newText;

      const hasOriginalKey = /\{original_key:\s*[^}]+\}/i.test(result);
      const hasKey = /\{key:\s*[^}]+\}/i.test(result);

      if (!hasOriginalKey && hasKey) {
        // No original_key yet: save current key as original_key, then update key
        const currentKey = getKeyFromText(result);
        if (currentKey) {
          result = result.replace(
            /\{key:\s*([^}]+)\}/i,
            `{original_key: ${currentKey}}\n{key: ${targetNote}}`,
          );
        } else {
          result = result.replace(/\{key:\s*[^}]+\}/i, `{key: ${targetNote}}`);
        }
      } else if (hasOriginalKey && hasKey) {
        // original_key already preserved: just update key
        result = result.replace(/\{key:\s*[^}]+\}/i, `{key: ${targetNote}}`);
      } else {
        // No directives at all: prepend original_key and key
        const currentKey = getKeyFromText(value) ?? "C";
        result =
          `{original_key: ${currentKey}}\n{key: ${targetNote}}\n` + result;
      }

      onChange(result);
    },
    [onChange, value],
  );

  const handleLoad = useCallback(
    (editor: any) => {
      if (!editor) return;
      editorRef.current = editor;

      // Add custom save command if commands API exists
      if (editor.commands && typeof editor.commands.addCommand === "function") {
        editor.commands.addCommand({
          name: "save",
          bindKey: { win: "Ctrl-S", mac: "Cmd-S" },
          exec: (ed: any) => {
            if (ed && typeof ed.getValue === "function") {
              onSave?.(ed.getValue());
            }
          },
        });

        // Wrap-in-section keyboard shortcuts
        editor.commands.addCommand({
          name: "wrapInVerse",
          bindKey: { win: "Alt-V", mac: "Alt-V" },
          exec: (ed: any) => wrapSelectionInSection(ed, "verse"),
        });
        editor.commands.addCommand({
          name: "wrapInChorus",
          bindKey: { win: "Alt-R", mac: "Alt-R" },
          exec: (ed: any) => wrapSelectionInSection(ed, "chorus"),
        });
        editor.commands.addCommand({
          name: "wrapInBridge",
          bindKey: { win: "Alt-B", mac: "Alt-B" },
          exec: (ed: any) => wrapSelectionInSection(ed, "bridge"),
        });

        // Transpose shortcut (Alt+T)
        editor.commands.addCommand({
          name: "transpose",
          bindKey: { win: "Alt-T", mac: "Alt-T" },
          exec: () => setTransposeModal(true),
        });

        // Format document shortcut (Ctrl/Cmd + Shift + F)
        // Formats selection if active, otherwise formats the whole document.
        registerFormatShortcut(editor, (result) => {
          onFormat?.(result);
        });
      }

      // Context menu on right-click when text is selected
      if (
        editor.container &&
        typeof editor.container.addEventListener === "function"
      ) {
        const handleContextMenu = (e: MouseEvent) => {
          if (!editor || typeof editor.getSelectedText !== "function") return;
          const selectedText = editor.getSelectedText();
          if (selectedText && selectedText.trim()) {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
          }
        };

        editor.container.addEventListener("contextmenu", handleContextMenu);
      }
    },
    [onSave, onFormat],
  );

  return (
    <>
      <Suspense fallback={fallback}>
        <LazyAce
          mode={mode}
          theme={activeSettings.theme}
          width="100%"
          height="100%"
          value={value}
          onChange={onChange}
          onLoad={handleLoad}
          readOnly={readOnly}
          fontSize={activeSettings.fontSize}
          wrapEnabled={activeSettings.wordWrap}
          showGutter={activeSettings.showLineNumbers}
          setOptions={{
            enableLiveAutocompletion: true,
            enableBasicAutocompletion: true,
            enableSnippets: true,
            showLineNumbers: activeSettings.showLineNumbers,
            tabSize: 2,
            useWorker: false,
          }}
        />
      </Suspense>
      <EditorContextMenu
        state={contextMenu}
        onAction={handleContextMenuAction}
        onTranspose={openTransposeModal}
        onClose={() => setContextMenu((s) => ({ ...s, visible: false }))}
      />
      <TransposeModal
        visible={transposeModal}
        currentText={value}
        onConfirm={handleTransposeConfirm}
        onClose={() => setTransposeModal(false)}
      />
    </>
  );
}

export default Editor;
