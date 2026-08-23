/**
 * txtToChordPro.ts
 * ------------------------------------------------------------------------
 * Universal chord-sheet -> ChordPro converter.
 *
 * Handles three input flavours out of the box:
 *   - "ultimate-guitar"  -> bracket section headers ([Verse], [Chorus 1], [Intro]),
 *                           English metadata (Capo:, Tuning:, Key:), trailing
 *                           repeat notation ("... let it be x2").
 *   - "cifraclub"        -> Portuguese metadata (Tom:, Capotraste:, Intérprete:),
 *                           syllable-hyphenated lyrics used purely to align
 *                           chords over multi-syllable Portuguese words
 *                           (e.g. "Deus-que-tomou-meu-lugar"), Portuguese
 *                           section labels (Refrão, Verso, Ponte, Introdução...).
 *   - "plain"            -> generic chord-line-over-lyric-line sheets with no
 *                           site-specific quirks. Also the safe fallback.
 *
 * Source format is auto-detected by default (source: 'auto'), but can be
 * forced via options.source. Chord <-> lyric alignment is done by column
 * position (not just token order), so mid-word chords and chords that spill
 * past the end of a lyric line are placed exactly like a human would expect:
 *
 *   Am         C/G        F          C
 *   Let it be, let it be, let it be, let it be
 *
 *   -> Let i[Am]t be, let [C/G]it be, let [F]it be, let [C]it be
 *
 * ------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SourceFormat = "ultimate-guitar" | "cifraclub" | "plain";
export type SourceOption = SourceFormat | "auto";

export interface ConversionOptions {
  /** Force a source format instead of auto-detecting. Default: 'auto'. */
  source?: SourceOption;
  /** Emit {start_of_verse}/{start_of_chorus}/etc. Default: true. */
  detectSections?: boolean;
  /**
   * Require every token on a candidate chord line to be a valid chord
   * (true) vs. a majority (>=80%, false). Default: true. Turning this off
   * helps with messy OCR/paste artifacts but raises false-positive risk.
   */
  strictChordDetection?: boolean;
  /**
   * Undo CifraClub-style syllable hyphenation ("Deus-que-tomou-meu-lugar"
   * -> "Deus que tomou meu lugar") before merging chords in. 'auto' only
   * does this when the detected/forced source is 'cifraclub'. Default: 'auto'.
   */
  dehyphenateSyllables?: boolean | "auto";
  /**
   * Reattach trailing repeat markers ("x2", "2x", "(2x)") to the end of the
   * merged lyric line instead of treating them as stray chord tokens.
   * Default: true.
   */
  keepRepeatMarkers?: boolean;
  /**
   * Tag names used for non-standard section types (intro/outro/solo/etc).
   * Override if your ChordPro/AST parser expects different tag names.
   * Defaults match the {start_of_part}/{end_of_part} convention.
   */
  partTagNames?: { start: string; end: string };
}

