export interface SegmentAST {
  chord: string;
  text: string;
}

export interface MeasureAST {
  chords: SegmentAST[];
  endBarline: string;
}

export interface LineAST {
  type: 'lyrics' | 'comment' | 'tab' | 'empty' | 'chord-section';
  text?: string;
  segments?: SegmentAST[];
  measures?: MeasureAST[];
  startBarline?: string;
}

export interface SectionAST {
  type: 'verse' | 'chorus' | 'bridge' | 'tab' | 'comment';
  label?: string;
  lines: LineAST[];
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

// ---------------------------------------------------------------------------
// ChordPro parsing
// ---------------------------------------------------------------------------

export function parseLineSegments(lineText: string): SegmentAST[] {
  const segments: SegmentAST[] = [];
  const regex = /\[([^\]]+)\]/g;
  let match;
  let lastIndex = 0;
  let currentChord = '';

  while ((match = regex.exec(lineText)) !== null) {
    const chord = match[1];
    const textBefore = lineText.slice(lastIndex, match.index);

    if (lastIndex === 0 && textBefore === '') {
      currentChord = chord;
    } else {
      segments.push({ chord: currentChord, text: textBefore });
      currentChord = chord;
    }
    lastIndex = regex.lastIndex;
  }

  const remainingText = lineText.slice(lastIndex);
  segments.push({ chord: currentChord, text: remainingText });

  return segments;
}

