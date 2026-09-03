/**
 * ChordPro Formatter — Per-line normalization rules
 * No UI dependencies.
 */

import type { FormatChange, FormatOptions, FormatWarning } from "./types";
import {
  isValidChord,
  normalizeChordContent,
} from "./chords";
import {
  buildDirectiveLine,
  detectMalformedDirective,
  parseDirectiveContent,
} from "./directives";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove zero-width and other invisible problematic Unicode characters. */
function stripInvisibleChars(text: string): string {
  return text
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "") // ZWSP, ZWNJ, ZWJ, BOM, SHY
    .replace(/[\u2028\u2029]/g, ""); // line/para separators
}

/**
 * Check if a line is a chord-only line.
 * A chord-only line contains only chord brackets, whitespace, and musical barlines/symbols.
 */
function isChordOnlyLine(line: string): boolean {
  // Remove all [chord] tokens
  const withoutChords = line.replace(/\[[^\]]*\]/g, "");
  // Remaining content should only be whitespace and barline characters (|, :, ., %, -)
  return /^[\s|:.%-]*$/.test(withoutChords);
}

// ---------------------------------------------------------------------------
// Chord bracket normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a single [chord] token in a line.
 */
function normalizeChordBracket(
  raw: string,
  lineNumber: number,
  changes: FormatChange[],
  options: Required<FormatOptions>,
): string {
  const trimmedContent = raw.trim();

  // Check for timing annotation e.g. G@2x
  const timingMatch = trimmedContent.match(/^(.+?)(@[0-9]*\.?[0-9]+x)$/);
  const chordPart = timingMatch ? timingMatch[1] : trimmedContent;
  const timingSuffix = timingMatch ? timingMatch[2] : "";

  // Check for inline annotation [* ...]
  if (trimmedContent.startsWith("*")) {
    const normalized = "[" + trimmedContent + "]";
    if (normalized !== "[" + raw + "]") {
      changes.push({
        type: "chord_spacing",
        line: lineNumber,
        before: "[" + raw + "]",
        after: normalized,
      });
    }
    return normalized;
  }

  // Not a valid recognized chord — preserve original text (do not convert [hello] or [Verse])
  if (!isValidChord(chordPart)) {
    return "[" + raw + "]";
  }

  // Normalize the chord content
  const { result: normalized, changed } = normalizeChordContent(chordPart, {
    normalizeNotationAliases: options.normalizeNotationAliases,
  });

  const before = "[" + raw + "]";
  const after = "[" + normalized + timingSuffix + "]";

  if (changed || trimmedContent !== raw) {
    let changeType: FormatChange["type"] = "chord_spacing";
    if (normalized !== chordPart.trim()) {
      if (/^[a-g]/.test(chordPart.trim())) {
        changeType = "chord_root_case";
      } else if (normalized.includes("#") || normalized.includes("b")) {
        changeType = "unicode";
      } else {
        changeType = "chord_notation";
      }
    }

    changes.push({
      type: changeType,
      line: lineNumber,
      before,
      after,
    });
  }

  return after;
}

/**
 * Detect and normalize all [chord] brackets on a line.
 */
function normalizeChordBracketsOnLine(
  line: string,
  lineNumber: number,
  changes: FormatChange[],
  options: Required<FormatOptions>,
): string {
  return line.replace(/\[([^\]]+)\]/g, (_match: string, interior: string) =>
    normalizeChordBracket(interior, lineNumber, changes, options),
  );
}

/**
 * Normalize spacing between chords and lyrics on a non-chord-only line.
 * [G] Amazing [C] grace -> [G]Amazing [C]grace
 * But preserves multiple chords at the same lyric position: [G][C]Amazing
 * And preserves chord-only lines: [G] [C] [D] [Em]
 */
function normalizeChordLyricSpacing(
  line: string,
  lineNumber: number,
  changes: FormatChange[],
): string {
  const original = line;
  // Remove space between a closing bracket ']' and a non-whitespace, non-'[' character
  const result = line.replace(/\]\s+([^\s\[])/g, (_: string, char: string) => "]" + char);
  if (result !== original) {
    changes.push({
      type: "chord_spacing",
      line: lineNumber,
      before: original,
      after: result,
    });
  }
  return result;
}

/**
 * Normalize excessive whitespace between words on a plain text line.
 * Collapses multiple spaces between words safely without touching bracketed chord text.
 */
