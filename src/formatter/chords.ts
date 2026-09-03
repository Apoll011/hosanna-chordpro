/**
 * ChordPro Formatter — Chord recognition & normalization
 * No UI dependencies.
 */

// ---------------------------------------------------------------------------
// Chord root recognition
// ---------------------------------------------------------------------------

/** Unicode music symbols that map to their ASCII equivalents. */
const UNICODE_ACCIDENTALS: [string, string][] = [
  ["\u266F", "#"], // ♯ → #
  ["\u266D", "b"], // ♭ → b
  ["\u1D12A", "##"], // 𝄪 (double sharp) → ##
  ["\u1D12B", "bb"], // 𝄫 (double flat) → bb
];

/**
 * Recognized valid chord qualities and modifier tokens.
 */
const KNOWN_QUALITIES = [
  // Extended / altered
  "maj13", "min13", "m13", "13",
  "maj11", "min11", "m11", "11",
  "maj9", "min9", "m9", "9",
  "maj7#5", "maj7b5", "m7b5", "m7-5", "m7#5", "min7b5",
  "7sus4", "7sus2", "7b9", "7#9", "7b5", "7#5",
  "minMaj7", "mMaj7", "mM7",
  "minAdd9", "madd9", "add9", "add11", "add13", "add2", "add4",
  "maj7", "Maj7", "min7", "Min7", "m7", "M7", "7",
  "dim7", "aug7", "dim", "aug",
  "sus4", "sus2", "sus",
  "6/9", "69", "m6", "min6", "6",
  "5",
  "maj", "Maj", "min", "Min", "m", "M",
  // Common symbols
  "Δ7", "Δ9", "Δ", "°7", "°", "ø7", "ø", "-7", "-"
];

const QUALITY_REGEX_PART = KNOWN_QUALITIES
  .map((q) => q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

// Strict regex to recognise a chord:
// Root: A-G (or a-g for lowercase normalization) + optional accidental (# or b)
// Optional quality or parens
// Optional slash bass (/A-G + optional accidental)
const STRICT_CHORD_REGEX = new RegExp(
  `^([a-gA-G])([#b]?)(?:${QUALITY_REGEX_PART})?(?:\\([^)]*\\))?(?:\\/([a-gA-G])([#b]?))?$`
);

/**
 * Normalizes Unicode accidentals in a raw chord string.
 * ♯ → #, ♭ → b
 */
export function normalizeUnicodeAccidentals(chord: string): string {
  let result = chord;
  for (const [unicode, ascii] of UNICODE_ACCIDENTALS) {
    result = result.split(unicode).join(ascii);
  }
  return result;
}

/**
 * Returns true if the string looks like a valid ChordPro chord.
 * Conservative: avoids bracketed non-chords like [Verse], [hello], [Jesus], [Something].
 */
export function isValidChord(token: string): boolean {
  if (!token || token.length === 0) return false;

  // Remove timing annotation if present e.g. G@2x
  const withoutTiming = token.replace(/@[0-9]*\.?[0-9]+x$/, "").trim();
  const normalizedAccidentals = normalizeUnicodeAccidentals(withoutTiming);

  // Exclude common non-chord bracketed words explicitly if they start with A-G
  // E.g. [Bridge], [Chorus], [Ending], [Fade], [Guitar]
  const nonChordWords = /^(Bridge|Chorus|Ending|Fade|Guitar|Break|Coda|Intro|Outro|Solo|Verse|Interlude)/i;
  if (nonChordWords.test(normalizedAccidentals)) {
    return false;
  }

  // Must match strict chord syntax
  return STRICT_CHORD_REGEX.test(normalizedAccidentals);
}

/**
 * Normalize Unicode notation aliases in a chord quality string.
 * e.g. CΔ7 → Cmaj7, C° → Cdim, Cø → Cm7b5, C-7 → Cm7
 */
export function normalizeNotationAlias(chordQualityAndRest: string): string {
  let result = chordQualityAndRest;

  result = result.replace(/Δ7/g, "maj7");
  result = result.replace(/Δ/g, "maj7");
  result = result.replace(/°7/g, "dim7");
  result = result.replace(/°/g, "dim");
  result = result.replace(/ø7/g, "m7b5");
  result = result.replace(/ø/g, "m7b5");
  result = result.replace(/-7/g, "m7");
  result = result.replace(/-([0-9a-zA-Z])/g, "m$1");
  result = result.replace(/-$/g, "m");

  return result;
}

/**
 * Normalize the root and bass capitalization of a chord.
 * e.g. "am" → "Am", "f#m7" → "F#m7", "c/e" → "C/E", "g/b" → "G/B"
 */
export function normalizeChordRoot(chord: string): string {
  if (!chord) return chord;

  return chord.replace(/^([a-gA-G])([#b]?)/, (_, root, acc) => {
    return root.toUpperCase() + acc;
  }).replace(/\/([a-gA-G])([#b]?)/, (_, bassRoot, bassAcc) => {
    return "/" + bassRoot.toUpperCase() + bassAcc;
  });
}

/**
 * Normalize spaces around slash in slash chords.
 * [G / B] → [G/B], [C /E] → [C/E]
 */
export function normalizeSlashChord(chord: string): string {
  return chord.replace(/\s*\/\s*/g, "/");
}

/**
 * Normalize spaces inside parenthetical additions.
 * C(add 9) → C(add9), C (add9) → C(add9), Cmaj7 (9) → Cmaj7(9)
 */
export function normalizeChordParens(chord: string): string {
  let result = chord.replace(/\s+\(/g, "(");
  result = result.replace(/\(\s*([^)]+?)\s*\)/g, (_, inner: string) => {
    return `(${inner.replace(/\s+/g, "")})`;
  });
  return result;
}

/**
 * Apply all chord normalization steps to the content of a bracket.
 * Returns the normalized chord and whether it changed.
 */
export function normalizeChordContent(
  raw: string,
  options: { normalizeNotationAliases: boolean }
): { result: string; changed: boolean } {
  let result = raw.trim();

  // 1. Normalize Unicode accidentals (♯ → #, ♭ → b)
  result = normalizeUnicodeAccidentals(result);

  // 2. Normalize spaces around slash
  result = normalizeSlashChord(result);

  // 3. Normalize parenthetical spacing
  result = normalizeChordParens(result);

  // 4. If valid chord, normalize root & bass capitalization
  if (isValidChord(result)) {
    result = normalizeChordRoot(result);

    // 5. Optionally normalize notation aliases (Δ, °, ø, -)
    if (options.normalizeNotationAliases) {
      // Split root and remainder
      const rootMatch = result.match(/^([A-G][#b]?)(.*)$/);
      if (rootMatch) {
        const root = rootMatch[1];
        const rest = rootMatch[2];
        result = root + normalizeNotationAlias(rest);
      }
    }
  }

  return { result, changed: result !== raw };
}
