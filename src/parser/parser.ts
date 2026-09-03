export interface SegmentAST {
  chord: string;
  text: string;
  timing?: number;
}

export interface MeasureAST {
  chords: SegmentAST[];
  endBarline: string;
}

export interface LineAST {
  type:
    "lyrics" | "comment" | "comment_box" | "tab" | "empty" | "chord-section";
  text?: string;
  segments?: SegmentAST[];
  measures?: MeasureAST[];
  startBarline?: string;
}

export interface SectionAST {
  type: "verse" | "chorus" | "bridge" | "tab" | "comment" | "grid" | "new_song";
  label?: string;
  lines: LineAST[];
  repeat?: string;
}

export interface ChordProVersion {
  id: string;
  name: string;
  metadata: Record<string, string>;
  body: SectionAST[];
}

export interface ChordProDocument {
  default: ChordProVersion;
  variants: ChordProVersion[];
  errors: string[];
}

export interface SongAST {
  id?: string;
  name?: string;
  metadata: {
    title?: string;
    subtitle?: string;
    artist?: string;
    composer?: string;
    copyright?: string;
    album?: string;
    key?: string;
    originalKey?: string;
    tempo?: string;
    time?: string;
    capo?: string;
    songNumber?: string;
    youtube?: string;
    ccli?: string;
    duration?: string;
    [key: string]: string | undefined;
  };
  sections: SectionAST[];
  default?: ChordProVersion;
  variants?: ChordProVersion[];
  errors?: string[];
}

const TIMING_REGEX = /^(.+?)@([0-9]*\.?[0-9]+)x$/;

function parseChordTiming(rawChord: string): {
  chord: string;
  timing?: number;
} {
  const match = rawChord.match(TIMING_REGEX);
  if (match) return { chord: match[1], timing: parseFloat(match[2]) };
  return { chord: rawChord };
}

export function parseLineSegments(lineText: string): SegmentAST[] {
  const segments: SegmentAST[] = [];
  const regex = /\[([^\]]+)\]/g;
  let match;
  let lastIndex = 0;
  let currentChord = "";
  let currentTiming: number | undefined;

  while ((match = regex.exec(lineText)) !== null) {
    const rawChord = match[1];
    const { chord, timing } = parseChordTiming(rawChord);
    const textBefore = lineText.slice(lastIndex, match.index);

    if (lastIndex === 0 && textBefore === "") {
      currentChord = chord;
      currentTiming = timing;
    } else {
      segments.push({
        chord: currentChord,
        text: textBefore,
        timing: currentTiming,
      });
      currentChord = chord;
      currentTiming = timing;
    }
    lastIndex = regex.lastIndex;
  }

  const remainingText = lineText.slice(lastIndex);
  segments.push({
    chord: currentChord,
    text: remainingText,
    timing: currentTiming,
  });

  return segments;
}

export function slugifyVariantName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric chars with hyphen
    .replace(/^-+|-+$/g, ""); // remove leading/trailing hyphens
}

