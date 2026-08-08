import { useCallback, useEffect, useRef, useState } from "react";
import AceEditor from "react-ace";

import ace from "ace-builds";
import "ace-builds/src-noconflict/ext-language_tools";

import "ace-builds/src-noconflict/theme-dracula";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/theme-solarized_dark";
import "ace-builds/src-noconflict/theme-solarized_light";
import "ace-builds/src-noconflict/theme-textmate";
import "ace-builds/src-noconflict/theme-tomorrow";
import "ace-builds/src-noconflict/theme-tomorrow_night";

import { useEditorSettings } from "../hooks/useEditorSettings";

import { ChordFinder } from "@/src/chordpro/editor-ace//ChordFinder";
import { registerChordproMode } from "@/src/chordpro/editor-ace/mode-chordpro";
import { registerChordproSnippets } from "@/src/chordpro/editor-ace/snippets-chordpro";

registerChordproMode();
registerChordproSnippets();

const langTools = (ace as any).require("ace/ext/language_tools");

if (!(window as any)._chordproCompleterRegistered) {
  const chordCompleter = {
    getCompletions: (
      editor: ace.Ace.Editor,
      _session: any,
      _pos: any,
      _prefix: string,
      callback: any,
    ) => {
      const text = editor.getValue();
      const chords = ChordFinder.getChords(text);
      callback(null, chords);
    },
  };

  langTools.addCompleter(chordCompleter);
  (window as any)._chordproCompleterRegistered = true;
}

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
  editor: ace.Ace.Editor,
  sectionType: SectionType,
) {
  const selection = editor.getSelection();
  const range = selection.getRange();
  const selectedText = editor.session.getTextRange(range);

  if (!selectedText.trim()) return;

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
interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  mode?: string;
  readOnly?: boolean;
}

export default function Editor({
  value,
  onChange,
  onSave,
  mode = "chordpro",
  readOnly = false,
}: EditorProps) {
  const { settings } = useEditorSettings();
  const editorRef = useRef<ace.Ace.Editor | null>(null);
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

  const handleLoad = (editor: ace.Ace.Editor) => {
    editorRef.current = editor;

    // Add custom save command
    editor.commands.addCommand({
      name: "save",
      bindKey: { win: "Ctrl-S", mac: "Cmd-S" },
      exec: (ed: ace.Ace.Editor) => onSave?.(ed.getValue()),
    });

    // Wrap-in-section keyboard shortcuts
    editor.commands.addCommand({
      name: "wrapInVerse",
      bindKey: { win: "Alt-V", mac: "Alt-V" },
      exec: (ed: ace.Ace.Editor) => wrapSelectionInSection(ed, "verse"),
    });
    editor.commands.addCommand({
      name: "wrapInChorus",
      bindKey: { win: "Alt-R", mac: "Alt-R" },
      exec: (ed: ace.Ace.Editor) => wrapSelectionInSection(ed, "chorus"),
    });
    editor.commands.addCommand({
      name: "wrapInBridge",
      bindKey: { win: "Alt-B", mac: "Alt-B" },
      exec: (ed: ace.Ace.Editor) => wrapSelectionInSection(ed, "bridge"),
    });

    // Context menu on right-click when text is selected
    editor.container.addEventListener("contextmenu", (e: MouseEvent) => {
      const selectedText = editor.getSelectedText();
      if (selectedText && selectedText.trim()) {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, visible: true });
      }
    });
  };

  return (
    <>
      <AceEditor
        mode={mode}
        theme={settings.theme}
        width="100%"
        height="100%"
        value={value}
        onChange={onChange}
        onLoad={handleLoad}
        readOnly={readOnly}
        fontSize={settings.fontSize}
        wrapEnabled={settings.wordWrap}
        showGutter={settings.showLineNumbers}
        setOptions={{
          enableLiveAutocompletion: true,
          enableBasicAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: settings.showLineNumbers,
          tabSize: 2,
          useWorker: false,
        }}
      />
      <EditorContextMenu
        state={contextMenu}
        onAction={handleContextMenuAction}
        onClose={() => setContextMenu((s) => ({ ...s, visible: false }))}
      />
    </>
  );
}
