import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { IAceEditorProps } from "react-ace";
import { ChordFinder } from "./ChordFinder";
import { registerChordproMode } from "./mode-chordpro";
import { registerChordproSnippets } from "./snippets-chordpro";
import { registerFormatShortcut } from "../formatter/integrations/ace";
import type { FormatResult } from "../formatter/types";

let aceLoaderPromise: Promise<React.ComponentType<IAceEditorProps>> | null = null;

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
            Failed to load code editor. Please ensure &apos;ace-builds&apos; and &apos;react-ace&apos; are installed.
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

function wrapSelectionInSection(
  editor: any,
  sectionType: SectionType,
) {
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
  const wrapped = `{${info.start}: ${info.defaultLabel}}\n${selectedText}\n{${info.end}}`;

  editor.session.replace(range, wrapped);
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
  onClose,
}: {
  state: ContextMenuState;
  onAction: (type: SectionType) => void;
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

  const handleContextMenuAction = useCallback((type: SectionType) => {
    if (editorRef.current) {
      wrapSelectionInSection(editorRef.current, type);
    }
  }, []);

  const handleLoad = useCallback((editor: any) => {
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

      // Format document shortcut (Ctrl/Cmd + Shift + F)
      // Formats selection if active, otherwise formats the whole document.
      registerFormatShortcut(editor, (result) => {
        onFormat?.(result);
      });
    }

    // Context menu on right-click when text is selected
    if (editor.container && typeof editor.container.addEventListener === "function") {
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
  }, [onSave, onFormat]);

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
        onClose={() => setContextMenu((s) => ({ ...s, visible: false }))}
      />
    </>
  );
}

export default Editor;
