import type { InstrumentProfile } from "./types";

/**
 * Central, modular registry of instrument profiles. Instruments register
 * themselves here (see `./index.ts` for the built-ins); consumers of the
 * library can also register their own custom instruments at runtime:
 *
 *   import { instrumentRegistry } from "hosanna-chordpro";
 *   instrumentRegistry.register(myMandolinProfile);
 */
export class InstrumentRegistry {
  private instruments = new Map<string, InstrumentProfile<any>>();

  register<TShape>(instrument: InstrumentProfile<TShape>): void {
    this.instruments.set(instrument.id, instrument);
  }

  unregister(id: string): void {
    this.instruments.delete(id);
  }

  get(id: string): InstrumentProfile<any> | undefined {
    return this.instruments.get(id);
  }

  has(id: string): boolean {
    return this.instruments.has(id);
  }

  list(): InstrumentProfile<any>[] {
    return Array.from(this.instruments.values());
  }
}

/** Shared, app-wide instrument registry. */
export const instrumentRegistry = new InstrumentRegistry();
