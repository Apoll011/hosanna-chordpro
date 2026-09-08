import type { ReactNode } from "react";

/**
 * Modular instrument system
 * --------------------------
 * Every instrument (guitar, piano, ukulele, ...) is described by a single
 * `InstrumentProfile`. The renderer never special-cases an instrument by
 * name: it asks the profile to resolve a chord into a "shape" (whatever
 * data that instrument needs — frets, highlighted keys, etc.) and asks the
 * same profile to render that shape as a diagram.
 *
 * Adding a brand-new instrument to the app is just:
 *   1. Implement `InstrumentProfile<TShape>` in its own file.
 *   2. `instrumentRegistry.register(myInstrument)`.
 * No changes to ChordRoll, the renderer, or any other instrument are needed.
 */

export type InstrumentCategory = "string" | "keyboard" | "other";

export interface InstrumentFingering<TShape = unknown> {
  /** Chord symbol this fingering was resolved for (already transposed). */
  chord: string;
  /** Canonical quality id, e.g. "m7", "maj7". Shared across instruments. */
  qualityId: string;
  /** Human readable quality label, e.g. "Minor 7th". */
  qualityLabel: string;
  /** True when the instrument had no exact voicing and substituted a
   *  close approximation instead. */
  approximate?: boolean;
  /** Instrument-specific shape data (frets/fingers, highlighted keys, ...). */
  shape: TShape;
}

export interface InstrumentProfile<TShape = unknown> {
  /** Stable identifier, used as the value stored in user settings/props. */
  id: string;
  /** Human readable name shown in instrument pickers. */
  displayName: string;
  category: InstrumentCategory;
  /** Whether a capo setting should shift this instrument's chord voicings. */
  supportsCapo?: boolean;
  /** Tailwind width class used to lay this instrument's card out in a
   *  horizontal chord roll. */
  layoutWidthClass?: string;
  /** Resolve a chord symbol into this instrument's fingering/shape. */
  getFingering(chord: string): InstrumentFingering<TShape> | null;
  /** Render a diagram (SVG/JSX) for a previously resolved shape. */
  renderDiagram(shape: TShape): ReactNode;
  /** Optional secondary label shown under the diagram (e.g. note names). */
  getSubLabel?(shape: TShape): string | null;
  /** Text shown when a chord has no fingering available at all. */
  unavailableLabel?: string;
}
