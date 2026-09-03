/**
 * ChordPro Formatter — Integrations
 * Re-exports all editor integrations from one entry point.
 */

export {
  formatAceDocument,
  formatAceSelection,
  registerFormatShortcut,
  type AceEditorLike,
  type AceRangeLike,
  type AcePositionLike,
  type AceCommand,
  type AceAnchorLike,
} from "./ace";
