/**
 * Chord Dictionary — interval-driven engine
 * ------------------------------------------
 * Instead of hand-listing a fingering per chord symbol, chords are derived from
 * music theory:
 *
 *   1. Parse "root + quality (+ /bass)" out of the symbol (English or PT-BR/PT-PT
 *      note names).
 *   2. Look up the quality's semitone INTERVALS (a registry, not a switch).
 *   3. Piano is 100% computed from those intervals — every quality, any root,
 *      no hardcoding, no fallback needed.
 *   4. Guitar fingerings are physical shapes on 6 strings, which can't be
 *      derived from pure interval math the way piano can (open strings,
 *      playability, hand span). So guitar uses a small, honest hybrid:
 *        a) A curated table of well-known open-position shapes (exact, best-sounding).
 *        b) Two movable CAGED "barre templates" (E-form / A-form) covering the
 *           7 qualities that have a standard, universally-taught movable shape
 *           (major, minor, 7, m7, maj7, sus2, sus4) — these transpose correctly
 *           to ANY root via simple math (shift = target - templateRoot).
 *        c) A power-chord (5) formula, which is pure math on any string.
 *        d) For qualities with no standard movable shape (dim7, aug, 9, 6,
 *           extended/altered chords, ...), we fall back to the nearest simpler
 *           quality's shape and flag the result as `approximate: true`, rather
 *           than silently returning something wrong or nothing at all.
 */

// ============================================================================
// Public types
// ============================================================================

export interface ChordFingering {
    chord: string;
    /** Canonical quality id resolved for this chord, e.g. "m7", "maj7", "9". */
    qualityId: string;
    /** Human readable quality label, e.g. "Minor 7th". */
    qualityLabel: string;
    guitar?: {
        frets: number[]; // 6 numbers, low-E to high-E. -1 = muted string.
        fingers?: number[]; // 1=index, 2=middle, 3=ring, 4=pinky, 0=open/none
        barre?: number; // fret of the barre, if any
        /** True when no standard shape exists for this exact quality and we
         *  substituted the nearest simpler quality's shape (e.g. dim7 -> minor shape). */
        approximate?: boolean;
    };
    piano: {
        notes: string[]; // pitch-class names in the chord, root first
        highlightKeys: number[]; // semitone indices (0-23, spans 2 octaves) to light up
    };
}

export interface IChordDictionary {
    getFingering: (chord: string) => ChordFingering | null;
}

interface GuitarShape {
    frets: number[];
    fingers?: number[];
    barre?: number;
}

// ============================================================================
// Note naming (English + Portuguese solfège), semitone 0 = C
// ============================================================================

const NOTE_ALIASES: Record<string, number> = {
    C: 0,
    "B#": 0,
    Do: 0,
    DO: 0,
    "C#": 1,
    Db: 1,
    D: 2,
    Re: 2,
    RE: 2,
    Ré: 2,
    RÉ: 2,
    "D#": 3,
    Eb: 3,
    E: 4,
    Fb: 4,
    Mi: 4,
    MI: 4,
    F: 5,
    "E#": 5,
    Fa: 5,
    FA: 5,
    Fá: 5,
    FÁ: 5,
    "F#": 6,
    Gb: 6,
    G: 7,
    Sol: 7,
    SOL: 7,
    "G#": 8,
    Ab: 8,
    A: 9,
    La: 9,
    LA: 9,
    Lá: 9,
    LÁ: 9,
    "A#": 10,
    Bb: 10,
    B: 11,
    Cb: 11,
    Si: 11,
    SI: 11,
};

// Sorted longest-first so multi-char roots (Sol, Ré, C#...) win over single letters.
const ROOT_KEYS = Object.keys(NOTE_ALIASES).sort((a, b) => b.length - a.length);
const ROOT_PATTERN = new RegExp(`^(${ROOT_KEYS.join("|")})`, "i");

const SEMITONE_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
];

/** Resolve a raw matched root string ("c", "SOL", "Db"...) to a semitone 0-11. */
function resolveRootSemitone(raw: string): number | null {
    if (raw in NOTE_ALIASES) return NOTE_ALIASES[raw];
    const titleCase = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if (titleCase in NOTE_ALIASES) return NOTE_ALIASES[titleCase];
    const upper = raw.toUpperCase();
    if (upper in NOTE_ALIASES) return NOTE_ALIASES[upper];
    return null;
}

