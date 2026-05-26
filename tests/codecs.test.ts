import { describe, expect, it } from "vitest";
import { decodeReactorCode, encodeReactorCode } from "../src/domain/codecs";
import { COMPONENT_BY_ID } from "../src/domain/components";
import { createEmptyDesign } from "../src/domain/defaults";
import type { ComponentDefinition } from "../src/domain/types";

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
    design.grid[3][5] = { componentId: 69, initialHeat: 3600 };
    const decoded = decodeReactorCode(encodeReactorCode(design));
    expect(decoded.grid[1][1].componentId).toBe(61);
    expect(decoded.grid[1][2].componentId).toBe(63);
    expect(decoded.grid[2][4].componentId).toBe(54);
    expect(decoded.grid[3][4].componentId).toBe(58);
    expect(decoded.grid[3][4].initialHeat).toBe(1200);
    expect(decoded.grid[3][5].componentId).toBe(69);
    expect(decoded.grid[3][5].initialHeat).toBe(3600);
    expect(decoded.config.fluid).toBe(true);
    expect(decoded.config.pulsed).toBe(true);
    expect(decoded.config.currentHeat).toBe(1234);
  });

  it("decodes old hex reactor codes", () => {
    const code = `01${"00".repeat(53)}|fpi1|n2|f3|s4|r5`;
    const decoded = decodeReactorCode(code);

    expect(decoded.grid[0][0].componentId).toBe(1);
    expect(decoded.config.fluid).toBe(true);
    expect(decoded.config.pulsed).toBe(true);
    expect(decoded.config.usingReactorCoolantInjectors).toBe(true);
    expect(decoded.config.currentHeat).toBe(1);
    expect(decoded.config.onPulse).toBe(2);
    expect(decoded.config.offPulse).toBe(3);
    expect(decoded.config.suspendTemp).toBe(4);
    expect(decoded.config.resumeTemp).toBe(5);
  });

  it("rejects invalid base64 reactor codes", () => {
    expect(() => decodeReactorCode("erp=!!!!")).toThrow("Invalid Base64 reactor code");
  });

  it("keeps revision 4 decoding stable when later component IDs are added", () => {
    const design = createEmptyDesign();
    design.grid[0][0] = { componentId: 69, initialHeat: 123 };
    const code = encodeReactorCode(design);
    const futureComponent: ComponentDefinition = {
      id: 99,
      key: "futureCompatibilityProbe",
      name: "Future Compatibility Probe",
      kind: "coolantCell",
      maxDamage: 1,
      maxHeat: 1_000,
      sourceMod: "GTNH",
      image: "/assets/future.png",
    };

    try {
      COMPONENT_BY_ID.set(futureComponent.id, futureComponent);
      const decoded = decodeReactorCode(code);
      expect(decoded.grid[0][0].componentId).toBe(69);
      expect(decoded.grid[0][0].initialHeat).toBe(123);
    } finally {
      COMPONENT_BY_ID.delete(futureComponent.id);
    }
  });
});
