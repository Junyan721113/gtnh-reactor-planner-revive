export const REACTOR_ROWS = 6;
export const REACTOR_COLS = 9;

export type ComponentKind =
  | "fuelRod"
  | "coolantCell"
  | "vent"
  | "exchanger"
  | "plating"
  | "condensator"
  | "reflector";

export type SourceMod = "IC2" | "GTNH" | "GoodGenerator";

export interface FuelRodSpec {
  energyMult: number;
  heatMult: number;
  rodCount: number;
  moxStyle: boolean;
}

export interface VentSpec {
  selfVent: number;
  hullDraw: number;
  sideVent: number;
}

export interface ExchangerSpec {
  switchSide: number;
  switchReactor: number;
}

export interface PlatingSpec {
  heatAdjustment: number;
  explosionPowerMultiplier: number;
}

export interface ComponentDefinition {
  id: number;
  key: string;
  name: string;
  kind: ComponentKind;
  maxDamage: number;
  maxHeat: number;
  sourceMod: SourceMod;
  image: string;
  fuel?: FuelRodSpec;
  vent?: VentSpec;
  exchanger?: ExchangerSpec;
  plating?: PlatingSpec;
}

export interface ReactorCellConfig {
  componentId: number | null;
  initialHeat?: number;
  automationThreshold?: number;
  reactorPause?: number;
}

export interface SimulationConfig {
  currentHeat: number;
  fluid: boolean;
  pulsed: boolean;
  automated: boolean;
  usingReactorCoolantInjectors: boolean;
  onPulse: number;
  offPulse: number;
  suspendTemp: number;
  resumeTemp: number;
  maxSimulationTicks: number;
  mcVersion: "1.7.10" | "1.12.2";
  gtMode: "none" | "GTNH";
}

export interface ReactorDesign {
  grid: ReactorCellConfig[][];
  config: SimulationConfig;
}

export interface ComponentSnapshot {
  row: number;
  col: number;
  id: number;
  key: string;
  name: string;
  currentHeat: number;
  maxHeat: number;
  currentDamage: number;
  maxDamage: number;
  currentEU: number;
  currentHU: number;
  currentHullHeating: number;
  currentComponentHeating: number;
  currentHullCooling: number;
  currentVentCooling: number;
  broken: boolean;
}

export interface ComponentHeatFlow {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  amount: number;
}

export interface HullHeatFlow {
  row: number;
  col: number;
  direction: "toHull" | "fromHull";
  amount: number;
}

export interface TickSnapshot {
  tick: number;
  active: boolean;
  reactorHeat: number;
  maxHeat: number;
  euOutput: number;
  euPerTick: number;
  huOutput: number;
  huPerTick: number;
  ventedHeat: number;
  components: ComponentSnapshot[];
  componentHeatFlows: ComponentHeatFlow[];
  hullHeatFlows: HullHeatFlow[];
  eventCount: number;
}

export interface SimulationEvent {
  tick: number;
  level: "info" | "warning" | "danger";
  message: string;
  row?: number;
  col?: number;
}

export interface SimulationSummary {
  ticks: number;
  exploded: boolean;
  totalEU: number;
  avgEUt: number;
  minEUt: number;
  maxEUt: number;
  totalHU: number;
  avgHUt: number;
  minHUt: number;
  maxHUt: number;
  minHeat: number;
  maxHeat: number;
  totalRodCount: number;
  firstComponentBroken?: SimulationEvent;
  firstRodDepleted?: SimulationEvent;
}

export interface SimulationResult {
  snapshots: TickSnapshot[];
  events: SimulationEvent[];
  summary: SimulationSummary;
}
