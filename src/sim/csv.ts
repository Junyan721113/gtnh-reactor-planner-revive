import type { SimulationResult } from "../domain/types";

export function simulationToCsv(result: SimulationResult) {
  const rows = [
    ["tick", "active", "reactorHeat", "maxHeat", "euOutput", "euPerTick", "huOutput", "huPerTick", "ventedHeat"],
    ...result.snapshots.map((snapshot) => [
      snapshot.tick,
      snapshot.active ? 1 : 0,
      snapshot.reactorHeat,
      snapshot.maxHeat,
      snapshot.euOutput,
      snapshot.euPerTick,
      snapshot.huOutput,
      snapshot.huPerTick,
      snapshot.ventedHeat,
    ]),
  ];
  return rows.map((row) => row.map((value) => JSON.stringify(value)).join(",")).join("\n");
}