function pitchClassName(semitone: number): string {
    return SEMITONE_NAMES[((semitone % 12) + 12) % 12];
}

// ============================================================================
// Chord quality registry — the "math". Every quality is just a list of
// semitone offsets from the root. This is the single source of truth used
// by piano voicing generation, and used to pick a guitar template/fallback.
// ============================================================================

interface ChordQuality {
    id: string;
    label: string;
    intervals: number[]; // ascending semitone offsets from root, can exceed 12 (9ths/11ths/13ths)
    /** Symbols recognized right after the root, e.g. "m7", "maj7", "sus4". Case sensitive. */
    aliases: string[];
}

const CHORD_QUALITIES: ChordQuality[] = [
    {
        id: "major",
        label: "Major",
        intervals: [0, 4, 7],
        aliases: ["", "M", "maj", "Maj", "MAJ"],
    },
    {
        id: "minor",
        label: "Minor",
        intervals: [0, 3, 7],
        aliases: ["m", "min", "Min", "MIN", "-"],
    },
    {
        id: "dim",
        label: "Diminished",
        intervals: [0, 3, 6],
        aliases: ["dim", "o", "\u00B0"],
    },
    {
        id: "aug",
        label: "Augmented",
        intervals: [0, 4, 8],
        aliases: ["aug", "+"],
    },
    {
        id: "sus2",
        label: "Suspended 2nd",
        intervals: [0, 2, 7],
        aliases: ["sus2"],
    },
    {
        id: "sus4",
        label: "Suspended 4th",
        intervals: [0, 5, 7],
        aliases: ["sus4", "sus"],
    },
    { id: "five", label: "Power chord", intervals: [0, 7], aliases: ["5"] },
    { id: "six", label: "6th", intervals: [0, 4, 7, 9], aliases: ["6"] },
    {
        id: "m6",
        label: "Minor 6th",
        intervals: [0, 3, 7, 9],
        aliases: ["m6", "min6"],
    },
    {
        id: "six9",
        label: "6/9",
        intervals: [0, 4, 7, 9, 14],
        aliases: ["6/9", "69"],
    },
    {
        id: "dom7",
        label: "Dominant 7th",
        intervals: [0, 4, 7, 10],
        aliases: ["7"],
    },
    {
        id: "maj7",
        label: "Major 7th",
        intervals: [0, 4, 7, 11],
        aliases: ["maj7", "Maj7", "MAJ7", "M7", "\u0394", "\u03947"],
    },
    {
        id: "m7",
        label: "Minor 7th",
        intervals: [0, 3, 7, 10],
        aliases: ["m7", "min7", "Min7"],
    },
    {
        id: "mMaj7",
        label: "Minor Major 7th",
        intervals: [0, 3, 7, 11],
        aliases: ["mMaj7", "m(maj7)", "mM7", "minMaj7"],
    },
    {
        id: "m7b5",
        label: "Half-diminished 7th",
        intervals: [0, 3, 6, 10],
        aliases: ["m7b5", "m7-5", "\u00F8", "\u00F87"],
    },
    {
        id: "dim7",
        label: "Diminished 7th",
        intervals: [0, 3, 6, 9],
        aliases: ["dim7", "o7", "\u00B07"],
    },
    {
        id: "aug7",
        label: "7#5",
        intervals: [0, 4, 8, 10],
        aliases: ["7#5", "aug7"],
    },
    { id: "dom7b5", label: "7b5", intervals: [0, 4, 6, 10], aliases: ["7b5"] },
    {
        id: "dom7sus4",
        label: "7sus4",
        intervals: [0, 5, 7, 10],
        aliases: ["7sus4"],
    },
    {
        id: "dom7sus2",
        label: "7sus2",
        intervals: [0, 2, 7, 10],
        aliases: ["7sus2"],
    },
    { id: "nine", label: "9th", intervals: [0, 4, 7, 10, 14], aliases: ["9"] },
    {
        id: "maj9",
        label: "Major 9th",
        intervals: [0, 4, 7, 11, 14],
        aliases: ["maj9", "Maj9", "M9"],
    },
    {
        id: "m9",
        label: "Minor 9th",
        intervals: [0, 3, 7, 10, 14],
        aliases: ["m9", "min9"],
    },
    { id: "add9", label: "Add 9", intervals: [0, 4, 7, 14], aliases: ["add9"] },
    {
        id: "madd9",
        label: "Minor Add 9",
        intervals: [0, 3, 7, 14],
        aliases: ["madd9", "minAdd9"],
    },
    {
        id: "eleven",
        label: "11th",
        intervals: [0, 4, 7, 10, 14, 17],
        aliases: ["11"],
    },
    {
        id: "m11",
        label: "Minor 11th",
        intervals: [0, 3, 7, 10, 14, 17],
        aliases: ["m11"],
    },
    {
        id: "thirteen",
        label: "13th",
        intervals: [0, 4, 7, 10, 14, 17, 21],
        aliases: ["13"],
    },
    {
        id: "m13",
        label: "Minor 13th",
        intervals: [0, 3, 7, 10, 14, 17, 21],
        aliases: ["m13"],
    },
    {
        id: "dom7sharp9",
        label: "7#9",
        intervals: [0, 4, 7, 10, 15],
        aliases: ["7#9"],
    },
    {
        id: "dom7flat9",
        label: "7b9",
        intervals: [0, 4, 7, 10, 13],
        aliases: ["7b9"],
    },
    {
        id: "maj7sharp5",
        label: "maj7#5",
        intervals: [0, 4, 8, 11],
        aliases: ["maj7#5"],
    },
    {
        id: "maj7flat5",
        label: "maj7b5",
        intervals: [0, 4, 6, 11],
        aliases: ["maj7b5"],
    },
];

