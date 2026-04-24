import type { ReactorDesign, SimulationResult, TickSnapshot } from "../domain/types";
import { StepwiseSimulator } from "./stepper";

export interface SimulateOptions {
  maxTicks?: number;
  sampleEvery?: number;
  maxSnapshots?: number;
  onSnapshot?: (snapshot: TickSnapshot) => void;
}

export function simulate(design: ReactorDesign, options: SimulateOptions = {}): SimulationResult {
  const runner = new StepwiseSimulator(design, options);
  return runner.run(options.onSnapshot);
}
