export interface ChordOccurrence {
  value: string;
  meta: string;
  score: number;
}

export class ChordFinder {
  private static readonly CHORD_REGEX = /\[(.*?)\]/gi;

  /**
   * Extracts chords from text and returns them formatted for Ace Autocomplete
   */
  public static getChords(text: string): ChordOccurrence[] {
    const matches = String(text).match(this.CHORD_REGEX);

    if (!matches || matches.length === 0) {
      return [];
    }

    // Count occurrences
    const chordCounts = matches.reduce(
      (acc, chord) => {
        acc[chord] = (acc[chord] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Map to Ace Autocomplete format and sort by most used
    return Object.entries(chordCounts)
      .map(([chord, count]) => ({
        value: chord,
        meta: `${count} occurrence${count > 1 ? "s" : ""}`,
        score: count, // Ace uses score to rank autocomplete suggestions
      }))
      .sort((a, b) => b.score - a.score);
  }
}
