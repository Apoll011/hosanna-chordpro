/**
 * ChordPro validation ("lint") engine.
 *
 * This is intentionally independent from `parseChordPro`: the parser is
 * forgiving by design (it never throws, and silently accepts almost
 * anything), which is the right behavior for *rendering* a song. The linter
 * instead walks the same syntax looking for the mistakes people actually
 * make while writing ChordPro — unclosed directives/brackets, mismatched
 * section blocks, unknown chord symbols, malformed timing annotations — and
 * reports them as line/column-addressed diagnostics an editor can surface
 * as squiggly underlines and gutter markers.
 */

import { analyzeChordSymbol } from "./chordDictionary";

export type DiagnosticSeverity = "error" | "warning";

export interface ChordProDiagnostic {
  /** 0-indexed line number. */
  line: number;
  /** 0-indexed character offset where the issue starts. Defaults to the start of the line. */
  column?: number;
  /** 0-indexed character offset where the issue ends (exclusive). Defaults to the end of the line. */
  endColumn?: number;
  severity: DiagnosticSeverity;
  message: string;
  /** Stable machine-readable id for the rule that fired, e.g. "unclosed-bracket". */
  code: string;
}

// Directive names the linter needs to reason about structurally. Kept in
// sync with the alias table in `parser.ts`, but scoped to just the block
// start/end pairs — everything else (metadata, comments, styling) doesn't
// affect structural validity.
const BLOCK_ALIASES: Record<string, string> = {
  sov: "verse",
  start_of_verse: "verse",
  soc: "chorus",
  start_of_chorus: "chorus",
  sob: "bridge",
  start_of_bridge: "bridge",
  sot: "tab",
  start_of_tab: "tab",
  sog: "grid",
  start_of_grid: "grid",
};

const BLOCK_END_ALIASES: Record<string, string> = {
  eov: "verse",
  end_of_verse: "verse",
  eoc: "chorus",
  end_of_chorus: "chorus",
  eob: "bridge",
  end_of_bridge: "bridge",
  eot: "tab",
  end_of_tab: "tab",
  eog: "grid",
  end_of_grid: "grid",
};

const NUMERIC_DIRECTIVES = new Set(["capo", "tempo"]);

function analyzeBracketContent(
  content: string,
  lineIdx: number,
  startCol: number,
  endCol: number,
): ChordProDiagnostic[] {
  const trimmed = content.trim();

  if (trimmed === "") {
    return [
      {
        line: lineIdx,
        column: startCol,
        endColumn: endCol,
        severity: "warning",
        message: "Acorde vazio: '[]'.",
        code: "empty-chord",
      },
    ];
  }

  // Inline annotations, e.g. [* Bass fill], are free text — not a chord.
  if (trimmed.startsWith("*")) return [];

  const timingMatch = trimmed.match(/^(.+?)@(.*)$/);
  const chordPart = timingMatch ? timingMatch[1] : trimmed;
  const diagnostics: ChordProDiagnostic[] = [];

  if (timingMatch && !/^[0-9]*\.?[0-9]+x$/i.test(timingMatch[2])) {
    diagnostics.push({
      line: lineIdx,
      column: startCol,
      endColumn: endCol,
      severity: "warning",
      message: `Anotação de duração mal formatada em "[${trimmed}]" — use algo como [${chordPart}@2x].`,
      code: "malformed-timing",
    });
  }

  const analysis = analyzeChordSymbol(chordPart);
  if (!analysis.hasValidRoot) {
    diagnostics.push({
      line: lineIdx,
      column: startCol,
      endColumn: endCol,
      severity: "warning",
      message: `Acorde não reconhecido: "${chordPart}".`,
      code: "unknown-chord-root",
    });
  } else if (!analysis.qualityRecognized) {
    diagnostics.push({
      line: lineIdx,
      column: startCol,
      endColumn: endCol,
      severity: "warning",
      message: `Qualidade de acorde não reconhecida em "${chordPart}" (assumida como maior).`,
      code: "unknown-chord-quality",
    });
  }

  return diagnostics;
}

