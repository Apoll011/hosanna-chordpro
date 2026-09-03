/**
 * ChordPro Formatter — Public entry point
 *
 * Import the formatter independently of the editor:
 * import { formatChordPro } from '@hosanna/chordpro/formatter';
 *
 * Or as part of the main bundle:
 * import { formatChordPro } from '@hosanna/chordpro';
 */

export { formatChordPro } from "./format";
export type {
  FormatChange,
  FormatChangeType,
  FormatOptions,
  FormatResult,
  FormatWarning,
  FormatWarningType,
} from "./types";
export * from "./integrations";
