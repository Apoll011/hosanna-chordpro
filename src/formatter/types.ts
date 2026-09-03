/**
 * ChordPro Formatter — Public Types
 * Pure TypeScript, no UI dependencies.
 */

export type FormatChangeType =
  | "whitespace"
  | "empty_lines"
  | "chord_spacing"
  | "chord_notation"
  | "chord_root_case"
  | "directive_spacing"
  | "directive_name"
  | "metadata"
  | "unicode"
  | "line_ending";

export interface FormatChange {
  /** Category of change that was made. */
  type: FormatChangeType;
  /** 1-based line number in the ORIGINAL document. */
  line?: number;
  /** 1-based column in the original line (best-effort). */
  column?: number;
  /** The original text that was changed. */
  before?: string;
  /** The new text after the change. */
  after?: string;
}

export type FormatWarningType =
  | "malformed_directive"
  | "unknown_directive"
  | "possible_invalid_chord";

export interface FormatWarning {
  type: FormatWarningType;
  message: string;
  line?: number;
  column?: number;
}

export interface FormatOptions {
  /**
   * Maximum number of consecutive blank lines to allow between content blocks.
   * @default 1
   */
  maxBlankLines?: number;

  /**
   * Normalize notation aliases (e.g. CΔ7 → Cmaj7, C° → Cdim, Cø → Cm7b5)
   * when they can be deterministically resolved.
   * @default true
   */
  normalizeNotationAliases?: boolean;

  /**
   * Expand known directive aliases to their canonical long form
   * (e.g. {t: Song} → {title: Song}).
   * @default true
   */
  expandDirectiveAliases?: boolean;

  /**
   * Normalize chord-to-lyric spacing so [G] Amazing → [G]Amazing.
   * @default true
   */
  normalizeChordLyricSpacing?: boolean;
}

export interface FormatResult {
  /** The formatted content. May be identical to input if nothing changed. */
  content: string;
  /** True if the content was actually modified. */
  changed: boolean;
  /** Ordered list of every change that was applied. */
  changes: FormatChange[];
  /** Non-fatal warnings about things the formatter noticed but did not change. */
  warnings: FormatWarning[];
}