const QUALITY_BY_ID: Record<string, ChordQuality> = Object.fromEntries(
    CHORD_QUALITIES.map((q) => [q.id, q]),
);

// Flatten + sort every (alias -> quality) pair by alias length, longest first,
// so e.g. "maj7" is tried before "m" and "m7b5" is tried before "m7".
const QUALITY_ALIAS_TABLE: Array<{ alias: string; quality: ChordQuality }> =
    CHORD_QUALITIES.flatMap((quality) =>
        quality.aliases.map((alias) => ({ alias, quality })),
    ).sort((a, b) => b.alias.length - a.alias.length);

function resolveQuality(qualitySymbol: string): ChordQuality {
    if (qualitySymbol === "") return QUALITY_BY_ID.major;
    // Case-sensitive pass first (m vs M matter).
    const exact = QUALITY_ALIAS_TABLE.find(
        (e) => e.alias !== "" && e.alias === qualitySymbol,
    );
    if (exact) return exact.quality;
    // Loose fallback for typos/odd casing (e.g. "MAJ7", "Sus4").
    const lower = qualitySymbol.toLowerCase();
    const loose = QUALITY_ALIAS_TABLE.find(
        (e) => e.alias !== "" && e.alias.toLowerCase() === lower,
    );
    if (loose) return loose.quality;
    return QUALITY_BY_ID.major;
}

// If a quality has no dedicated guitar shape, walk this chain until we land on
// a quality that does, and mark the result `approximate: true`.
const QUALITY_SIMPLIFICATION: Record<string, string> = {
    dim: "minor",
    dim7: "minor",
    aug: "major",
    six: "major",
    m6: "minor",
    six9: "major",
    mMaj7: "m7",
    m7b5: "m7",
    aug7: "dom7",
    dom7b5: "dom7",
    dom7sus4: "sus4",
    dom7sus2: "sus2",
    nine: "dom7",
    maj9: "maj7",
    m9: "m7",
    add9: "major",
    madd9: "minor",
    eleven: "dom7",
    m11: "m7",
    thirteen: "dom7",
    m13: "m7",
    dom7sharp9: "dom7",
    dom7flat9: "dom7",
    maj7sharp5: "maj7",
    maj7flat5: "maj7",
};

// ============================================================================
// Chord symbol parsing
// ============================================================================

interface ParsedChord {
    raw: string;
    rootSemitone: number;
    rootDisplay: string;
    quality: ChordQuality;
    bassSemitone?: number;
}

// Quality aliases that themselves contain a literal "/" (currently just 6/9),
// so we can recognize them BEFORE splitting the symbol on "/" to find a bass note.
const SLASH_CONTAINING_ALIASES = QUALITY_ALIAS_TABLE.filter((e) =>
    e.alias.includes("/"),
).sort((a, b) => b.alias.length - a.alias.length);

