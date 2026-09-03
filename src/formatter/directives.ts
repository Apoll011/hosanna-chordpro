/**
 * ChordPro Formatter — Directive recognition & normalization
 * No UI dependencies.
 */

import type { FormatWarning } from "./types";

// ---------------------------------------------------------------------------
// Known directives and their aliases
// ---------------------------------------------------------------------------

/** Map from alias/short-form to canonical long-form directive name. */
const DIRECTIVE_ALIAS_MAP: Record<string, string> = {
  t: "title",
  st: "subtitle",
  a: "artist",
  k: "key",
  c: "comment",
  ci: "comment_italic",
  cb: "comment_box",
  soc: "start_of_chorus",
  eoc: "end_of_chorus",
  sov: "start_of_verse",
  eov: "end_of_verse",
  sob: "start_of_bridge",
  eob: "end_of_bridge",
  sot: "start_of_tab",
  eot: "end_of_tab",
  sog: "start_of_grid",
  eog: "end_of_grid",
  ch: "chorus",
  v: "verse",
  b: "bridge",
  re: "repeat",
  ns: "new_song",
  np: "new_page",
  cb2: "column_break",
  time_signature: "time",
  timesignature: "time",
  original_key: "original_key",
  sov_ver: "start_of_version",
  eov_ver: "end_of_version",
};

/** Known standard directive names (canonical). Used for unknown-directive warnings. */
const KNOWN_DIRECTIVES = new Set([
  "title", "subtitle", "artist", "composer", "lyricist", "translator",
  "copyright", "album", "year", "key", "original_key", "capo",
  "tempo", "time", "duration", "capo",
  "song_number", "ccli", "youtube", "meta",
  "comment", "comment_italic", "comment_box",
  "chorus", "verse", "bridge", "repeat",
  "start_of_chorus", "end_of_chorus",
  "start_of_verse", "end_of_verse",
  "start_of_bridge", "end_of_bridge",
  "start_of_tab", "end_of_tab",
  "start_of_grid", "end_of_grid",
  "start_of_part", "end_of_part",
  "start_of_version", "end_of_version",
  "new_song", "new_page", "column_break",
  "define", "chord",
  "textfont", "textsize", "textcolour", "textcolor",
  "chordfont", "chordsize", "chordcolour", "chordcolor",
  "tabfont", "tabsize",
  "gridfont", "gridsize",
  "pagetype",
]);

// ---------------------------------------------------------------------------
// Metadata value normalizers
// ---------------------------------------------------------------------------

/**
 * Normalize a musical key value.
 * "g" → "G", "bb" → "Bb", "F#" stays "F#"
 */
function normalizeKeyValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  // Match root + optional accidental
  const match = trimmed.match(/^([a-gA-G])([b#]?)(.*)$/);
  if (!match) return trimmed;
  const root = match[1].toUpperCase();
  const accidental = match[2];
  const rest = match[3];
  return root + accidental + rest;
}

/**
 * Normalize a tempo value: trim excess whitespace around the numeric value.
 * " 72 " → "72"
 */
function normalizeTempoValue(value: string): string {
  return value.trim();
}

/**
 * Normalize a time signature value: trim whitespace, preserve format.
 * " 4/4 " → "4/4"
 */
function normalizeTimeValue(value: string): string {
  return value.trim();
}

// ---------------------------------------------------------------------------
// Directive parsing
// ---------------------------------------------------------------------------

export interface ParsedDirective {
  /** Canonical (lowercased, alias-expanded) directive name. */
  name: string;
  /** Raw name exactly as parsed (for detecting alias expansion). */
  rawName: string;
  /** The value after the colon, trimmed. Empty string if no value. */
  value: string;
  /** True if the directive has a colon separator. */
  hasColon: boolean;
  /** True if the name was an alias that was expanded. */
  wasAlias: boolean;
  /** True if this is a known directive. */
  isKnown: boolean;
}

/**
 * Parse the interior of a {…} directive block.
 * Returns null if the string doesn't look like a valid directive.
 */
export function parseDirectiveContent(interior: string): ParsedDirective | null {
  const trimmed = interior.trim();
  if (!trimmed) return null;

  const colonIndex = trimmed.indexOf(":");
  let rawName: string;
  let value: string;
  let hasColon: boolean;

  if (colonIndex !== -1) {
    rawName = trimmed.substring(0, colonIndex).trim();
    value = trimmed.substring(colonIndex + 1).trim();
    hasColon = true;
  } else {
    rawName = trimmed;
    value = "";
    hasColon = false;
  }

  const lowerName = rawName.toLowerCase();
  const resolvedName = DIRECTIVE_ALIAS_MAP[lowerName] ?? lowerName;
  const wasAlias = resolvedName !== lowerName && lowerName in DIRECTIVE_ALIAS_MAP;
  const isKnown = KNOWN_DIRECTIVES.has(resolvedName) || resolvedName.startsWith("x_");

  return {
    name: resolvedName,
    rawName,
    value,
    hasColon,
    wasAlias,
    isKnown,
  };
}

// ---------------------------------------------------------------------------
// Value normalization per directive
// ---------------------------------------------------------------------------

/**
 * Normalize the value of a directive according to its type.
 * Returns the normalized value (may be same as input).
 */
export function normalizeDirectiveValue(name: string, value: string): string {
  switch (name) {
    case "key":
    case "original_key":
      return normalizeKeyValue(value);
    case "tempo":
      return normalizeTempoValue(value);
    case "time":
      return normalizeTimeValue(value);
    default:
      return value;
  }
}

/**
 * Reconstruct a normalized directive line from its parsed parts.
 * Handles alias expansion and consistent spacing.
 */
export function buildDirectiveLine(
  parsed: ParsedDirective,
  options: { expandDirectiveAliases: boolean },
): string {
  const name = options.expandDirectiveAliases ? parsed.name : parsed.rawName.toLowerCase();
  const normalizedValue = normalizeDirectiveValue(parsed.name, parsed.value);

  if (!parsed.hasColon || parsed.value === "") {
    return `{${name}}`;
  }
  return `{${name}: ${normalizedValue}}`;
}

/**
 * Detect if a line looks like a malformed directive (e.g. missing colon,
 * or a brace mismatch) and emit appropriate warnings.
 */
export function detectMalformedDirective(
  line: string,
  lineNumber: number,
): FormatWarning | null {
  // Looks like it starts with { but doesn't end with }
  const trimmed = line.trim();
  if (trimmed.startsWith("{") && !trimmed.endsWith("}")) {
    return {
      type: "malformed_directive",
      message: `Possible malformed directive (missing closing brace)`,
      line: lineNumber,
    };
  }
  // Has both braces but no colon and content contains spaces (e.g. {title Amazing Grace})
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const interior = trimmed.slice(1, -1).trim();
    if (!interior.includes(":") && interior.includes(" ")) {
      // Might be a malformed directive like {title Amazing Grace}
      // But could also be a standalone directive with spaces — be conservative
      // Only warn if it looks like a known directive name followed by a space
      const firstWord = interior.split(" ")[0].toLowerCase();
      if (KNOWN_DIRECTIVES.has(firstWord) || firstWord in DIRECTIVE_ALIAS_MAP) {
        return {
          type: "malformed_directive",
          message: `Possible malformed directive (missing colon separator): ${trimmed}`,
          line: lineNumber,
        };
      }
    }
  }
  return null;
}

export { DIRECTIVE_ALIAS_MAP, KNOWN_DIRECTIVES };
