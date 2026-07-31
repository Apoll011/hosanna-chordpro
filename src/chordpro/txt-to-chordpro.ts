export interface ConversionOptions {
  detectSections?: boolean;
  strictChordDetection?: boolean;
  locale?: 'pt' | 'en';
}

export interface ConversionResult {
  chordpro: string;
  title: string | null;
  warnings: string[];
}

type SectionKind = 'verse' | 'chorus' | 'bridge';

interface ParsedLine {
  kind:
    | 'directive'       // já era uma diretiva ChordPro, ex: {title: ...}
    | 'metadata'        // "Tom: G" -> {key: G}
    | 'comment'         // linha iniciada com #
    | 'section-header'  // "Refrão", "Verso 2", "[Ponte]"
    | 'chord-lyric'     // acorde + letra combinados numa linha só
    | 'chord-only'      // trecho instrumental (sem letra correspondente)
    | 'inline-chordpro' // já tinha [Acorde] embutido no texto (idempotência)
    | 'lyric'           // letra pura, sem acorde acima
    | 'blank';
  raw: string;
  rendered?: string;
  section?: SectionKind;
}

const DEFAULT_OPTIONS: Required<ConversionOptions> = {
  detectSections: true,
  strictChordDetection: true,
  locale: 'pt',
};

const CHORD_BODY =
  // 1. Root Note
  '[A-G](?:#|b)?' +
  // 2. Base Quality
  '(?:maj|min|m\\(maj7\\)|mM|m7b5|dim|aug|alt|Δ|°|ø|M|m|\\+|-)?' +
  // 3. Numbered Extension
  '(?:2|4|5|6\\/9|6|7|9|11|13)?' +
  // 4. Post-number Modifiers
  '(?:[Mm+])?' +
  // 5. Suspended Notes
  '(?:sus(?:2|4)?)?' +
  // 6. Added Notes
  '(?:add(?:2|4|6|9|11|13))?' +
  // 7. Omitted Notes
  '(?:(?:omit|no)(?:3|5))?' +
  // 8. Parenthesized Complex Extensions
  '(?:\\((?:[#b]?(?:5|9|11|13)|sus(?:2|4)?|add(?:2|4|9|11|13)|alt|omit(?:3|5)|no(?:3|5))(?:[,/]\\s*[#b]?(?:5|9|11|13))*\\))*' +
  // 9. Unparenthesized Alterations
  '(?:[#b](?:5|9|11|13))*' +
  // 10. Slash Bass Note
  '(?:\\/[A-G](?:#|b)?)?';
const CHORD_TOKEN_REGEX = new RegExp(`^${CHORD_BODY}$`);
const CHORD_SCAN_REGEX = new RegExp(`(?<=^|\\s)(${CHORD_BODY})(?=\\s|$)`, 'g');


const PUNCTUATION_TOKENS = new Set(['|', '%', '-', '.', '...', '/', 'x2', 'x3', 'x4']);

function isValidChordToken(token: string): boolean {
  const clean = token.replace(/^[(]/, '').replace(/[)]$/, '');
  return CHORD_TOKEN_REGEX.test(clean);
}

function isChordLine(line: string, strict: boolean): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/\s+/).filter((t) => !PUNCTUATION_TOKENS.has(t.toLowerCase()));
  if (tokens.length === 0) return false;
  const validCount = tokens.filter(isValidChordToken).length;
  return strict ? validCount === tokens.length : validCount / tokens.length >= 0.8;
}

// Uma linha já convertida anteriormente (ex: "Todo [C]poder a Ele[G7] pertence")
// deve passar direto, sem reprocessar — garante idempotência da conversão.
function isAlreadyInlineChordPro(line: string): boolean {
  const matches = [...line.matchAll(/\[([^\]]+)\]/g)];
  if (matches.length === 0) return false;
  return matches.every((m) => isValidChordToken(m[1]));
}

