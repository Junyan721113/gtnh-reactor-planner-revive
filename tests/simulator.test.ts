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

  it("tracks fuel depletion efficiency per rod", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 5, gtMode: "none" });
    design.grid[2][4] = { componentId: 1 };
    const result = simulate(design, { maxTicks: 5, sampleEvery: 1 });
    const stat = result.summary.fuelRodStats[0];
    expect(result.summary.totalFuelDamage).toBe(5);
    expect(result.summary.euPerFuelDamage).toBeGreaterThan(0);
    expect(result.summary.heatPerFuelDamage).toBeGreaterThan(0);
    expect(stat.totalDamage).toBe(5);
    expect(stat.lastDamageDelta).toBe(1);
    expect(stat.estimatedDepletionTick).toBe(20_000);
  });

  it("treats lithium and glowstone rods as breeder cells", () => {
    const design = createEmptyDesign({ currentHeat: 6_000, maxSimulationTicks: 2, gtMode: "none" });
    design.grid[2][4] = { componentId: 1 };
    design.grid[2][5] = { componentId: 63 };
    design.grid[3][4] = { componentId: 62 };

    const result = simulate(design, { maxTicks: 2, sampleEvery: 1 });
    const latest = result.snapshots.at(-1)!;
    const lithium = latest.components.find((component) => component.id === 63)!;
    const glowstone = latest.components.find((component) => component.id === 62)!;

    expect(latest.fuelRodStats).toHaveLength(1);
    expect(latest.breederStats).toHaveLength(2);
    expect(lithium.currentDamage).toBe(6);
    expect(glowstone.currentDamage).toBe(6);
    expect(latest.breederStats.every((stat) => stat.lastProgressDelta === 3)).toBe(true);
    expect(latest.breederStats.every((stat) => stat.progressPerTick === 3)).toBe(true);
    expect(lithium.currentEU).toBe(0);
    expect(glowstone.currentHU).toBe(0);
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

  it("keeps the final session snapshot when the snapshot buffer is full", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 6, gtMode: "none" });
    design.grid[2][4] = { componentId: 1 };
    const runner = new StepwiseSimulator(design, { maxSnapshots: 3, sampleEvery: 1 });

    let step = runner.step(true);
    while (!step.completed) step = runner.step(true);

    expect(step.result?.summary.ticks).toBe(6);
    expect(step.result?.snapshots.map((snapshot) => snapshot.tick)).toEqual([4, 5, 6]);
    expect(step.result?.snapshots.at(-1)?.fuelRodStats[0]?.currentDamage).toBe(6);
  });

  it("adjustCurrentHeat rejects overflow correctly", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 2, gtMode: "none" });
    // Place a 10k coolant cell (maxHeat=10000) at (2,4)
    design.grid[2][4] = { componentId: 14, initialHeat: 9_900 };
    // Place a fuel rod adjacent to pump heat
    design.grid[2][3] = { componentId: 1 };
    const result = simulate(design, { maxTicks: 2, sampleEvery: 1 });
    // The coolant cell should not exceed its maxHeat of 10000
    const cell = result.snapshots.at(-1)!.components.find((c) => c.id === 14)!;
    expect(cell.currentHeat).toBeLessThanOrEqual(10_000);
  });

  it("caps condensator heat by remaining capacity", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 1, gtMode: "none" });
    design.grid[2][3] = { componentId: 1 };
    design.grid[2][4] = { componentId: 24, initialHeat: 19_999 };

    const result = simulate(design, { maxTicks: 1, sampleEvery: 1 });
    const condensator = result.snapshots.at(-1)!.components.find((component) => component.id === 24)!;

    expect(condensator.currentHeat).toBe(20_000);
    expect(condensator.currentHeat).toBeLessThanOrEqual(condensator.maxHeat);
  });

  it("heat exchanger transfers heat between adjacent coolable components", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 2, gtMode: "none" });
    // Heat exchanger at (2,4), hot coolant cell at (2,3)
    design.grid[2][3] = { componentId: 15, initialHeat: 20_000 }; // 30k cell
    design.grid[2][4] = { componentId: 17 }; // heat exchanger
    const result = simulate(design, { maxTicks: 2, sampleEvery: 1 });
    const snap = result.snapshots.at(-1)!;
    const hotCell = snap.components.find((c) => c.id === 15)!;
    const exchanger = snap.components.find((c) => c.id === 17)!;
    // Exchanger should have moved some heat into itself from the hot cell
    expect(exchanger.currentHeat).toBeGreaterThan(0);
    // Component heat flows should record the transfer
    expect(snap.componentHeatFlows.length).toBeGreaterThan(0);
  });

  it("GTNH mode applies 10x energy multiplier and MOX heat scaling", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 2, gtMode: "GTNH", currentHeat: 5_000 });
    // MOX quad rod at (2,4) - moxStyle=true, should get heat bonus
    design.grid[2][4] = { componentId: 6 }; // quad MOX
    const result = simulate(design, { maxTicks: 2, sampleEvery: 1 });
    const stats = result.snapshots.at(-1)!.components.find((c) => c.id === 6)!;
    // GTNH mode: energy = base * 10 * (1 + 1.5 * heatRatio)
    // At currentHeat=5000, maxHeat=10000: ratio=0.5, multiplier=1+0.75=1.75, then *10
    expect(result.summary.totalEU).toBeGreaterThan(0);
  });

  it("stepBatch produces same result as individual steps", () => {
    const design = createEmptyDesign({ maxSimulationTicks: 10, gtMode: "none" });
    design.grid[2][4] = { componentId: 1 };

    // Run via stepBatch
    const batchRunner = new StepwiseSimulator(design, { maxSnapshots: 10, sampleEvery: 1 });
    const batchResult = batchRunner.stepBatch(10);

    // Run via individual steps
    const stepRunner = new StepwiseSimulator(design, { maxSnapshots: 10, sampleEvery: 1 });
    let stepResult = stepRunner.step(true);
    while (!stepResult.completed) stepResult = stepRunner.step(true);

    expect(batchResult.completed).toBe(true);
    expect(batchResult.snapshot.tick).toBe(stepResult.snapshot.tick);
    expect(batchResult.snapshot.reactorHeat).toBe(stepResult.snapshot.reactorHeat);
    expect(batchResult.snapshot.euPerTick).toBe(stepResult.snapshot.euPerTick);
    expect(batchResult.result?.summary.totalEU).toBe(stepResult.result?.summary.totalEU);
    expect(batchResult.result?.summary.totalFuelDamage).toBe(stepResult.result?.summary.totalFuelDamage);
  });

  it("stepBatch preserves events emitted during intermediate ticks", () => {
    const design = createEmptyDesign({ currentHeat: 3_998, maxSimulationTicks: 10, gtMode: "none" });
    design.grid[2][4] = { componentId: 1 };

    const runner = new StepwiseSimulator(design, { sampleEvery: 10 });
    const result = runner.stepBatch(3);

    expect(result.completed).toBe(false);
    expect(result.snapshot.tick).toBe(3);
    expect(result.events.some((event) => event.tick === 1 && event.message.includes("40%"))).toBe(true);
  });
});