function findBracketDiagnostics(
  line: string,
  lineIdx: number,
): ChordProDiagnostic[] {
  const diagnostics: ChordProDiagnostic[] = [];
  let depth = 0;
  let openIdx = -1;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "[") {
      if (depth === 0) openIdx = i;
      depth++;
    } else if (ch === "]") {
      if (depth === 0) {
        diagnostics.push({
          line: lineIdx,
          column: i,
          endColumn: i + 1,
          severity: "error",
          message: "']' de fecho sem '[' correspondente.",
          code: "unmatched-bracket-close",
        });
        continue;
      }
      depth--;
      if (depth === 0 && openIdx !== -1) {
        const content = line.slice(openIdx + 1, i);
        diagnostics.push(
          ...analyzeBracketContent(content, lineIdx, openIdx, i + 1),
        );
        openIdx = -1;
      }
    }
  }

  if (depth > 0 && openIdx !== -1) {
    diagnostics.push({
      line: lineIdx,
      column: openIdx,
      endColumn: line.length,
      severity: "error",
      message: "Acorde não fechado — falta ']'.",
      code: "unclosed-bracket",
    });
  }

  return diagnostics;
}

/**
 * Validates ChordPro source text and returns a list of diagnostics
 * (errors and warnings), each addressed to a line/column range.
 */
export function lintChordPro(content: string): ChordProDiagnostic[] {
  const lines = content.split(/\r?\n/);
  const diagnostics: ChordProDiagnostic[] = [];
  const blockStack: { name: string; line: number }[] = [];
  let inTab = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") continue;

    if (trimmed.startsWith("{")) {
      if (!trimmed.endsWith("}")) {
        diagnostics.push({
          line: i,
          column: line.indexOf("{"),
          endColumn: line.length,
          severity: "error",
          message: "Diretiva não fechada — falta '}'.",
          code: "unclosed-directive",
        });
        continue;
      }

      const directive = trimmed.slice(1, -1).trim();
      if (directive === "") {
        diagnostics.push({
          line: i,
          column: line.indexOf("{"),
          endColumn: line.lastIndexOf("}") + 1,
          severity: "warning",
          message: "Diretiva vazia '{}'.",
          code: "empty-directive",
        });
        continue;
      }

      const colonIdx = directive.indexOf(":");
      const rawName = (
        colonIdx === -1 ? directive : directive.slice(0, colonIdx)
      ).trim();
      const value = colonIdx === -1 ? "" : directive.slice(colonIdx + 1).trim();
      const lowerName = rawName.toLowerCase();

      if (lowerName in BLOCK_ALIASES) {
        const name = BLOCK_ALIASES[lowerName];
        if (name === "tab") inTab = true;
        blockStack.push({ name, line: i });
        continue;
      }

      if (lowerName in BLOCK_END_ALIASES) {
        const name = BLOCK_END_ALIASES[lowerName];
        if (name === "tab") inTab = false;
        const top = blockStack[blockStack.length - 1];
        if (!top) {
          diagnostics.push({
            line: i,
            column: line.indexOf("{"),
            endColumn: line.length,
            severity: "warning",
            message: `'{${rawName}}' sem uma secção '${name}' aberta correspondente.`,
            code: "unmatched-block-end",
          });
        } else if (top.name !== name) {
          diagnostics.push({
            line: i,
            column: line.indexOf("{"),
            endColumn: line.length,
            severity: "warning",
            message: `Esperava-se o fecho de '${top.name}' (aberta na linha ${top.line + 1}), mas encontrou '{${rawName}}'.`,
            code: "mismatched-block-end",
          });
        } else {
          blockStack.pop();
        }
        continue;
      }

      if (
        NUMERIC_DIRECTIVES.has(lowerName) &&
        value &&
        !/^-?[0-9]+(\.[0-9]+)?$/.test(value)
      ) {
        diagnostics.push({
          line: i,
          column: line.indexOf(":") + 1,
          endColumn: line.length,
          severity: "warning",
          message: `Valor de '${rawName}' deveria ser numérico, encontrado "${value}".`,
          code: "non-numeric-value",
        });
      }

      if (
        lowerName === "duration" &&
        value &&
        !/^\d{1,2}:\d{2}$/.test(value) &&
        !/^\d+$/.test(value)
      ) {
        diagnostics.push({
          line: i,
          column: line.indexOf(":") + 1,
          endColumn: line.length,
          severity: "warning",
          message: `Formato de duração inválido: "${value}" — use mm:ss.`,
          code: "invalid-duration",
        });
      }

      continue;
    }

    if (trimmed.startsWith("#") && !inTab) continue;
    if (inTab) continue;

    diagnostics.push(...findBracketDiagnostics(line, i));
  }

  for (const open of blockStack) {
    diagnostics.push({
      line: open.line,
      column: 0,
      severity: "warning",
      message: `Secção '${open.name}' aberta aqui nunca foi fechada (falta o directive de fecho correspondente).`,
      code: "unclosed-block",
    });
  }

  return diagnostics;
}
