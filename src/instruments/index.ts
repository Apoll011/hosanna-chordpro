export type {
  InstrumentCategory,
  InstrumentFingering,
  InstrumentProfile,
} from "./types";
export { InstrumentRegistry, instrumentRegistry } from "./registry";

export { GuitarDiagram, guitarInstrument, type GuitarShape } from "./guitar";
export { PianoDiagram, pianoInstrument, type PianoShape } from "./piano";
export {
  UkuleleDiagram,
  ukuleleInstrument,
  type UkuleleShape,
} from "./ukulele";

import { instrumentRegistry } from "./registry";
import { guitarInstrument } from "./guitar";
import { pianoInstrument } from "./piano";
import { ukuleleInstrument } from "./ukulele";

// Register the built-in instruments once, at module load time. Consumers can
// register additional custom instruments the same way:
//   instrumentRegistry.register(myInstrumentProfile)
instrumentRegistry.register(guitarInstrument);
instrumentRegistry.register(pianoInstrument);
instrumentRegistry.register(ukuleleInstrument);