function parseChordSymbol(chord: string): ParsedChord | null {
    const cleaned = chord.replace(/[()]/g, "").trim();
    if (!cleaned) return null;

    const rootMatch = cleaned.match(ROOT_PATTERN);
    if (!rootMatch) return null;

    const rootText = rootMatch[1];
    const rootSemitone = resolveRootSemitone(rootText);
    if (rootSemitone === null) return null;

    const remainder = cleaned.slice(rootText.length);

    // Check for a quality whose own symbol contains "/" (e.g. "6/9") before
    // treating "/" as a slash-bass separator.
    const slashAlias = SLASH_CONTAINING_ALIASES.find((e) =>
        remainder.startsWith(e.alias),
    );

    let qualitySymbol: string;
    let bassPart: string | undefined;
    if (slashAlias) {
        qualitySymbol = slashAlias.alias;
        const rest = remainder.slice(slashAlias.alias.length);
        bassPart = rest.startsWith("/") ? rest.slice(1).trim() : undefined;
    } else {
        const slashIndex = remainder.indexOf("/");
        if (slashIndex === -1) {
            qualitySymbol = remainder;
        } else {
            qualitySymbol = remainder.slice(0, slashIndex);
            bassPart = remainder.slice(slashIndex + 1).trim();
        }
    }

    const quality = resolveQuality(qualitySymbol);

    let bassSemitone: number | undefined;
    if (bassPart) {
        const bassMatch = bassPart.match(ROOT_PATTERN);
        if (bassMatch) {
            const resolved = resolveRootSemitone(bassMatch[1]);
            if (resolved !== null) bassSemitone = resolved;
        }
    }

    return {
        raw: cleaned,
        rootSemitone,
        rootDisplay: pitchClassName(rootSemitone),
        quality,
        bassSemitone,
    };
}

// ============================================================================
// Piano — pure computation from intervals, no lookup table at all.
// ============================================================================

function computePianoVoicing(
    rootSemitone: number,
    intervals: number[],
    bassSemitone?: number,
) {
    const rootPc = ((rootSemitone % 12) + 12) % 12;

    if (bassSemitone !== undefined) {
        // Bass note alone in the low octave (0-11), chord tones spread into the
        // second octave (12-23) so the slash bass reads as clearly distinct.
        const bassPc = ((bassSemitone % 12) + 12) % 12;
        const notes: string[] = [pitchClassName(bassPc)];
        const highlightKeys: number[] = [bassPc];
        for (const iv of intervals) {
            const key = ((rootPc + iv) % 12) + 12;
            const name = pitchClassName(rootPc + iv);
            highlightKeys.push(key);
            if (!notes.includes(name)) notes.push(name);
        }
        return { notes, highlightKeys };
    }

    const notes = intervals.map((iv) => pitchClassName(rootPc + iv));
    // Spread across a 2-octave (0-23) keyboard so wide voicings (9ths, 11ths,
    // 13ths) don't collapse back onto the root's octave.
    const highlightKeys = intervals.map((iv) => (rootPc + iv) % 24);
    return { notes, highlightKeys };
}

// ============================================================================
// Guitar — curated open shapes + movable CAGED barre templates + power-chord formula.
// ============================================================================