export function parseChordProDocument(content: string): ChordProDocument {
  const lines = content.split(/\r?\n/);
  const errors: string[] = [];

  const defaultVersion: ChordProVersion = {
    id: "default",
    name: "Padrão",
    metadata: {},
    body: [],
  };

  const variants: ChordProVersion[] = [];

  interface VersionContext {
    isDefault: boolean;
    id: string;
    name: string;
    metadata: Record<string, string>;
    sections: SectionAST[];
    currentSection: SectionAST | null;
    isTab: boolean;
    isGrid: boolean;
    lastChorusLines: LineAST[];
    startLineNumber: number;
  }

  const defaultContext: VersionContext = {
    isDefault: true,
    id: "default",
    name: "Padrão",
    metadata: {},
    sections: [],
    currentSection: null,
    isTab: false,
    isGrid: false,
    lastChorusLines: [],
    startLineNumber: 1,
  };

  let activeVariantContext: VersionContext | null = null;
  const seenVariantIds = new Set<string>();

  const commitSectionInContext = (ctx: VersionContext) => {
    if (ctx.currentSection) {
      ctx.sections.push(ctx.currentSection);
      if (ctx.currentSection.type === "chorus") {
        ctx.lastChorusLines = [...ctx.currentSection.lines];
      }
      ctx.currentSection = null;
    }
  };

  const aliasMap: Record<string, string> = {
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
    time_signature: "time",
    timesignature: "time",
    "time signature": "time",
    original_key: "original_key",
    "original key": "original_key",
    sov_ver: "start_of_version",
    start_of_version: "start_of_version",
    end_of_version: "end_of_version",
    eov_ver: "end_of_version",
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmed = line.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const directive = trimmed.slice(1, -1).trim();
      const colonIndex = directive.indexOf(":");
      let rawName = directive;
      let value = "";

      if (colonIndex !== -1) {
        rawName = directive.substring(0, colonIndex).trim();
        value = directive.substring(colonIndex + 1).trim();
      }

      const lowerName = rawName.toLowerCase();
      const name = aliasMap[lowerName] || lowerName;

      // Handle version directives
      if (name === "start_of_version") {
        if (activeVariantContext) {
          errors.push(
            `Line ${lineNumber}: Nested version block detected. "{start_of_version}" cannot be inside another version block.`,
          );
          continue;
        }

        const versionName = value.trim();
        if (!versionName) {
          errors.push(
            `Line ${lineNumber}: Empty version name in "{start_of_version}".`,
          );
          continue;
        }

        const variantId = slugifyVariantName(versionName);
        if (!variantId || variantId === "default" || seenVariantIds.has(variantId)) {
          errors.push(
            `Line ${lineNumber}: Duplicate or invalid variant identifier "${variantId || versionName}".`,
          );
          continue;
        }

        // Commit pending section in outer context before switching
        commitSectionInContext(defaultContext);

        seenVariantIds.add(variantId);

        // Previous resolved metadata
        const previousMetadata =
          variants.length > 0
            ? variants[variants.length - 1].metadata
            : defaultContext.metadata;

        activeVariantContext = {
          isDefault: false,
          id: variantId,
          name: versionName,
          metadata: { ...previousMetadata },
          sections: [],
          currentSection: null,
          isTab: false,
          isGrid: false,
          lastChorusLines: [],
          startLineNumber: lineNumber,
        };
        continue;
      }

      if (name === "end_of_version") {
        if (!activeVariantContext) {
          errors.push(
            `Line ${lineNumber}: Unexpected "{end_of_version}" without an active version block.`,
          );
          continue;
        }

        commitSectionInContext(activeVariantContext);
        if (!activeVariantContext.metadata.title) {
          activeVariantContext.metadata.title = defaultContext.metadata.title || "Sem Título";
        }

        variants.push({
          id: activeVariantContext.id,
          name: activeVariantContext.name,
          metadata: activeVariantContext.metadata,
          body: activeVariantContext.sections,
        });

        activeVariantContext = null;
        continue;
      }

      // Normal directive dispatch within the active context
      const ctx = activeVariantContext ?? defaultContext;

      switch (name) {
        case "start_of_chorus":
          commitSectionInContext(ctx);
          ctx.currentSection = {
            type: "chorus",
            label: value || "Refrão",
            lines: [],
          };
          break;
        case "start_of_verse":
          commitSectionInContext(ctx);
          ctx.currentSection = {
            type: "verse",
            label: value || "Verso",
            lines: [],
          };
          break;
        case "start_of_bridge":
          commitSectionInContext(ctx);
          ctx.currentSection = {
            type: "bridge",
            label: value || "Ponte",
            lines: [],
          };
          break;
        case "start_of_tab":
          commitSectionInContext(ctx);
          ctx.isTab = true;
          ctx.currentSection = {
            type: "tab",
            label: value || "Tablatura",
            lines: [],
          };
          break;
        case "start_of_grid":
          commitSectionInContext(ctx);
          ctx.isGrid = true;
          ctx.currentSection = { type: "grid", label: value || "Grid", lines: [] };
          break;

        case "end_of_chorus":
          if (ctx.currentSection?.type === "chorus") commitSectionInContext(ctx);
          break;
        case "end_of_verse":
          if (ctx.currentSection?.type === "verse") commitSectionInContext(ctx);
          break;
        case "end_of_bridge":
          if (ctx.currentSection?.type === "bridge") commitSectionInContext(ctx);
          break;
        case "end_of_tab":
          ctx.isTab = false;
          if (ctx.currentSection?.type === "tab") commitSectionInContext(ctx);
          break;
        case "end_of_grid":
          ctx.isGrid = false;
          if (ctx.currentSection?.type === "grid") commitSectionInContext(ctx);
          break;

        case "chorus":
          commitSectionInContext(ctx);
          ctx.sections.push({
            type: "chorus",
            label: value || "Refrão",
            lines: [...ctx.lastChorusLines],
          });
          break;
        case "verse":
          commitSectionInContext(ctx);
          ctx.currentSection = {
            type: "verse",
            label: value || "Verso",
            lines: [],
          };
          break;
        case "bridge":
          commitSectionInContext(ctx);
          ctx.currentSection = {
            type: "bridge",
            label: value || "Ponte",
            lines: [],
          };
          break;

        case "comment":
        case "comment_italic":
          const commentLine: LineAST = { type: "comment", text: value };
          if (ctx.currentSection) ctx.currentSection.lines.push(commentLine);
          else ctx.sections.push({ type: "comment", lines: [commentLine] });
          break;

        case "comment_box":
          const cbLine: LineAST = { type: "comment_box", text: value };
          if (ctx.currentSection) ctx.currentSection.lines.push(cbLine);
          else ctx.sections.push({ type: "comment", lines: [cbLine] });
          break;

        case "repeat":
          if (ctx.currentSection) {
            ctx.currentSection.repeat = value || "2";
          } else {
            ctx.sections.push({
              type: "comment",
              lines: [
                { type: "comment_box", text: `Repetir: ${value || "2"}` },
              ],
            });
          }
          break;

        case "new_song":
          commitSectionInContext(ctx);
          ctx.sections.push({ type: "new_song", lines: [] });
          break;

        case "duration":
          if (/^\d{1,2}:\d{2}$/.test(value)) {
            const [minutes, seconds] = value.split(":").map(Number);
            ctx.metadata["duration"] = (minutes * 60 + seconds).toString();
          } else {
            ctx.metadata["duration"] = value;
          }
          break;

        default:
          if (value) {
            const metaKey = name
              .replace(/[-_\s]+([a-zA-Z])/g, (_, letter) =>
                letter.toUpperCase(),
              )
              .replace(/\s+/g, "");
            ctx.metadata[metaKey] = value;
          }
          break;
      }
      continue;
    }

    const ctx = activeVariantContext ?? defaultContext;

    if (trimmed === "") {
      if (ctx.currentSection) ctx.currentSection.lines.push({ type: "empty" });
      continue;
    }

    if (trimmed.startsWith("#") && !ctx.isTab) continue;

    let lineType: LineAST["type"] = "lyrics";
    let parsedSegments: SegmentAST[] = [];

    if (ctx.isTab) {
      lineType = "tab";
    } else {
      parsedSegments = parseLineSegments(line);
      const textContent = parsedSegments.map((s) => s.text).join("");
      // Atualizado para englobar '.' e '%' comuns em grelhas instrumentais
      const onlyBarsAndSpaces = /^[\s|:\-.%]*$/.test(textContent);
      const hasBars = textContent.includes("|");

      // Se estamos numa grelha, forçamos os acordes a serem uma `chord-section`.
      if (ctx.isGrid || (onlyBarsAndSpaces && hasBars)) {
        lineType = "chord-section";
      }
    }

    const parsedLine: LineAST = { type: lineType };

    if (lineType === "tab") {
      parsedLine.text = line;
    } else if (lineType === "lyrics") {
      parsedLine.segments = parsedSegments;
    } else if (lineType === "chord-section") {
      parsedLine.segments = parsedSegments;
      const measures: MeasureAST[] = [];
      let currentChords: SegmentAST[] = [];
      let startBarline = "";
      let hasSeenChord = false;
      let startBarlineFound = false;

      for (let sIdx = 0; sIdx < parsedSegments.length; sIdx++) {
        const seg = parsedSegments[sIdx];
        if (seg.chord) {
          currentChords.push({
            chord: seg.chord,
            text: "",
            timing: seg.timing,
          });
          hasSeenChord = true;
        }

        const barlineMatches = seg.text.match(/\|\||:\||\|:|\|/g);
        if (barlineMatches) {
          for (let bIdx = 0; bIdx < barlineMatches.length; bIdx++) {
            const b = barlineMatches[bIdx];
            if (!hasSeenChord && !startBarlineFound) {
              startBarline = b;
              startBarlineFound = true;
            } else {
              measures.push({ chords: currentChords, endBarline: b });
              currentChords = [];
            }
          }
        }
      }

      if (currentChords.length > 0) {
        measures.push({ chords: currentChords, endBarline: "" });
      }

      parsedLine.measures = measures;
      parsedLine.startBarline = startBarline;
    }

    if (!ctx.currentSection) ctx.currentSection = { type: "verse", lines: [] };
    ctx.currentSection.lines.push(parsedLine);
  }

  // Check if file ended while a variant is still open
  if (activeVariantContext) {
    errors.push(
      `File ended while variant "${activeVariantContext.name}" (started at line ${activeVariantContext.startLineNumber}) was still open. Missing "{end_of_version}".`,
    );
    commitSectionInContext(activeVariantContext);
    if (!activeVariantContext.metadata.title) {
      activeVariantContext.metadata.title = defaultContext.metadata.title || "Sem Título";
    }
    variants.push({
      id: activeVariantContext.id,
      name: activeVariantContext.name,
      metadata: activeVariantContext.metadata,
      body: activeVariantContext.sections,
    });
  }

  commitSectionInContext(defaultContext);
  if (!defaultContext.metadata.title) {
    defaultContext.metadata.title = "Sem Título";
  }

  defaultVersion.metadata = defaultContext.metadata;
  defaultVersion.body = defaultContext.sections;

  return {
    default: defaultVersion,
    variants,
    errors,
  };
}