export function parseChordPro(content: string): SongAST {
  const lines = content.split(/\r?\n/);
  const metadata: { [key: string]: string } = {};
  const sections: SectionAST[] = [];

  let currentSection: SectionAST | null = null;
  let isTab = false;
  let isGrid = false;
  
  // Guarda as linhas do último refrão para ser invocado com a diretiva {chorus}
  let lastChorusLines: LineAST[] = [];

  const commitSection = () => {
    if (currentSection) {
      sections.push(currentSection);
      if (currentSection.type === 'chorus') {
        lastChorusLines = [...currentSection.lines];
      }
      currentSection = null;
    }
  };

  const aliasMap: Record<string, string> = {
    t: 'title', st: 'subtitle', a: 'artist', k: 'key',
    c: 'comment', ci: 'comment_italic', cb: 'comment_box',
    soc: 'start_of_chorus', eoc: 'end_of_chorus',
    sov: 'start_of_verse', eov: 'end_of_verse',
    sob: 'start_of_bridge', eob: 'end_of_bridge',
    sot: 'start_of_tab', eot: 'end_of_tab',
    sog: 'start_of_grid', eog: 'end_of_grid',
    ch: 'chorus', v: 'verse', b: 'bridge',
    re: 'repeat', ns: 'new_song',
    time_signature: 'time', timesignature: 'time', 'time signature': 'time',
    original_key: 'original_key', 'original key': 'original_key',
  };

  for (let line of lines) {
    const trimmed = line.trim();

    // Diretivas {}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const directive = trimmed.slice(1, -1).trim();
      const colonIndex = directive.indexOf(':');

      let rawName = directive;
      let value = '';

      if (colonIndex !== -1) {
        rawName = directive.substring(0, colonIndex).trim();
        value = directive.substring(colonIndex + 1).trim();
      }
      
      const lowerName = rawName.toLowerCase();
      const name = aliasMap[lowerName] || lowerName;

      switch (name) {
        case 'start_of_chorus':
          commitSection();
          currentSection = { type: 'chorus', label: value || 'Refrão', lines: [] };
          break;
        case 'start_of_verse':
          commitSection();
          currentSection = { type: 'verse', label: value || 'Verso', lines: [] };
          break;
        case 'start_of_bridge':
          commitSection();
          currentSection = { type: 'bridge', label: value || 'Ponte', lines: [] };
          break;
        case 'start_of_tab':
          commitSection();
          isTab = true;
          currentSection = { type: 'tab', label: value || 'Tablatura', lines: [] };
          break;
        case 'start_of_grid':
          commitSection();
          isGrid = true;
          currentSection = { type: 'verse', label: value || 'Grid', lines: [] };
          break;

        case 'end_of_chorus':
          if (currentSection?.type === 'chorus') commitSection();
          break;
        case 'end_of_verse':
          if (currentSection?.type === 'verse') commitSection();
          break;
        case 'end_of_bridge':
          if (currentSection?.type === 'bridge') commitSection();
          break;
        case 'end_of_tab':
          isTab = false;
          if (currentSection?.type === 'tab') commitSection();
          break;
        case 'end_of_grid':
          isGrid = false;
          if (currentSection?.type === 'verse' && currentSection.label === 'Grid') commitSection();
          break;

        case 'chorus':
          // {chorus} no ChordPro copia/repete o refrão passado
          commitSection();
          sections.push({
            type: 'chorus',
            label: value || 'Refrão',
            lines: [...lastChorusLines]
          });
          break;
        
        case 'verse':
          commitSection();
          currentSection = { type: 'verse', label: value || 'Verso', lines: [] };
          break;
          
        case 'bridge':
          commitSection();
          currentSection = { type: 'bridge', label: value || 'Ponte', lines: [] };
          break;

        // Comentários Inline ou Isolados
        case 'comment':
        case 'comment_italic':
        case 'comment_box':
          const commentLine: LineAST = { type: 'comment', text: value };
          if (currentSection) {
            currentSection.lines.push(commentLine);
          } else {
            sections.push({ type: 'comment', lines: [commentLine] });
          }
          break;

        case 'repeat':
          const repeatLine: LineAST = { type: 'comment', text: value ? `Repetir: ${value}` : 'Repetir' };
          if (currentSection) {
            currentSection.lines.push(repeatLine);
          } else {
            sections.push({ type: 'comment', lines: [repeatLine] });
          }
          break;

        case 'new_song':
          commitSection();
          break;

        default:
          if (value) {
             // Normaliza dinamicamente "ccli_number", "original key" para "ccliNumber", "originalKey", etc.
             const metaKey = name
               .replace(/[-_\s]+([a-zA-Z])/g, (_, letter) => letter.toUpperCase())
               .replace(/\s+/g, ''); // limpa sobras
               
             metadata[metaKey] = value;
          }
          break;
      }
      continue;
    }

    if (trimmed === '') {
      if (currentSection) currentSection.lines.push({ type: 'empty' });
      continue;
    }
    
    // Ignorar comentários invisíveis (Padrão ChordPro)
    if (trimmed.startsWith('#') && !isTab) {
      continue;
    }

    let lineType: LineAST['type'] = 'lyrics';
    let parsedSegments: SegmentAST[] = [];

    if (isTab || isGrid) {
      lineType = 'tab';
    } else {
      parsedSegments = parseLineSegments(line);
      const textContent = parsedSegments.map(s => s.text).join('');
      const onlyBarsAndSpaces = /^[\s|:\-]*$/.test(textContent);
      const hasBars = textContent.includes('|');
      
      if (onlyBarsAndSpaces && hasBars) {
         lineType = 'chord-section';
      }
    }

    const parsedLine: LineAST = { type: lineType };

    if (lineType === 'tab') {
      parsedLine.text = line;
    } else if (lineType === 'lyrics') {
      parsedLine.segments = parsedSegments;
    } else if (lineType === 'chord-section') {
      parsedLine.segments = parsedSegments; 
      const measures: MeasureAST[] = [];
      let currentChords: SegmentAST[] = [];
      let startBarline = '';
      let hasSeenChord = false;
      let startBarlineFound = false;

      for (let i = 0; i < parsedSegments.length; i++) {
        const seg = parsedSegments[i];
        if (seg.chord) {
          currentChords.push({ chord: seg.chord, text: '' });
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
        measures.push({ chords: currentChords, endBarline: '' });
      }

      parsedLine.measures = measures;
      parsedLine.startBarline = startBarline;
    }

    if (!currentSection) {
      currentSection = { type: 'verse', lines: [] };
    }
    currentSection.lines.push(parsedLine);
  }

  commitSection();

  if (!metadata.title) {
    metadata.title = 'Sem Título';
  }

  return { metadata, sections };
}

// Para reconstruir o texto padrão, caso necessário
export function buildChordProText(metadata: { [key: string]: string | undefined }, bodyContent: string): string {
  const lines: string[] = [];

  const primaryKeys = [
    'title', 'subtitle', 'artist', 'composer', 'album', 'copyright', 
    'key', 'originalKey', 'capo', 'tempo', 'time', 'duration', 'songNumber', 'ccli', 'youtube'
  ];
  
  for (const k of primaryKeys) {
    if (metadata[k]) {
      const directiveName = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      lines.push(`{${directiveName}: ${metadata[k]}}`);
    }
  }

  for (const k in metadata) {
    if (!primaryKeys.includes(k) && metadata[k] && k !== 'title') {
       const directiveName = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
       lines.push(`{${directiveName}: ${metadata[k]}}`);
    }
  }

  lines.push(''); 
  lines.push(bodyContent.trim());
  return lines.join('\n');
}