const METADATA_MAP: Record<string, string> = {
  title: 'title', t: 'title', titulo: 'title', título: 'title',
  subtitle: 'subtitle', st: 'subtitle',
  artist: 'artist', a: 'artist', artista: 'artist', interprete: 'artist', intérprete: 'artist',
  composer: 'composer', music: 'composer', compositor: 'composer',
  lyricist: 'lyricist', words: 'lyricist', letra: 'lyricist', letrista: 'lyricist',
  album: 'album', álbum: 'album',
  key: 'key', tom: 'key',
  capo: 'capo', capotraste: 'capo', capodastro: 'capo',
  tempo: 'tempo', andamento: 'tempo', bpm: 'tempo',
  time: 'time', compasso: 'time',
  year: 'year', ano: 'year',
  copyright: 'copyright',
  duration: 'duration', duracao: 'duration', duração: 'duration',
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SECTION_KEYWORDS: Record<SectionKind, string[]> = {
  verse: ['verso', 'verse'],
  chorus: ['refrao', 'chorus'],
  bridge: ['ponte', 'bridge', 'pre-refrao', 'prechorus', 'pre chorus'],
};

function detectSectionHeader(line: string): SectionKind | null {
  let s = line.trim();
  if (!s || s.length > 24) return null; // cabeçalho é curto; evita falso positivo em letras longas
  s = s.replace(/^\[|\]$/g, '').replace(/:$/, '').trim();
  s = s.replace(/\s*\d+\s*$/, '').trim(); // "Verso 2" -> "Verso"
  const normalized = stripAccents(s).toLowerCase();
  for (const kind of Object.keys(SECTION_KEYWORDS) as SectionKind[]) {
    if (SECTION_KEYWORDS[kind].includes(normalized)) return kind;
  }
  return null;
}

function classify(lines: string[], options: Required<ConversionOptions>): ParsedLine[] {
  const result: ParsedLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, '');
    const trimmed = raw.trim();

    if (trimmed === '') {
      result.push({ kind: 'blank', raw: '' });
      continue;
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      result.push({ kind: 'directive', raw, rendered: trimmed });
      continue;
    }

    if (isAlreadyInlineChordPro(trimmed)) {
      result.push({ kind: 'inline-chordpro', raw, rendered: raw });
      continue;
    }

    const metaMatch = trimmed.match(/^([A-Za-zÀ-ÿ]+):\s*(.*)/);
    if (metaMatch) {
      const key = stripAccents(metaMatch[1].toLowerCase());
      const value = metaMatch[2];
      if (METADATA_MAP[key]) {
        result.push({ kind: 'metadata', raw, rendered: `{${METADATA_MAP[key]}: ${value}}` });
        continue;
      }
    }

    if (trimmed.startsWith('#')) {
      result.push({ kind: 'comment', raw, rendered: `{comment: ${trimmed.slice(1).trim()}}` });
      continue;
    }

    const sectionKind = detectSectionHeader(trimmed);
    if (sectionKind) {
      result.push({ kind: 'section-header', raw, section: sectionKind });
      continue;
    }

    if (isChordLine(raw, options.strictChordDetection)) {
      const nextRaw = i + 1 < lines.length ? lines[i + 1].replace(/\r$/, '') : null;
      const nextIsChord = nextRaw !== null && isChordLine(nextRaw, options.strictChordDetection);
      const nextIsBlank = nextRaw !== null && nextRaw.trim() === '';

      if (nextRaw === null || nextIsChord || nextIsBlank) {
        // Trecho instrumental: não há letra correspondente para casar embaixo.
        const tokens = raw.trim().split(/\s+/);
        result.push({ kind: 'chord-only', raw, rendered: tokens.map((t) => `[${t}]`).join(' ') });
        continue;
      }

      // Próxima linha é letra: funde acordes na posição correta do texto.
      const merged = mergeChordsIntoLyric(raw, nextRaw!);
      result.push({ kind: 'chord-lyric', raw, rendered: merged });
      i++; // consome a linha de letra já usada
      continue;
    }

    // Letra pura, sem acorde acima — antes era (erroneamente) virada em comentário.
    result.push({ kind: 'lyric', raw, rendered: raw });
  }

  return result;
}

function mergeChordsIntoLyric(chordLine: string, lyricLine: string): string {
  const matches = [...chordLine.matchAll(CHORD_SCAN_REGEX)];
  let combined = '';
  let lastIndex = 0;
  for (const match of matches) {
    const chord = match[0];
    const index = match.index ?? 0;
    combined += lyricLine.substring(lastIndex, index);
    combined += `[${chord}]`;
    lastIndex = index;
  }
  combined += lyricLine.substring(lastIndex);
  return combined;
}

function render(lines: ParsedLine[], options: Required<ConversionOptions>): string {
  const out: string[] = [];
  let openSection: SectionKind | null = null;

  const closeSection = () => {
    if (openSection) {
      out.push(`{end_of_${openSection}}`);
      openSection = null;
    }
  };

  for (const line of lines) {
    if (line.kind === 'section-header') {
      if (options.detectSections) {
        closeSection();
        out.push(`{start_of_${line.section}}`);
        openSection = line.section!;
      } else {
        out.push(`{comment: ${line.raw.trim()}}`);
      }
      continue;
    }

    if (line.kind === 'blank') {
      if (options.detectSections) closeSection();
      out.push('');
      continue;
    }

    out.push(line.rendered ?? line.raw);
  }

  if (options.detectSections) closeSection();
  return out.join('\n');
}

function extractTitle(chordpro: string): string | null {
  const match = chordpro.match(/\{title:\s*(.*)\}/i);
  return match ? match[1].trim() : null;
}

/** Gera um nome de arquivo seguro a partir do título (uso opcional, ex: download). */
export function slugifyTitle(title: string | null): string {
  if (!title) return 'cifra_convertida';
  return (
    stripAccents(title)
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '') || 'cifra'
  );
}

/** Versão detalhada: devolve o chordpro, o título detectado e avisos. */
export function convertToChordProDetailed(
  input: string,
  options: ConversionOptions = {}
): ConversionResult {
  const opts: Required<ConversionOptions> = { ...DEFAULT_OPTIONS, ...options };
  const warnings: string[] = [];

  if (!input || !input.trim()) {
    return { chordpro: '', title: null, warnings: ['Entrada vazia.'] };
  }

  const lines = input.split('\n');
  const parsed = classify(lines, opts);
  const chordpro = render(parsed, opts);
  const title = extractTitle(chordpro);

  if (!title) warnings.push('Nenhuma diretiva {title: ...} foi detectada.');

  return { chordpro, title, warnings };
}

/** Versão simples: manda o texto, recebe o ChordPro de volta como string. */
export function toChordPro(input: string, options?: ConversionOptions): string {
  return convertToChordProDetailed(input, options).chordpro;
}