export interface ConversionResult {
  chordpro: string;
  title: string | null;
  detectedSource: SourceFormat;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: Required<ConversionOptions> = {
  source: "auto",
  detectSections: true,
  strictChordDetection: true,
  dehyphenateSyllables: "auto",
  keepRepeatMarkers: true,
  partTagNames: { start: "start_of_part", end: "end_of_part" },
};

// ---------------------------------------------------------------------------
// Chord grammar
// ---------------------------------------------------------------------------

// Root note: standard letter names, plus Portuguese/Brazilian solfège
// (Dó/Ré/Mi/Fá/Sol/Lá/Si), with or without accents.
const CHORD_ROOT = "(?:[A-G]|D[oó]|R[eé]|Mi|F[aá]|Sol|L[aá]|Si)";

const CHORD_BODY =
  CHORD_ROOT +
  "(?:#|b)?" +
  // Base quality
  "(?:maj|min|m\\(maj7\\)|mM|m7b5|dim|aug|alt|\u0394|\u00b0|\u00f8|M|m|\\+|-)?" +
  // Numbered extension (bare "4"/"9" etc. is common shorthand for sus4/add9
  // on Brazilian/Portuguese sheets - kept as-is, not reinterpreted, see
  // README note on ambiguous shorthand)
  "(?:2|4|5|6\\/9|6|7|9|11|13)?" +
  // Post-number modifier
  "(?:[Mm+])?" +
  // Suspended
  "(?:sus(?:2|4)?)?" +
  // Added notes
  "(?:add(?:2|4|6|9|11|13))?" +
  // Omitted notes
  "(?:(?:omit|no)(?:3|5))?" +
  // Parenthesized complex extensions
  "(?:\\((?:[#b]?(?:5|9|11|13)|sus(?:2|4)?|add(?:2|4|9|11|13)|alt|omit(?:3|5)|no(?:3|5))(?:[,/]\\s*[#b]?(?:5|9|11|13))*\\))*" +
  // Unparenthesized alterations
  "(?:[#b](?:5|9|11|13))*" +
  // Slash bass note (also accepts solfège bass)
  "(?:\\/" +
  CHORD_ROOT +
  "(?:#|b)?)?";

const CHORD_TOKEN_REGEX = new RegExp(`^${CHORD_BODY}$`, "i");
const NO_CHORD_TOKEN_REGEX = /^N\.?C\.?$/i;
// Scan regex also matches the "N.C." (no chord) token so it isn't silently
// dropped when merging a chord line into its lyric line.
const CHORD_SCAN_REGEX = new RegExp(
  `(?<=^|\\s)(${CHORD_BODY}|N\\.?C\\.?)(?=\\s|$)`,
  "gi",
);

const PUNCTUATION_TOKENS = new Set([
  "|",
  "%",
  "-",
  ".",
  "...",
  "/",
  "x2",
  "x3",
  "x4",
  "x5",
  "x6",
  "x7",
  "x8",
  "2x",
  "3x",
  "4x",
  "5x",
  "6x",
  "7x",
  "8x",
]);

function isValidChordToken(token: string): boolean {
  const clean = token.replace(/^[(]/, "").replace(/[)]$/, "");
  return CHORD_TOKEN_REGEX.test(clean) || NO_CHORD_TOKEN_REGEX.test(clean);
}

function isChordLine(line: string, strict: boolean): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed
    .split(/\s+/)
    .filter((t) => !PUNCTUATION_TOKENS.has(t.toLowerCase()));
  if (tokens.length === 0) return false;
  const validCount = tokens.filter(isValidChordToken).length;
  return strict
    ? validCount === tokens.length
    : validCount / tokens.length >= 0.8;
}

function isAlreadyInlineChordPro(line: string): boolean {
  const matches = [...line.matchAll(/\[([^\]]+)\]/g)];
  if (matches.length === 0) return false;
  return matches.every((m) => isValidChordToken(m[1]));
}

// ---------------------------------------------------------------------------
// Metadata (bilingual EN/PT)
// ---------------------------------------------------------------------------

const METADATA_MAP: Record<string, string> = {
  title: "title",
  t: "title",
  titulo: "title",
  título: "title",
  subtitle: "subtitle",
  st: "subtitle",
  artist: "artist",
  a: "artist",
  artista: "artist",
  interprete: "artist",
  intérprete: "artist",
  composer: "composer",
  music: "composer",
  compositor: "composer",
  lyricist: "lyricist",
  words: "lyricist",
  letra: "lyricist",
  letrista: "lyricist",
  album: "album",
  álbum: "album",
  key: "key",
  tom: "key",
  capo: "capo",
  capotraste: "capo",
  capodastro: "capo",
  tuning: "tuning",
  afinacao: "tuning",
  afinação: "tuning",
  tempo: "tempo",
  andamento: "tempo",
  bpm: "tempo",
  time: "time",
  compasso: "time",
  year: "year",
  ano: "year",
  copyright: "copyright",
  duration: "duration",
  duracao: "duration",
  duração: "duration",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ---------------------------------------------------------------------------
// Sections (bilingual EN/PT)
// ---------------------------------------------------------------------------

type SectionKind = "verse" | "chorus" | "bridge" | "part";

const SECTION_KEYWORDS: Record<SectionKind, string[]> = {
  verse: ["verso", "verse"],
  chorus: ["refrao", "chorus", "coro"],
  bridge: [
    "ponte",
    "bridge",
    "pre-refrao",
    "prerefrao",
    "prechorus",
    "pre chorus",
    "pre-chorus",
  ],
  part: [
    "intro",
    "introducao",
    "introducao1",
    "outro",
    "final",
    "coda",
    "instrumental",
    "interlude",
    "interludio",
    "solo",
    "solo de guitarra",
    "solo de violao",
    "riff",
  ],
};

const SECTION_TAGS: Record<SectionKind, { start: string; end: string }> = {
  verse: { start: "start_of_verse", end: "end_of_verse" },
  chorus: { start: "start_of_chorus", end: "end_of_chorus" },
  bridge: { start: "start_of_bridge", end: "end_of_bridge" },
  // 'part' tag names are configurable via options.partTagNames
  part: { start: "start_of_part", end: "end_of_part" },
};

// A bracketed UG-style header, e.g. "[Verse]", "[Chorus 2]", "[Intro]"
const BRACKET_HEADER_REGEX = /^\[([^\]]+)]$/;