// -- Curated exact open-position shapes (kept from hand-verified fingerings). --
const OPEN_CHORD_SHAPES: Record<string, GuitarShape> = {
    C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    Cm: { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barre: 3 },
    C7: { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
    Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
    Cm7: { frets: [-1, 3, 5, 3, 4, 3], fingers: [0, 1, 3, 1, 2, 1], barre: 3 },
    Csus4: { frets: [-1, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1] },
    Csus2: { frets: [-1, 3, 0, 0, 1, 3], fingers: [0, 2, 0, 0, 1, 4] },
    Cadd9: { frets: [-1, 3, 2, 0, 3, 0], fingers: [0, 2, 1, 0, 3, 0] },
    C9: { frets: [-1, 3, 2, 3, 3, 3], fingers: [0, 2, 1, 3, 3, 3], barre: 3 },
    C6: { frets: [-1, 3, 2, 2, 1, 0], fingers: [0, 4, 2, 3, 1, 0] },

    "C#": { frets: [-1, 4, 6, 6, 6, 4], fingers: [0, 1, 2, 3, 4, 1], barre: 4 },
    "C#m": {
        frets: [-1, 4, 6, 6, 5, 4],
        fingers: [0, 1, 3, 4, 2, 1],
        barre: 4,
    },
    "C#7": { frets: [-1, 4, 3, 4, 2, -1], fingers: [0, 3, 2, 4, 1, 0] },
    "C#maj7": {
        frets: [-1, 4, 6, 5, 6, 4],
        fingers: [0, 1, 3, 2, 4, 1],
        barre: 4,
    },
    "C#m7": {
        frets: [-1, 4, 6, 4, 5, 4],
        fingers: [0, 1, 3, 1, 2, 1],
        barre: 4,
    },

    D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
    Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
    D7: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
    Dmaj7: {
        frets: [-1, -1, 0, 2, 2, 2],
        fingers: [0, 0, 0, 1, 1, 1],
        barre: 2,
    },
    Dm7: { frets: [-1, -1, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], barre: 1 },
    Dsus4: { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 2, 3] },
    Dsus2: { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0] },
    Dadd9: { frets: [-1, -1, 0, 2, 5, 2], fingers: [0, 0, 0, 1, 4, 2] },
    D6: { frets: [-1, -1, 0, 2, 0, 2], fingers: [0, 0, 0, 2, 0, 3] },
    D9: { frets: [-1, -1, 0, 2, 1, 0], fingers: [0, 0, 0, 2, 1, 0] },

    Eb: { frets: [-1, 6, 8, 8, 8, 6], fingers: [0, 1, 2, 3, 4, 1], barre: 6 },
    Ebm: { frets: [-1, 6, 8, 8, 7, 6], fingers: [0, 1, 3, 4, 2, 1], barre: 6 },
    Eb7: { frets: [-1, 6, 5, 6, 4, -1], fingers: [0, 3, 2, 4, 1, 0] },

    E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
    Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
    E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
    Emaj7: { frets: [0, 2, 1, 1, 0, 0], fingers: [0, 3, 1, 2, 0, 0] },
    Em7: { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
    Esus4: { frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0] },
    Eadd9: { frets: [0, 2, 4, 1, 0, 0], fingers: [0, 2, 4, 1, 0, 0] },
    E6: { frets: [0, 2, 2, 1, 2, 0], fingers: [0, 2, 3, 1, 4, 0] },
    E9: { frets: [0, 2, 0, 1, 3, 0], fingers: [0, 2, 0, 1, 4, 0] },

    F: { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: 1 },
    Fm: { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barre: 1 },
    F7: { frets: [1, 3, 1, 2, 1, 1], fingers: [1, 3, 1, 2, 1, 1], barre: 1 },
    Fmaj7: { frets: [-1, 3, 3, 2, 1, 0], fingers: [0, 3, 4, 2, 1, 0] },
    Fm7: { frets: [1, 3, 1, 1, 1, 1], fingers: [1, 3, 1, 1, 1, 1], barre: 1 },

    "F#": { frets: [2, 4, 4, 3, 2, 2], fingers: [1, 3, 4, 2, 1, 1], barre: 2 },
    "F#m": { frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1], barre: 2 },
    "F#7": { frets: [2, 4, 2, 3, 2, 2], fingers: [1, 3, 1, 2, 1, 1], barre: 2 },
    "F#m7": {
        frets: [2, 4, 2, 2, 2, 2],
        fingers: [1, 3, 1, 1, 1, 1],
        barre: 2,
    },

    G: { frets: [3, 2, 0, 0, 3, 3], fingers: [2, 1, 0, 0, 3, 4] },
    Gm: { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barre: 3 },
    G7: { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
    Gmaj7: { frets: [3, 2, 0, 0, 0, 2], fingers: [2, 1, 0, 0, 0, 3] },
    Gm7: { frets: [3, 5, 3, 3, 3, 3], fingers: [1, 3, 1, 1, 1, 1], barre: 3 },
    Gsus4: { frets: [3, 3, 0, 0, 3, 3], fingers: [2, 3, 0, 0, 1, 4] },
    Gadd9: { frets: [3, 2, 0, 2, 0, 3], fingers: [2, 1, 0, 3, 0, 4] },
    G6: { frets: [3, 2, 0, 0, 0, 0], fingers: [3, 2, 0, 0, 0, 0] },

    Ab: { frets: [4, 6, 6, 5, 4, 4], fingers: [1, 3, 4, 2, 1, 1], barre: 4 },
    Abm: { frets: [4, 6, 6, 4, 4, 4], fingers: [1, 3, 4, 1, 1, 1], barre: 4 },

    A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
    Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    A7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
    Amaj7: { frets: [-1, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0] },
    Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
    Asus4: { frets: [-1, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 4, 0] },
    Asus2: { frets: [-1, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
    Aadd9: { frets: [-1, 0, 2, 4, 2, 0], fingers: [0, 0, 1, 3, 2, 0] },
    A6: { frets: [-1, 0, 2, 2, 2, 2], fingers: [0, 0, 1, 1, 1, 1], barre: 2 },
    A9: { frets: [-1, 0, 2, 4, 2, 3], fingers: [0, 0, 1, 3, 2, 4] },

    Bb: { frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1], barre: 1 },
    Bbm: { frets: [-1, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], barre: 1 },
    Bb7: { frets: [-1, 1, 3, 1, 3, 1], fingers: [0, 1, 3, 1, 4, 1], barre: 1 },

    B: { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barre: 2 },
    Bm: { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: 2 },
    B7: { frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
    Bmaj7: {
        frets: [-1, 2, 4, 3, 4, 2],
        fingers: [0, 1, 3, 2, 4, 1],
        barre: 2,
    },
    Bm7: { frets: [-1, 2, 4, 2, 3, 2], fingers: [0, 1, 3, 1, 2, 1], barre: 2 },
};

const SLASH_CHORD_SHAPES: Record<string, GuitarShape> = {
    "C/E": { frets: [0, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    "C/G": { frets: [3, 3, 2, 0, 1, 0], fingers: [3, 4, 2, 0, 1, 0] },
    "C/Bb": { frets: [-1, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },

    "D/F#": { frets: [2, 0, 0, 2, 3, 2], fingers: [1, 0, 0, 2, 4, 3] },
    "D/A": { frets: [-1, 0, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },

    "E/G#": { frets: [4, 2, 2, 1, 0, 0], fingers: [4, 2, 3, 1, 0, 0] },
    "E/B": { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },

    "F/A": { frets: [-1, 0, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1] },
    "F/C": {
        frets: [8, 8, 10, 10, 10, 8],
        fingers: [1, 1, 2, 3, 4, 1],
        barre: 8,
    },

    "G/B": { frets: [-1, 2, 0, 0, 3, 3], fingers: [0, 1, 0, 0, 3, 4] },
    "G/D": { frets: [-1, -1, 0, 0, 3, 3], fingers: [0, 0, 0, 0, 3, 4] },
    "G/F": { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },

    "A/C#": { frets: [-1, 4, 2, 2, 2, -1], fingers: [0, 4, 1, 1, 1, 0] },
    "A/E": { frets: [0, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
    "A/G": { frets: [3, 0, 2, 2, 2, 0], fingers: [4, 0, 1, 2, 3, 0] },

    "B/D#": { frets: [-1, 6, 4, 4, 4, -1], fingers: [0, 3, 1, 1, 1, 0] },
    "B/F#": {
        frets: [2, 2, 4, 4, 4, 2],
        fingers: [1, 1, 2, 3, 4, 1],
        barre: 2,
    },

    "Am/G": { frets: [3, 0, 2, 2, 1, 0], fingers: [4, 0, 2, 3, 1, 0] },
    "Am/F#": { frets: [2, 0, 2, 2, 1, 0], fingers: [2, 0, 3, 4, 1, 0] },
    "Am/E": { frets: [0, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },

    "Dm/C": { frets: [-1, 3, 0, 2, 3, 1], fingers: [0, 3, 0, 2, 4, 1] },
    "Dm/B": { frets: [-1, 2, 0, 2, 3, 1], fingers: [0, 2, 0, 3, 4, 1] },
    "Dm/A": { frets: [-1, 0, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
    "Dm/F": { frets: [1, -1, 0, 2, 3, 1], fingers: [1, 0, 0, 2, 4, 3] },

    "Em/D": { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
    "Em/C#": { frets: [0, 4, 2, 0, 0, 0], fingers: [0, 3, 1, 0, 0, 0] },
    "Em/B": {
        frets: [7, 7, 9, 9, 8, 7],
        fingers: [1, 1, 3, 4, 2, 1],
        barre: 7,
    },
    "Em/G": { frets: [3, 2, 2, 0, 0, 0], fingers: [3, 1, 2, 0, 0, 0] },

    "Fm/Eb": { frets: [-1, 6, 6, 5, 6, -1], fingers: [0, 2, 3, 1, 4, 0] },
    "Gm/F": {
        frets: [3, 5, 3, 3, 3, 3],
        fingers: [1, 3, 1, 1, 1, 1],
        barre: 3,
    },
    "Bm/A": { frets: [-1, 0, 4, 4, 3, 2], fingers: [0, 0, 3, 4, 2, 1] },
};

// Suffixes used to reconstruct a canonical lookup key like "C#m7" for the
// curated tables above, per quality id.
const CANONICAL_SUFFIX: Record<string, string> = {
    major: "",
    minor: "m",
    dom7: "7",
    maj7: "maj7",
    m7: "m7",
    sus4: "sus4",
    sus2: "sus2",
    six: "6",
    add9: "add9",
    nine: "9",
};

// -- Movable CAGED barre templates. Each is defined at its natural "form root"
// (E=4 for E-form, A=9 for A-form) with shift=0 meaning the open-position
// voicing itself; shift>0 is the barred, transposed version. --
interface BarreTemplate {
    formRootSemitone: number;
    frets: number[];
    openFingers?: number[];
    barreFingers: number[];
}

const E_FORM: Record<string, BarreTemplate> = {
    major: {
        formRootSemitone: 4,
        frets: [0, 2, 2, 1, 0, 0],
        openFingers: [0, 2, 3, 1, 0, 0],
        barreFingers: [1, 3, 4, 2, 1, 1],
    },
    minor: {
        formRootSemitone: 4,
        frets: [0, 2, 2, 0, 0, 0],
        openFingers: [0, 2, 3, 0, 0, 0],
        barreFingers: [1, 3, 4, 1, 1, 1],
    },
    dom7: {
        formRootSemitone: 4,
        frets: [0, 2, 0, 1, 0, 0],
        openFingers: [0, 2, 0, 1, 0, 0],
        barreFingers: [1, 3, 1, 2, 1, 1],
    },
    m7: {
        formRootSemitone: 4,
        frets: [0, 2, 0, 0, 0, 0],
        openFingers: [0, 2, 0, 0, 0, 0],
        barreFingers: [1, 3, 1, 1, 1, 1],
    },
    maj7: {
        formRootSemitone: 4,
        frets: [0, 2, 1, 1, 0, 0],
        openFingers: [0, 3, 1, 2, 0, 0],
        barreFingers: [1, 3, 2, 2, 1, 1],
    },
    sus4: {
        formRootSemitone: 4,
        frets: [0, 2, 2, 2, 0, 0],
        openFingers: [0, 2, 3, 4, 0, 0],
        barreFingers: [1, 3, 4, 4, 1, 1],
    },
};

const A_FORM: Record<string, BarreTemplate> = {
    major: {
        formRootSemitone: 9,
        frets: [-1, 0, 2, 2, 2, 0],
        openFingers: [0, 0, 1, 2, 3, 0],
        barreFingers: [0, 1, 3, 4, 4, 1],
    },
    minor: {
        formRootSemitone: 9,
        frets: [-1, 0, 2, 2, 1, 0],
        openFingers: [0, 0, 2, 3, 1, 0],
        barreFingers: [0, 1, 3, 4, 2, 1],
    },
    dom7: {
        formRootSemitone: 9,
        frets: [-1, 0, 2, 0, 2, 0],
        openFingers: [0, 0, 1, 0, 2, 0],
        barreFingers: [0, 1, 3, 1, 4, 1],
    },
    m7: {
        formRootSemitone: 9,
        frets: [-1, 0, 2, 0, 1, 0],
        openFingers: [0, 0, 2, 0, 1, 0],
        barreFingers: [0, 1, 3, 1, 2, 1],
    },
    maj7: {
        formRootSemitone: 9,
        frets: [-1, 0, 2, 1, 2, 0],
        openFingers: [0, 0, 2, 1, 3, 0],
        barreFingers: [0, 1, 3, 2, 4, 1],
    },
    sus4: {
        formRootSemitone: 9,
        frets: [-1, 0, 2, 2, 3, 0],
        openFingers: [0, 0, 1, 2, 4, 0],
        barreFingers: [0, 1, 3, 3, 4, 1],
    },
    sus2: {
        formRootSemitone: 9,
        frets: [-1, 0, 2, 2, 0, 0],
        openFingers: [0, 0, 1, 2, 0, 0],
        barreFingers: [0, 1, 3, 4, 1, 1],
    },
};

function realizeTemplate(
    t: BarreTemplate,
    targetSemitone: number,
): GuitarShape {
    const shift = (((targetSemitone - t.formRootSemitone) % 12) + 12) % 12;
    const frets = t.frets.map((f) => (f < 0 ? f : f + shift));
    if (shift === 0) return { frets, fingers: t.openFingers ?? t.barreFingers };
    return { frets, fingers: t.barreFingers, barre: shift };
}

/** Highest fretted (non-muted) fret in a shape — used to prefer the more playable form. */
function maxFret(shape: GuitarShape): number {
    return Math.max(0, ...shape.frets.filter((f) => f >= 0));
}

function templateFingering(
    qualityId: string,
    targetSemitone: number,
): GuitarShape | null {
    const e = E_FORM[qualityId];
    const a = A_FORM[qualityId];
    if (!e && !a) return null;
    if (e && !a) return realizeTemplate(e, targetSemitone);
    if (a && !e) return realizeTemplate(a, targetSemitone);
    const eShape = realizeTemplate(e!, targetSemitone);
    const aShape = realizeTemplate(a!, targetSemitone);
    return maxFret(aShape) <= maxFret(eShape) ? aShape : eShape;
}

/** Power chords: pure math, root on the low-E string, works for any root. */
function powerChordShape(targetSemitone: number): GuitarShape {
    const shift = (((targetSemitone - 4) % 12) + 12) % 12; // relative to open low E
    return {
        frets: [shift, shift + 2, shift + 2, -1, -1, -1],
        fingers: [1, 3, 4, 0, 0, 0],
    };
}

const TEMPLATE_QUALITIES = new Set([
    "major",
    "minor",
    "dom7",
    "m7",
    "maj7",
    "sus4",
    "sus2",
]);

function getGuitarFingering(
    parsed: ParsedChord,
): { shape: GuitarShape; approximate: boolean } | null {
    const { rootSemitone, quality, raw, rootDisplay } = parsed;

    // 1) Curated exact shape for the full symbol (handles slash chords too).
    if (SLASH_CHORD_SHAPES[raw])
        return { shape: SLASH_CHORD_SHAPES[raw], approximate: false };
    if (OPEN_CHORD_SHAPES[raw])
        return { shape: OPEN_CHORD_SHAPES[raw], approximate: false };

    // 2) Curated exact shape for the reconstructed canonical name (e.g. "C#m7").
    const suffix = CANONICAL_SUFFIX[quality.id];
    if (suffix !== undefined) {
        const canonical = rootDisplay + suffix;
        if (OPEN_CHORD_SHAPES[canonical])
            return { shape: OPEN_CHORD_SHAPES[canonical], approximate: false };
    }

    // 3) Power chords: always exact, any root.
    if (quality.id === "five")
        return { shape: powerChordShape(rootSemitone), approximate: false };

    // 4) Movable barre template for this exact quality.
    if (TEMPLATE_QUALITIES.has(quality.id)) {
        const shape = templateFingering(quality.id, rootSemitone);
        if (shape) return { shape, approximate: false };
    }

    // 5) Walk the simplification chain to the nearest quality that has a shape,
    //    and flag the result so callers/UI can show "(approx.)" if they want to.
    let fallbackId = QUALITY_SIMPLIFICATION[quality.id];
    let hops = 0;
    while (fallbackId && hops < 4) {
        if (TEMPLATE_QUALITIES.has(fallbackId)) {
            const shape = templateFingering(fallbackId, rootSemitone);
            if (shape) return { shape, approximate: true };
        }
        const suf = CANONICAL_SUFFIX[fallbackId];
        if (suf !== undefined) {
            const canonical = rootDisplay + suf;
            if (OPEN_CHORD_SHAPES[canonical])
                return {
                    shape: OPEN_CHORD_SHAPES[canonical],
                    approximate: true,
                };
        }
        fallbackId = QUALITY_SIMPLIFICATION[fallbackId];
        hops += 1;
    }

    return null;
}

// ============================================================================
// Public dictionary
// ============================================================================

export class DefaultChordDictionary implements IChordDictionary {
    getFingering(chord: string): ChordFingering | null {
        const parsed = parseChordSymbol(chord);
        if (!parsed) return null;

        const piano = computePianoVoicing(
            parsed.rootSemitone,
            parsed.quality.intervals,
            parsed.bassSemitone,
        );
        const guitar = getGuitarFingering(parsed);

        return {
            chord: parsed.raw,
            qualityId: parsed.quality.id,
            qualityLabel: parsed.quality.label,
            piano,
            guitar: guitar
                ? {
                      frets: guitar.shape.frets,
                      fingers: guitar.shape.fingers,
                      barre: guitar.shape.barre,
                      approximate: guitar.approximate || undefined,
                  }
                : undefined,
        };
    }
}

export const chordDictionary = new DefaultChordDictionary();
