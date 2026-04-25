import { describe, expect, it } from "vitest";
import { decodeReactorCode, encodeReactorCode } from "../src/domain/codecs";
import { createEmptyDesign } from "../src/domain/defaults";

describe("reactor code codec", () => {
  it("round-trips an empty design", () => {
    const design = createEmptyDesign();
    const decoded = decodeReactorCode(encodeReactorCode(design));
    expect(decoded.grid.flat().every((cell) => cell.componentId == null)).toBe(true);
    expect(decoded.config.fluid).toBe(false);
  });

  it("round-trips GTNH components and runtime config", () => {
    const design = createEmptyDesign({ fluid: true, pulsed: true, currentHeat: 1234, maxSimulationTicks: 4321 });
    design.grid[1][1] = { componentId: 61 };
    design.grid[1][2] = { componentId: 63 };
    design.grid[2][4] = { componentId: 54, initialHeat: 0 };
    design.grid[3][4] = { componentId: 58, initialHeat: 1200 };
    const decoded = decodeReactorCode(encodeReactorCode(design));
    expect(decoded.grid[1][1].componentId).toBe(61);
    expect(decoded.grid[1][2].componentId).toBe(63);
    expect(decoded.grid[2][4].componentId).toBe(54);
    expect(decoded.grid[3][4].componentId).toBe(58);
    expect(decoded.grid[3][4].initialHeat).toBe(1200);
    expect(decoded.config.fluid).toBe(true);
    expect(decoded.config.pulsed).toBe(true);
    expect(decoded.config.currentHeat).toBe(1234);
  });
});