function normalizeTextSpacing(
  line: string,
  lineNumber: number,
  changes: FormatChange[],
): string {
  const parts: string[] = [];
  const regex = /\[[^\]]*\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const textBefore = line.slice(lastIndex, match.index);
    // Collapse multiple consecutive spaces (keep single space)
    parts.push(textBefore.replace(/[ \t]{2,}/g, " "));
    parts.push(match[0]); // chord bracket untouched
    lastIndex = regex.lastIndex;
  }
  const trailing = line.slice(lastIndex);
  parts.push(trailing.replace(/[ \t]{2,}/g, " "));

  const result = parts.join("");
  if (result !== line) {
    changes.push({
      type: "whitespace",
      line: lineNumber,
      before: line,
      after: result,
    });
  }
  return result;
}

/**
 * Normalize a directive line: spacing, case, alias expansion, metadata.
 */
function normalizeDirectiveLine(
  line: string,
  lineNumber: number,
  changes: FormatChange[],
  options: Required<FormatOptions>,
): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return line;
  }

  const interior = trimmed.slice(1, -1);
  const parsed = parseDirectiveContent(interior);

  if (!parsed) return line;

  const normalized = buildDirectiveLine(parsed, {
    expandDirectiveAliases: options.expandDirectiveAliases,
  });

  if (normalized !== trimmed) {
    let changeType: FormatChange["type"] = "directive_spacing";
    if (parsed.wasAlias && options.expandDirectiveAliases) {
      changeType = "directive_name";
    } else if (parsed.name === "key" || parsed.name === "original_key" || parsed.name === "tempo" || parsed.name === "time") {
      changeType = "metadata";
    }

    changes.push({
      type: changeType,
      line: lineNumber,
      before: trimmed,
      after: normalized,
    });
  }

  return normalized;
}

// ---------------------------------------------------------------------------
// Public: normalize a single line
// ---------------------------------------------------------------------------

export interface NormalizedLine {
  content: string;
  changes: FormatChange[];
  warnings: FormatWarning[];
}

/**
 * Normalize a single line of ChordPro content.
 */
export function normalizeLine(
  line: string,
  lineNumber: number,
  options: Required<FormatOptions>,
): NormalizedLine {
  const changes: FormatChange[] = [];
  const warnings: FormatWarning[] = [];

  let result = line;

  // 1. Strip invisible characters
  const stripped = stripInvisibleChars(result);
  if (stripped !== result) {
    changes.push({
      type: "unicode",
      line: lineNumber,
      before: result,
      after: stripped,
    });
    result = stripped;
  }

  // 2. Check for malformed directive before trimming
  const malformed = detectMalformedDirective(result, lineNumber);
  if (malformed) {
    warnings.push(malformed);
  }

  // 3. Trim trailing whitespace
  const trimmedEnd = result.replace(/[ \t]+$/, "");
  if (trimmedEnd !== result) {
    changes.push({
      type: "whitespace",
      line: lineNumber,
      before: result,
      after: trimmedEnd,
    });
    result = trimmedEnd;
  }

  // 4. Trim leading whitespace
  const trimmedStart = result.replace(/^[ \t]+/, "");
  if (trimmedStart !== result) {
    changes.push({
      type: "whitespace",
      line: lineNumber,
      before: result,
      after: trimmedStart,
    });
    result = trimmedStart;
  }

  // 5. Empty line — nothing more to do
  if (result === "") {
    return { content: result, changes, warnings };
  }

  // 6. Comment line (#) — do not modify
  if (result.startsWith("#")) {
    return { content: result, changes, warnings };
  }

  // 7. Directive line {…}
  if (result.startsWith("{") && result.endsWith("}")) {
    result = normalizeDirectiveLine(result, lineNumber, changes, options);
    return { content: result, changes, warnings };
  }

  // 8. Normalize chord brackets
  result = normalizeChordBracketsOnLine(result, lineNumber, changes, options);

  // 9. Normalize chord-to-lyric spacing (only if not a chord-only line)
  if (options.normalizeChordLyricSpacing && !isChordOnlyLine(result)) {
    result = normalizeChordLyricSpacing(result, lineNumber, changes);
  }

  // 10. Normalize text spacing between words
  result = normalizeTextSpacing(result, lineNumber, changes);

  return { content: result, changes, warnings };
}
