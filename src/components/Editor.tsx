import { useRef } from "react";
import AceEditor from "react-ace";
import type { IAceEditor } from "react-ace/lib/types";

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
      session: any,
      pos: any,
      prefix: string,
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
  const editorRef = useRef<IAceEditor | null>(null);

  const handleLoad = (editor: IAceEditor) => {
    editorRef.current = editor;

    // Add custom save command
    editor.commands.addCommand({
      name: "save",
      bindKey: { win: "Ctrl-S", mac: "Cmd-S" },
      exec: (ed) => onSave?.(ed.getValue()),
    });
  };

  return (
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
  );
}