export function selectVersion(
  document: ChordProDocument,
  versionId?: string,
): ChordProVersion {
  if (!versionId || versionId === "default") {
    return document.default;
  }
  const found = document.variants.find((v) => v.id === versionId);
  return found || document.default;
}

export function parseChordPro(content: string): SongAST {
  const doc = parseChordProDocument(content);
  return {
    id: doc.default.id,
    name: doc.default.name,
    metadata: doc.default.metadata,
    sections: doc.default.body,
    default: doc.default,
    variants: doc.variants,
    errors: doc.errors,
  };
}

export function buildChordProText(
  metadata: { [key: string]: string | undefined },
  bodyContent: string,
): string {
  const lines: string[] = [];
  const primaryKeys = [
    "title",
    "subtitle",
    "artist",
    "composer",
    "album",
    "copyright",
    "key",
    "originalKey",
    "capo",
    "tempo",
    "time",
    "duration",
    "songNumber",
    "ccli",
    "youtube",
  ];

  for (const k of primaryKeys) {
    if (metadata[k]) {
      const directiveName = k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
      lines.push(`{${directiveName}: ${metadata[k]}}`);
    }
  }

  for (const k in metadata) {
    if (!primaryKeys.includes(k) && metadata[k] && k !== "title") {
      const directiveName = k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
      lines.push(`{${directiveName}: ${metadata[k]}}`);
    }
  }

  lines.push("");
  lines.push(bodyContent.trim());
  return lines.join("\n");
}
