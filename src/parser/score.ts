import { SongAST } from "./parser";

export interface SongScore {
  score: number;
  missing: Array<
    | "errors"
    | "sections"
    | "chords"
    | "title"
    | "artist"
    | "key"
    | "tempo"
    | "songNumber"
    | "youtube"
    | "duration"
  >;
}

export function scoreSong(song: SongAST): SongScore {
  const missing: SongScore["missing"] = [];
  let score = 0;
  const analysis = song.analyze();
  const metadata = song.metadata;
  const hasValue = (value: string | number | undefined): boolean =>
    value !== undefined && String(value).trim().length > 0;

  const addCriterion = (
    criterion: SongScore["missing"][number],
    condition: boolean,
    points: number,
  ): void => {
    if (condition) {
      score += points;
    } else {
      missing.push(criterion);
    }
  };

  addCriterion("errors", (song.errors?.length ?? 0) === 0, 10);
  addCriterion(
    "sections",
    song.sections.some((section) => section.type === "verse"),
    10,
  );
  addCriterion("chords", analysis.uniqueChords.length > 0, 10);
  addCriterion("title", hasValue(metadata.title), 15);
  addCriterion("artist", hasValue(metadata.artist), 15);
  addCriterion(
    "key",
    hasValue(metadata.key) || hasValue(analysis.detectedKey),
    5,
  );
  addCriterion("tempo", analysis.tempo !== undefined, 5);
  addCriterion("songNumber", hasValue(metadata.songNumber), 10);
  addCriterion("youtube", hasValue(metadata.youtube), 15);
  addCriterion("duration", hasValue(metadata.duration), 5);

  return { score, missing };
}
