import { describe, expect, it } from "vitest";
import { createEmptyDesign } from "../src/domain/defaults";
import { simulate } from "../src/sim/simulator";
import { StepwiseSimulator } from "../src/sim/stepper";

describe("simulator", () => {
  it("generates EU and heat for a simple uranium rod", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 5, gtMode: "none" });
    design.grid[2][4] = { componentId: 1 };
    const result = simulate(design, { maxTicks: 5, sampleEvery: 1 });
    expect(result.summary.totalRodCount).toBe(1);
    expect(result.summary.totalEU).toBeGreaterThan(0);
    expect(result.summary.maxHeat).toBeGreaterThan(0);
  });

  it("vents hull heat with an overclocked heat vent", () => {
    const design = createEmptyDesign({ currentHeat: 500, maxSimulationTicks: 3 });
    design.grid[2][4] = { componentId: 13 };
    const result = simulate(design, { maxTicks: 3, sampleEvery: 1 });
    expect(result.snapshots[0].reactorHeat).toBeLessThan(500);
    expect(result.snapshots[0].ventedHeat).toBeGreaterThan(0);
  });

  it("keeps state between XuJin stepwise ticks", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 10, gtMode: "none" });
    design.grid[2][4] = { componentId: 1 };
    const runner = new StepwiseSimulator(design, { sampleEvery: 1 });
    const first = runner.step();
    const second = runner.step();
    expect(first.snapshot.tick).toBe(1);
    expect(second.snapshot.tick).toBe(2);
    expect(second.snapshot.reactorHeat).toBeGreaterThan(first.snapshot.reactorHeat);
    expect(second.snapshot.euOutput).toBeGreaterThan(0);
  });
});
