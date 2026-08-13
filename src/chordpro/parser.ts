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
    | "lyrics"
    | "comment"
    | "comment_box"
    | "tab"
    | "empty"
    | "chord-section";
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

export interface SongAST {
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

export function parseChordPro(content: string): SongAST {
  const lines = content.split(/\r?\n/);
  const metadata: { [key: string]: string } = {};
  const sections: SectionAST[] = [];

  let currentSection: SectionAST | null = null;
  let isTab = false;
  let isGrid = false;
  let lastChorusLines: LineAST[] = [];

  const commitSection = () => {
    if (currentSection) {
      sections.push(currentSection);
      if (currentSection.type === "chorus") {
        lastChorusLines = [...currentSection.lines];
      }
      currentSection = null;
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
  };

  for (let line of lines) {
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

      switch (name) {
        case "start_of_chorus":
          commitSection();
          currentSection = {
            type: "chorus",
            label: value || "Refrão",
            lines: [],
          };
          break;
        case "start_of_verse":
          commitSection();
          currentSection = {
            type: "verse",
            label: value || "Verso",
            lines: [],
          };
          break;
        case "start_of_bridge":
          commitSection();
          currentSection = {
            type: "bridge",
            label: value || "Ponte",
            lines: [],
          };
          break;
        case "start_of_tab":
          commitSection();
          isTab = true;
          currentSection = {
            type: "tab",
            label: value || "Tablatura",
            lines: [],
          };
          break;
        case "start_of_grid":
          commitSection();
          isGrid = true;
          currentSection = { type: "grid", label: value || "Grid", lines: [] };
          break;

        case "end_of_chorus":
          if (currentSection?.type === "chorus") commitSection();
          break;
        case "end_of_verse":
          if (currentSection?.type === "verse") commitSection();
          break;
        case "end_of_bridge":
          if (currentSection?.type === "bridge") commitSection();
          break;
        case "end_of_tab":
          isTab = false;
          if (currentSection?.type === "tab") commitSection();
          break;
        case "end_of_grid":
          isGrid = false;
          if (currentSection?.type === "grid") commitSection();
          break;

        case "chorus":
          commitSection();
          sections.push({
            type: "chorus",
            label: value || "Refrão",
            lines: [...lastChorusLines],
          });
          break;
        case "verse":
          commitSection();
          currentSection = {
            type: "verse",
            label: value || "Verso",
            lines: [],
          };
          break;
        case "bridge":
          commitSection();
          currentSection = {
            type: "bridge",
            label: value || "Ponte",
            lines: [],
          };
          break;

        case "comment":
        case "comment_italic":
          const commentLine: LineAST = { type: "comment", text: value };
          if (currentSection) currentSection.lines.push(commentLine);
          else sections.push({ type: "comment", lines: [commentLine] });
          break;

        case "comment_box":
          const cbLine: LineAST = { type: "comment_box", text: value };
          if (currentSection) currentSection.lines.push(cbLine);
          else sections.push({ type: "comment", lines: [cbLine] });
          break;

        case "repeat":
          if (currentSection) {
            currentSection.repeat = value || "2";
          } else {
            sections.push({
              type: "comment",
              lines: [
                { type: "comment_box", text: `Repetir: ${value || "2"}` },
              ],
            });
          }
          break;

        case "new_song":
          commitSection();
          sections.push({ type: "new_song", lines: [] });
          break;

        case "duration":
          if (/^\d{1,2}:\d{2}$/.test(value)) {
            const [minutes, seconds] = value.split(":").map(Number);
            metadata["duration"] = (minutes * 60 + seconds).toString();
          } else {
            metadata["duration"] = value;
          }
          break;

        default:
          if (value) {
            const metaKey = name
              .replace(/[-_\s]+([a-zA-Z])/g, (_, letter) =>
                letter.toUpperCase(),
              )
              .replace(/\s+/g, "");
            metadata[metaKey] = value;
          }
          break;
      }
      continue;
    }

    if (trimmed === "") {
      if (currentSection) currentSection.lines.push({ type: "empty" });
      continue;
    }

    if (trimmed.startsWith("#") && !isTab) continue;

    let lineType: LineAST["type"] = "lyrics";
    let parsedSegments: SegmentAST[] = [];

    if (isTab) {
      lineType = "tab";
    } else {
      parsedSegments = parseLineSegments(line);
      const textContent = parsedSegments.map((s) => s.text).join("");
      // Atualizado para englobar '.' e '%' comuns em grelhas instrumentais
      const onlyBarsAndSpaces = /^[\s|:\-.%]*$/.test(textContent);
      const hasBars = textContent.includes("|");

      // Se estamos numa grelha, forçamos os acordes a serem uma `chord-section`.
      if (isGrid || (onlyBarsAndSpaces && hasBars)) {
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

      for (let i = 0; i < parsedSegments.length; i++) {
        const seg = parsedSegments[i];
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
          for (let j = 0; j < barlineMatches.length; j++) {
            const b = barlineMatches[j];
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

    if (!currentSection) currentSection = { type: "verse", lines: [] };
    currentSection.lines.push(parsedLine);
  }

  commitSection();
  if (!metadata.title) metadata.title = "Sem Título";

  return { metadata, sections };
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
