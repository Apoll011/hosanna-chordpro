import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InstrumentRegistry, instrumentRegistry } from "../src/instruments";

describe("instrument registry", () => {
  it("registers, lists, and unregisters custom instruments", () => {
    const registry = new InstrumentRegistry();
    const profile = {
      id: "test-instrument",
      displayName: "Test",
      category: "other" as const,
      getFingering: (chord: string) => ({
        chord,
        qualityId: "major",
        qualityLabel: "Major",
        shape: { chord },
      }),
      renderDiagram: () => null,
    };
    registry.register(profile);
    assert.equal(registry.has("test-instrument"), true);
    assert.equal(registry.get("test-instrument")?.displayName, "Test");
    assert.equal(registry.list().length, 1);
    registry.unregister("test-instrument");
    assert.equal(registry.has("test-instrument"), false);
  });

  it("registers built-in instruments", () => {
    assert.ok(instrumentRegistry.get("guitar"));
    assert.ok(instrumentRegistry.get("piano"));
    assert.ok(instrumentRegistry.get("ukulele"));
  });
});
