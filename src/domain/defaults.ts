import { REACTOR_COLS, REACTOR_ROWS, type ReactorDesign, type SimulationConfig } from "./types";

export const DEFAULT_CONFIG: SimulationConfig = {
  currentHeat: 0,
  fluid: false,
  pulsed: false,
  automated: false,
  usingReactorCoolantInjectors: false,
  onPulse: 5_000_000,
  offPulse: 0,
  suspendTemp: 120_000,
  resumeTemp: 120_000,
  maxSimulationTicks: 20_000,
  mcVersion: "1.12.2",
  gtMode: "GTNH",
};

export function createEmptyDesign(config: Partial<SimulationConfig> = {}): ReactorDesign {
  return {
    grid: Array.from({ length: REACTOR_ROWS }, () =>
      Array.from({ length: REACTOR_COLS }, () => ({ componentId: null })),
    ),
    config: { ...DEFAULT_CONFIG, ...config },
  };
}