function classifySectionLabel(
  rawLabel: string,
): { kind: SectionKind; label: string } | null {
  let s = rawLabel.trim().replace(/:$/, "").trim();
  const numberSuffix = s.match(/\s*(\d+)\s*$/);
  const base = s.replace(/\s*\d+\s*$/, "").trim();
  const normalized = stripAccents(base).toLowerCase();

  for (const kind of Object.keys(SECTION_KEYWORDS) as SectionKind[]) {
    if (
      SECTION_KEYWORDS[kind].some(
        (kw) => normalized === kw || normalized.startsWith(kw),
      )
    ) {
      return { kind, label: s };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Repeat notation ("... let it be x2", "(2x)")
// ---------------------------------------------------------------------------

const REPEAT_NOTATION_REGEX = /\s*\(?\b(\d+)\s*[xX]\b\)?\s*$|\s+[xX](\d+)\s*$/;

function extractRepeatNotation(line: string): {
  cleanLine: string;
  marker: string | null;
} {
  const match = line.match(REPEAT_NOTATION_REGEX);
  if (match) {
    return {
      cleanLine: line.slice(0, match.index).replace(/\s+$/, ""),
      marker: match[0].trim(),
    };
  }
  return { cleanLine: line, marker: null };
}

// ---------------------------------------------------------------------------
// Hyphenated-syllable detection (CifraClub-style alignment aid)
// ---------------------------------------------------------------------------

function countSyllableHyphens(line: string): number {
  const matches = line.match(/[^\s-]-[^\s-]/g);
  return matches ? matches.length : 0;
}

/**
 * Replaces syllable-joining hyphens with spaces, 1-for-1, so column
 * positions used for chord alignment stay identical.
 */
function dehyphenate(line: string): string {
  return line.replace(/([^\s-])-([^\s-])/g, "$1 $2");
}

// ---------------------------------------------------------------------------
// Source detection
// ---------------------------------------------------------------------------

export function detectSourceFormat(input: string): SourceFormat {
  const lines = input.split("\n");
  let ugScore = 0;
  let ccScore = 0;
  let sawChordLine = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (BRACKET_HEADER_REGEX.test(line)) ugScore += 2;
    if (/^(capo|tuning|key)\s*:/i.test(line)) ugScore += 2;
    if (/\s[xX]\d+\s*$/.test(raw)) ugScore += 1;

    if (
      /^(tom|capotraste|capodastro|int[ée]rprete|compositor|letrista)\s*:/i.test(
        line,
      )
    )
      ccScore += 2;
    if (/^\(?\d+x\)?\s*$/i.test(line)) ccScore += 1;

    if (isChordLine(line, true)) {
      sawChordLine = true;
      if (countSyllableHyphens(line) === 0) {
        // only lyric lines matter for hyphenation, skip chord lines
      }
    } else if (countSyllableHyphens(line) >= 2) {
      ccScore += 2;
    }
  }

  if (!sawChordLine) return "plain";
  if (ccScore > ugScore) return "cifraclub";
  if (ugScore > 0) return "ultimate-guitar";
  return "plain";
}

// ---------------------------------------------------------------------------
// Line classification
// ---------------------------------------------------------------------------

interface ParsedLine {
  kind:
    | "directive"
    | "metadata"
    | "comment"
    | "section-header"
    | "chord-lyric"
    | "chord-only"
    | "inline-chordpro"
    | "lyric"
    | "blank";
  rendered?: string;
  section?: { kind: SectionKind; label: string };
}

function mergeChordsIntoLyric(
  chordLine: string,
  lyricLine: string,
  trailingMarker: string | null,
): string {
  const matches = [...chordLine.matchAll(CHORD_SCAN_REGEX)];
  let combined = "";
  let lastIndex = 0;

  for (const match of matches) {
    const token = match[0];
    const index = match.index ?? 0;
    const rendered = NO_CHORD_TOKEN_REGEX.test(token)
      ? token.toUpperCase()
      : token;
    combined += lyricLine.substring(lastIndex, index);
    combined += `[${rendered}]`;
    lastIndex = index;
  }
  combined += lyricLine.substring(lastIndex);

  if (trailingMarker) {
    combined += ` ${trailingMarker}`;
  }
  return combined;
}

function classify(
  lines: string[],
  opts: Required<ConversionOptions>,
  effectiveSource: SourceFormat,
  warnings: string[],
): ParsedLine[] {
  const result: ParsedLine[] = [];
  const shouldDehyphenateGlobally =
    opts.dehyphenateSyllables === true ||
    (opts.dehyphenateSyllables === "auto" && effectiveSource === "cifraclub");
  const hyphenThreshold = effectiveSource === "cifraclub" ? 1 : 2;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, "");
    const trimmed = raw.trim();

    if (trimmed === "") {
      result.push({ kind: "blank" });
      continue;
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      result.push({ kind: "directive", rendered: trimmed });
      continue;
    }

    if (isAlreadyInlineChordPro(trimmed)) {
      result.push({ kind: "inline-chordpro", rendered: raw });
      continue;
    }

    // Bracketed UG-style header: [Verse], [Chorus 2], [Intro]
    const bracketMatch = trimmed.match(BRACKET_HEADER_REGEX);
    if (bracketMatch) {
      const classified = classifySectionLabel(bracketMatch[1]);
      if (classified) {
        result.push({ kind: "section-header", section: classified });
        continue;
      }
    }

    const metaMatch = trimmed.match(/^([A-Za-zÀ-ÿ ]+):\s*(.*)/);
    if (metaMatch) {
      const key = stripAccents(metaMatch[1].toLowerCase().trim());
      const value = metaMatch[2];
      if (METADATA_MAP[key]) {
        result.push({
          kind: "metadata",
          rendered: `{${METADATA_MAP[key]}: ${value}}`,
        });
        continue;
      }
    }

    if (trimmed.startsWith("#")) {
      result.push({
        kind: "comment",
        rendered: `{comment: ${trimmed.slice(1).trim()}}`,
      });
      continue;
    }

    // Unbracketed section label on its own short line (CifraClub-style: "Refrão", "Verso 2")
    if (
      trimmed.length <= 28 &&
      !isChordLine(trimmed, opts.strictChordDetection)
    ) {
      const classified = classifySectionLabel(trimmed);
      if (classified) {
        result.push({ kind: "section-header", section: classified });
        continue;
      }
    }

    if (isChordLine(trimmed, opts.strictChordDetection)) {
      const nextRaw =
        i + 1 < lines.length ? lines[i + 1].replace(/\r$/, "") : null;
      const nextIsChord =
        nextRaw !== null &&
        isChordLine(nextRaw.trim(), opts.strictChordDetection);
      const nextIsBlank = nextRaw !== null && nextRaw.trim() === "";

      if (nextRaw === null || nextIsChord || nextIsBlank) {
        const tokens = trimmed.split(/\s+/);
        result.push({
          kind: "chord-only",
          rendered: tokens
            .map((t) =>
              NO_CHORD_TOKEN_REGEX.test(t) ? `[${t.toUpperCase()}]` : `[${t}]`,
            )
            .join(" "),
        });
        continue;
      }

      let lyricLine = nextRaw as string;
      let marker: string | null = null;

      if (opts.keepRepeatMarkers) {
        const extracted = extractRepeatNotation(lyricLine);
        lyricLine = extracted.cleanLine;
        marker = extracted.marker;
      }

      const hyphenCount = countSyllableHyphens(lyricLine);
      if (shouldDehyphenateGlobally && hyphenCount >= hyphenThreshold) {
        lyricLine = dehyphenate(lyricLine);
      } else if (hyphenCount >= 2 && effectiveSource !== "ultimate-guitar") {
        // Heuristic catch: looks hyphen-aligned even if source detection
        // guessed 'plain' - safe to dehyphenate since UG sheets never do this.
        lyricLine = dehyphenate(lyricLine);
      }

      const merged = mergeChordsIntoLyric(raw, lyricLine, marker);
      result.push({ kind: "chord-lyric", rendered: merged });
      i++; // consume the lyric line
      continue;
    }

    result.push({ kind: "lyric", rendered: raw });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render(
  lines: ParsedLine[],
  opts: Required<ConversionOptions>,
): string {
  const out: string[] = [];
  let openSection: { kind: SectionKind; label: string } | null = null;

  const tagsFor = (kind: SectionKind) =>
    kind === "part" ? opts.partTagNames : SECTION_TAGS[kind];

  const closeSection = () => {
    if (openSection) {
      out.push(`{${tagsFor(openSection.kind).end}}`);
      openSection = null;
    }
  };

  for (const line of lines) {
    if (line.kind === "section-header" && line.section) {
      if (opts.detectSections) {
        closeSection();
        const tags = tagsFor(line.section.kind);
        out.push(`{${tags.start}: ${line.section.label}}`);
        openSection = line.section;
      } else {
        out.push(`{comment: ${line.section.label}}`);
      }
      continue;
    }

    if (line.kind === "blank") {
      if (opts.detectSections) closeSection();
      out.push("");
      continue;
    }

    out.push(line.rendered ?? "");
  }

  if (opts.detectSections) closeSection();
  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() + "\n"
  );
}

function extractTitle(chordpro: string): string | null {
  const match = chordpro.match(/\{title:\s*(.*)\}/i);
  return match ? match[1].trim() : null;
}

export function slugifyTitle(title: string | null): string {
  if (!title) return "cifra_convertida";
  return (
    stripAccents(title)
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "") || "cifra"
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function convertToChordProDetailed(
  input: string,
  options: ConversionOptions = {},
): ConversionResult {
  const opts: Required<ConversionOptions> = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];

  if (!input || !input.trim()) {
    return {
      chordpro: "",
      title: null,
      detectedSource: "plain",
      warnings: ["Empty input."],
    };
  }

  const detectedSource =
    opts.source === "auto" ? detectSourceFormat(input) : opts.source;

  const lines = input.split("\n");
  const parsed = classify(lines, opts, detectedSource, warnings);
  const chordpro = render(parsed, opts);
  const title = extractTitle(chordpro);

  if (!title)
    warnings.push("No {title: ...} directive was detected in the input.");

  const shorthandTokens = new Set<string>();
  for (const raw of lines) {
    if (isChordLine(raw.trim(), opts.strictChordDetection)) {
      for (const m of raw.matchAll(CHORD_SCAN_REGEX)) {
        if (/^[A-G][#b]?4$/i.test(m[0]) || /^[A-G][#b]?9$/i.test(m[0])) {
          shorthandTokens.add(m[0]);
        }
      }
    }
  }
  if (shorthandTokens.size > 0) {
    warnings.push(
      `Ambiguous bare-number chords passed through as-is (not reinterpreted as sus/add): ${[...shorthandTokens].join(", ")}. ` +
        `On Brazilian/Portuguese sheets "G4" usually means Gsus4 - convert manually if your chord engine expects that spelling.`,
    );
  }

  return { chordpro, title, detectedSource, warnings };
}

export function toChordPro(input: string, options?: ConversionOptions): string {
  return convertToChordProDetailed(input, options).chordpro;
}
