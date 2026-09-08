export {
  Editor,
  default as default,
  preloadEditor,
  type EditorProps,
  type EditorSettings,
} from "./Editor";
export { ChordFinder, type ChordOccurrence } from "./ChordFinder";
export { registerChordproMode } from "./mode-chordpro";
export { registerChordproSnippets } from "./snippets-chordpro";
export {
  formatAceDocument,
  formatAceSelection,
  registerFormatShortcut,
} from "../formatter/integrations/ace";
