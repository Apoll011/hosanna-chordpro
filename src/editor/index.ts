export {
  Editor,
  default as default,
  preloadEditor,
  type EditorProps,
} from "./Editor";
export {
  EditorSettingsPanel,
  type EditorSettingsPanelProps,
} from "./EditorSettingsPanel";
export {
  useEditorSettings,
  EDITOR_THEMES,
  type EditorSettings,
} from "./useEditorSettings";
export { ChordFinder, type ChordOccurrence } from "./ChordFinder";
export { registerChordproMode } from "./mode-chordpro";
export { registerChordproSnippets } from "./snippets-chordpro";
