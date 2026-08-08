import ace from "ace-builds";

export function registerChordproMode(): void {
  (ace as any).define(
    "ace/mode/chordpro_highlight_rules",
    [
      "require",
      "exports",
      "module",
      "ace/lib/oop",
      "ace/mode/text_highlight_rules",
    ],
    (require: any, exports: any) => {
      const oop = require("ace/lib/oop");
      const TextHighlightRules =
        require("ace/mode/text_highlight_rules").TextHighlightRules;

      const ChordproHighlightRules = function (this: any) {
        // Regex Building Blocks
        const rStart = "(\\{\\s*)";
        const rEnd = "(\\s*\\})";
        const rSep = "(\\s*:\\s*)";

        this.$rules = {
          start: [
            // Comments
            { token: "comment.line.number-sign", regex: "^#.*$" },

            // Tab Block Start -> moves to tabBlock state
            {
              token: ["punctuation.tag", "markup.bold", "punctuation.tag"],
              regex: rStart + "(start_of_tab|sot)" + rEnd,
              caseInsensitive: true,
              next: "tabBlock",
            },

            // Grid Block Start -> moves to gridBlock state
            {
              token: ["punctuation.tag", "markup.bold", "punctuation.tag"],
              regex: rStart + "(start_of_grid|sog)" + rEnd,
              caseInsensitive: true,
              next: "gridBlock",
            },

            // Generic Block Starts (Chorus, Verse, Bridge, Custom) with optional labels
            {
              token: [
                "punctuation.tag",
                "markup.bold",
                "punctuation.separator",
                "string",
                "punctuation.tag",
              ],
              regex:
                rStart + "(start_of_[a-z_]+|so[a-z])" + rSep + "(.*?)" + rEnd,
              caseInsensitive: true,
            },
            {
              token: ["punctuation.tag", "markup.bold", "punctuation.tag"],
              regex: rStart + "(start_of_[a-z_]+|so[a-z])" + rEnd,
              caseInsensitive: true,
            },

            // Generic Block Ends
            {
              token: ["punctuation.tag", "markup.bold", "punctuation.tag"],
              regex: rStart + "(end_of_[a-z_]+|eo[a-z])" + rEnd,
              caseInsensitive: true,
            },

            // Formatting & Styling Directives (e.g. textfont, chordsize)
            {
              token: [
                "punctuation.tag",
                "support.type",
                "punctuation.separator",
                "constant.numeric",
                "punctuation.tag",
              ],
              regex:
                rStart +
                "(textfont|textsize|chordfont|chordsize|tabfont|tabsize|gridfont|gridsize)" +
                rSep +
                "(.*?)" +
                rEnd,
              caseInsensitive: true,
            },

            // Meta Directives (e.g. title, key, tempo)
            {
              token: [
                "punctuation.tag",
                "keyword.control",
                "punctuation.separator",
                "string",
                "punctuation.tag",
              ],
              regex:
                rStart +
                "(title|t|subtitle|st|artist|a|composer|lyricist|translator|youtube|copyright|album|year|key|k|time|tempo|duration|capo|meta|c|comment|chord|define|song_number|x_[a-zA-Z0-9_]+)" +
                rSep +
                "(.*?)" +
                rEnd,
              caseInsensitive: true,
            },

            // Standalone Directives (e.g. column_break, new_page)
            {
              token: ["punctuation.tag", "keyword.operator", "punctuation.tag"],
              regex:
                rStart +
                "(column_break|cb|new_page|np|new_song|ns|chorus)" +
                rEnd,
              caseInsensitive: true,
            },

            // Chord Section barlines (||, |:, :|, |)
            {
              token: "constant.character.barline",
              regex: "\\|\\||:\\||\\|:|\\|",
            },

            // Inline Annotations e.g. [* Bass fill]
            {
              token: ["punctuation.tag", "comment.line", "punctuation.tag"],
              regex: "(\\[\\s*\\*)(.*?)(\\])",
            },

            // Chord with timing annotation e.g. [Em@2x] or [C@0.5x]
            {
              token: [
                "punctuation.tag",
                "constant.language.bold",
                "keyword.operator.timing",
                "punctuation.tag",
              ],
              regex: "(\\[)([^\\]@]+)(@[0-9]*\\.?[0-9]+x)(\\])",
            },

            // Chords e.g. [C#maj7/F]
            {
              token: [
                "punctuation.tag",
                "constant.language.bold",
                "punctuation.tag",
              ],
              regex: "(\\[)([^\\]]+)(\\])",
            },

            // Invalid/Unknown braces catch-all
            {
              token: ["punctuation.tag", "invalid", "punctuation.tag"],
              regex: rStart + "(.+?)" + rEnd,
            },
          ],

          // Advanced State for Tablature blocks
          tabBlock: [
            {
              token: ["punctuation.tag", "markup.bold", "punctuation.tag"],
              regex: rStart + "(end_of_tab|eot)" + rEnd,
              caseInsensitive: true,
              next: "start",
            },
            { token: "comment.line", regex: "-+" }, // Tab lines
            { token: "constant.character", regex: "\\|+" }, // Measure bars
            { token: "string.regexp", regex: "^[a-gA-G][b#]?\\s*\\|" }, // Tuning strings at start of line
            { token: "constant.numeric", regex: "\\b[0-9]+\\b" }, // Fret numbers
            { token: "support.function", regex: "[hpsbrv~t]" }, // Articulations (hammer-on, pull-off, bend)
            { defaultToken: "comment" }, // Fallback to comment color for tab lines
          ],

          // Advanced State for Grid blocks (Jazz grids / Chord progression boxes)
          gridBlock: [
            {
              token: ["punctuation.tag", "markup.bold", "punctuation.tag"],
              regex: rStart + "(end_of_grid|eog)" + rEnd,
              caseInsensitive: true,
              next: "start",
            },
            { token: "constant.character", regex: "\\|\\||\\|\\.|\\.\\||\\|" }, // Grid barlines
            { token: "keyword.operator", regex: "%" }, // Grid repeat markers
            {
              token: "constant.language.bold",
              regex: "[A-G][b#]?(?:m|maj|dim|aug|sus|[0-9])*(?:\\/[A-G][b#]?)?",
            }, // Grid Chords (raw text)
            { defaultToken: "text" },
          ],
        };
      };
      oop.inherits(ChordproHighlightRules, TextHighlightRules);
      exports.ChordproHighlightRules = ChordproHighlightRules;
    },
  );

  (ace as any).define(
    "ace/mode/folding/chordpro",
    [
      "require",
      "exports",
      "module",
      "ace/lib/oop",
      "ace/range",
      "ace/mode/folding/fold_mode",
    ],
    (require: any, exports: any) => {
      const oop = require("ace/lib/oop");
      const Range = require("ace/range").Range;
      const BaseFoldMode = require("ace/mode/folding/fold_mode").FoldMode;

      const FoldMode = (exports.FoldMode = function (this: any) {});
      oop.inherits(FoldMode, BaseFoldMode);

      (function (this: any) {
        this.foldingStartMarker =
          /\{\s*(so(?<short>[a-z_]+)|start_of_(?<long>[a-z_]+))(:.*?)?\s*\}/i;
        this.foldingStopMarker =
          /\{\s*(eo(?<short>[a-z_]+)|end_of_(?<long>[a-z_]+))\s*\}/i;

        // Maps short codes to their long equivalents so {soc} matches {end_of_chorus}
        const mapBlockName = (name: string): string => {
          const map: Record<string, string> = {
            c: "chorus",
            v: "verse",
            b: "bridge",
            t: "tab",
            g: "grid",
          };
          return map[name.toLowerCase()] || name.toLowerCase();
        };

        this.getFoldWidgetRange = function (session: any, _: any, row: number) {
          const line = session.getLine(row);
          const match = line.match(this.foldingStartMarker);

          if (match && match.groups) {
            const rawName = match.groups["short"] || match.groups["long"];
            if (!rawName) return;
            return this.getRegionBlock(
              session,
              line,
              row,
              mapBlockName(rawName),
            );
          }
        };

        this.getRegionBlock = function (
          session: any,
          line: string,
          row: number,
          normalizedStartName: string,
        ) {
          const startColumn = line.search(/\s*$/);
          const maxRow = session.getLength();
          const startRow = row;
          let hasMatch = false;

          while (++row < maxRow) {
            line = session.getLine(row);
            const m = this.foldingStopMarker.exec(line);

            if (m && m.groups) {
              const rawEndName = m.groups["short"] || m.groups["long"];
              if (
                rawEndName &&
                mapBlockName(rawEndName) === normalizedStartName
              ) {
                hasMatch = true;
                break;
              }
            }
          }

          if (hasMatch)
            return new Range(startRow, startColumn, row, line.length);
        };
      }).call(FoldMode.prototype);
    },
  );

  (ace as any).define(
    "ace/mode/chordpro",
    [
      "require",
      "exports",
      "module",
      "ace/lib/oop",
      "ace/mode/text",
      "ace/mode/chordpro_highlight_rules",
      "ace/mode/folding/chordpro",
    ],
    (require: any, exports: any) => {
      const oop = require("ace/lib/oop");
      const TextMode = require("ace/mode/text").Mode;
      const ChordproHighlightRules =
        require("ace/mode/chordpro_highlight_rules").ChordproHighlightRules;
      const FoldMode = require("ace/mode/folding/chordpro").FoldMode;

      const Mode = function (this: any) {
        this.HighlightRules = ChordproHighlightRules;
        this.foldingRules = new FoldMode();
      };

      oop.inherits(Mode, TextMode);

      (function (this: any) {
        this.$id = "ace/mode/chordpro";
        this.snippetFileId = "ace/snippets/chordpro";
      }).call(Mode.prototype);

      exports.Mode = Mode;
    },
  );
}
