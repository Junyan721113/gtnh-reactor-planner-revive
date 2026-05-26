import {
  REACTOR_COLS,
  REACTOR_ROWS,
  type BreederProgressStat,
  type FuelRodDepletionStat,
  type ReactorDesign,
  type SimulationEvent,
  type SimulationResult,
  type SimulationSummary,
  type TickSnapshot,
} from "../domain/types";
import { ReactorRuntime, type RuntimeComponent } from "./runtime";

export interface StepwiseOptions {
  maxTicks?: number;
  sampleEvery?: number;
  maxSnapshots?: number;
}

export interface StepResult {
  snapshot: TickSnapshot;
  events: SimulationEvent[];
  completed: boolean;
  result?: SimulationResult;
}


interface FuelRodStatAccumulator {
  row: number;
  col: number;
  id: number;
  name: string;
  maxDamage: number;
  totalDamage: number;
  lastDamageDelta: number;
  activeTicks: number;
  totalEU: number;
  totalHeat: number;
  currentDamage: number;
  estimatedDepletionTick?: number;
  depleted: boolean;
}

interface BreederStatAccumulator {
  row: number;
  col: number;
  id: number;
  name: string;
  maxDamage: number;
  totalProgress: number;
  lastProgressDelta: number;
  activeTicks: number;
  currentDamage: number;
  estimatedCompletionTick?: number;
  complete: boolean;
}

export class StepwiseSimulator {
  readonly reactor: ReactorRuntime;
  readonly maxTicks: number;
  readonly sampleEvery: number;
  readonly maxSnapshots: number;
  readonly events: SimulationEvent[] = [];
  readonly snapshots: TickSnapshot[] = [];

  private active = true;
  private pauseTimer = 0;
  private allFuelRodsDepleted = false;
  private componentsIntact = true;
  private anyRodsDepleted = false;
  private minEUoutput = Number.MAX_VALUE;
  private maxEUoutput = 0;
  private minHeatOutput = Number.MAX_VALUE;
  private maxHeatOutput = 0;
  private totalEUoutput = 0;
  private totalHeatOutput = 0;
  private totalFuelDamage = 0;
  private totalFuelHeat = 0;
  private fuelRodStats = new Map<string, FuelRodStatAccumulator>();
  private breederStats = new Map<string, BreederStatAccumulator>();
  private lastEUoutput = 0;
  private lastHeatOutput = 0;
  private minReactorHeat: number;
  private maxReactorHeat: number;
  private totalRodCount = 0;
  private firstComponentBroken: SimulationEvent | undefined;
  private firstRodDepleted: SimulationEvent | undefined;
  private temperatureMarks = new Set<string>();
  private completedResult: SimulationResult | undefined;
  tick = 0;

  constructor(design: ReactorDesign, options: StepwiseOptions = {}) {
    this.reactor = new ReactorRuntime(design);
    this.maxTicks = Math.min(options.maxTicks ?? this.reactor.config.maxSimulationTicks, this.reactor.config.maxSimulationTicks);
    this.sampleEvery = Math.max(1, options.sampleEvery ?? 20);
    this.maxSnapshots = Math.max(1, options.maxSnapshots ?? 2_000);
    this.minReactorHeat = this.reactor.currentHeat;
    this.maxReactorHeat = this.reactor.currentHeat;
    for (const component of this.reactor.components()) {
      component.clearCurrentHeat();
      component.clearDamage();
      this.totalRodCount += component.getRodCount();
      if (component.getRodCount() > 0) this.initializeFuelRodStats(component);
      if (component.definition.kind === "breeder") this.initializeBreederStats(component);
    }
  }

  step(forceSnapshot = true): StepResult {
    if (this.completedResult) {
      return {
        snapshot: this.snapshots.at(-1) ?? this.buildSnapshot(),
        events: [],
        completed: true,
        result: this.completedResult,
      };
    }

    const eventStart = this.events.length;
    this.tick++;
    this.reactor.clearEUOutput();
    this.reactor.clearVentedHeat();
    this.reactor.clearHeatFlows();
    this.forEachComponent((component) => component.preReactorTick());
    for (const stat of this.fuelRodStats.values()) stat.lastDamageDelta = 0;
    if (this.active) this.allFuelRodsDepleted = true;

    this.forEachComponent((component) => {
      if (component.isBroken()) return;
      if (this.allFuelRodsDepleted && component.getRodCount() > 0) this.allFuelRodsDepleted = false;
      if (this.active) component.generateHeat();
      component.dissipate();
      component.transfer();
    });
    this.forEachComponent((component) => this.recordBreederStats(component));

    this.minReactorHeat = Math.min(this.minReactorHeat, this.reactor.currentHeat);
    this.maxReactorHeat = Math.max(this.maxReactorHeat, this.reactor.currentHeat);
    this.addTemperatureEvents();

    if (this.active) {
      this.forEachComponent((component) => {
        if (component.isBroken()) return;
        const damageBefore = component.currentDamage;
        component.generateEnergy();
        this.recordFuelRodStats(component, component.currentDamage - damageBefore);
      });
    }

    this.lastEUoutput = this.reactor.currentEUoutput;
    this.totalEUoutput += this.lastEUoutput;
    this.lastHeatOutput = this.reactor.ventedHeat;
    this.totalHeatOutput += this.lastHeatOutput;
    this.handlePulseAndOutputRanges();
    this.handleComponentEventsAndAutomation();

    const completed =
      this.reactor.currentHeat >= this.reactor.maxHeat ||
      ((this.allFuelRodsDepleted && this.lastEUoutput <= 0 && this.lastHeatOutput <= 0) || this.tick >= this.maxTicks);
    const shouldSnapshot = forceSnapshot || this.tick === 1 || this.tick % this.sampleEvery === 0 || completed;
    const snapshot = shouldSnapshot ? this.pushSnapshot() : this.buildSnapshot();

    if (completed) {
      this.completedResult = this.finalize();
    }

    return {
      snapshot,
      events: this.events.slice(eventStart),
      completed: !!this.completedResult,
      result: this.completedResult,
    };
  }

  run(onSnapshot?: (snapshot: TickSnapshot) => void): SimulationResult {
    while (!this.completedResult) {
      const step = this.step(false);
      if (step.snapshot.tick === 1 || step.snapshot.tick % this.sampleEvery === 0 || step.completed) {
        onSnapshot?.(step.snapshot);
      }
    }
    return this.completedResult;
  }


  /** Run a batch of ticks without building intermediate snapshots.
   *  Only the final tick snapshot is built; events are collected. */
  stepBatch(steps: number): StepResult {
    if (this.completedResult) {
      return {
        snapshot: this.snapshots.at(-1) ?? this.buildSnapshot(),
        events: [],
        completed: true,
        result: this.completedResult,
      };
    }
    const events: SimulationEvent[] = [];
    let lastResult: StepResult | null = null;
    for (let i = 0; i < steps && !this.completedResult; i++) {
      lastResult = this.step(false);
      if (lastResult.events.length > 0) events.push(...lastResult.events);
    }
    return lastResult ? { ...lastResult, events } : { snapshot: this.buildSnapshot(), events, completed: false };
  }
  private finalize(): SimulationResult {
    const summary: SimulationSummary = {
      ticks: this.tick,
      exploded: this.reactor.currentHeat >= this.reactor.maxHeat,
      totalEU: this.totalEUoutput,
      avgEUt: this.tick > 0 ? this.totalEUoutput / (this.tick * 20) : 0,
      minEUt: Number.isFinite(this.minEUoutput) ? this.minEUoutput / 20 : 0,
      maxEUt: this.maxEUoutput / 20,
      totalHU: 40 * this.totalHeatOutput,
      avgHUt: this.tick > 0 ? (2 * this.totalHeatOutput) / this.tick : 0,
      minHUt: Number.isFinite(this.minHeatOutput) ? 2 * this.minHeatOutput : 0,
      maxHUt: 2 * this.maxHeatOutput,
      minHeat: this.minReactorHeat,
      maxHeat: this.maxReactorHeat,
      totalRodCount: this.totalRodCount,
      totalFuelDamage: this.totalFuelDamage,
      euPerFuelDamage: this.totalFuelDamage > 0 ? this.totalEUoutput / this.totalFuelDamage : 0,
      huPerFuelDamage: this.totalFuelDamage > 0 ? (40 * this.totalHeatOutput) / this.totalFuelDamage : 0,
      heatPerFuelDamage: this.totalFuelDamage > 0 ? this.totalFuelHeat / this.totalFuelDamage : 0,
      fuelRodStats: this.buildFuelRodStats(),
      breederStats: this.buildBreederStats(),
      firstComponentBroken: this.firstComponentBroken,
      firstRodDepleted: this.firstRodDepleted,
    };
    this.pushEvent({
      tick: this.tick,
      level: summary.exploded ? "danger" : "info",
      message: summary.exploded ? `反应堆在 ${this.tick.toLocaleString()} 秒爆炸` : `徐进/模拟结束：${this.tick.toLocaleString()} 秒，未爆炸`,
    });
    const latest = this.buildSnapshot();
    if (this.snapshots.at(-1)?.tick !== latest.tick) this.pushSnapshot();
    return { snapshots: this.snapshots, events: this.events, summary };
  }

  private handlePulseAndOutputRanges() {
    if (this.reactor.currentHeat > this.reactor.maxHeat) return;
    const clockPeriod = this.reactor.config.onPulse + this.reactor.config.offPulse;
    if (this.reactor.config.pulsed || this.reactor.config.automated) {
      if (this.active) {
        if (this.reactor.config.pulsed && (this.reactor.currentHeat >= this.reactor.config.suspendTemp || this.tick % clockPeriod >= this.reactor.config.onPulse)) {
          this.active = false;
        }
      } else if (this.reactor.config.automated && this.pauseTimer > 0) {
        this.pauseTimer--;
      } else if (this.reactor.config.pulsed && this.reactor.currentHeat <= this.reactor.config.resumeTemp && this.tick % clockPeriod < this.reactor.config.onPulse) {
        this.active = true;
      }
    }
    this.minEUoutput = Math.min(this.lastEUoutput, this.minEUoutput);
    this.maxEUoutput = Math.max(this.lastEUoutput, this.maxEUoutput);
    this.minHeatOutput = Math.min(this.lastHeatOutput, this.minHeatOutput);
    this.maxHeatOutput = Math.max(this.lastHeatOutput, this.maxHeatOutput);
  }

  private handleComponentEventsAndAutomation() {
    this.forEachComponent((component) => {
      if (component.isBroken()) {
        if (component.getRodCount() === 0 && this.componentsIntact) {
          this.componentsIntact = false;
          this.firstComponentBroken = this.pushEvent({
            tick: this.tick,
            level: "danger",
            row: component.row,
            col: component.col,
            message: `${component.definition.name} 在 R${component.row + 1}C${component.col + 1} 首次损坏`,
          });
        } else if (component.getRodCount() > 0 && !this.anyRodsDepleted) {
          this.anyRodsDepleted = true;
          this.firstRodDepleted = this.pushEvent({
            tick: this.tick,
            level: "warning",
            row: component.row,
            col: component.col,
            message: `${component.definition.name} 在 R${component.row + 1}C${component.col + 1} 首次耗尽`,
          });
        }
      }

      if (this.reactor.config.automated) {
        if (component.getMaxHeat() > 1) {
          const replaceHot = component.automationThreshold > component.initialHeat && component.currentHeat >= component.automationThreshold;
          const replaceCold = component.automationThreshold < component.initialHeat && component.currentHeat <= component.automationThreshold;
          if (replaceHot || replaceCold) {
            component.clearCurrentHeat();
            this.pushEvent({
              tick: this.tick,
              level: "info",
              row: component.row,
              col: component.col,
              message: `${component.definition.name} 在 R${component.row + 1}C${component.col + 1} 被自动替换`,
            });
            if (component.reactorPause > 0) {
              this.active = false;
              this.pauseTimer = Math.max(this.pauseTimer, component.reactorPause);
            }
          }
        } else if (component.isBroken() || (component.getMaxDamage() > 1 && component.currentDamage >= component.automationThreshold)) {
          component.clearDamage();
          this.pushEvent({
            tick: this.tick,
            level: "info",
            row: component.row,
            col: component.col,
            message: `${component.definition.name} 在 R${component.row + 1}C${component.col + 1} 被自动替换`,
          });
          if (component.reactorPause > 0) {
            this.active = false;
            this.pauseTimer = Math.max(this.pauseTimer, component.reactorPause);
          }
        }
      }

      if (this.reactor.config.usingReactorCoolantInjectors && component.needsCoolantInjected()) {
        component.injectCoolant();
        this.pushEvent({
          tick: this.tick,
          level: "info",
          row: component.row,
          col: component.col,
          message: `${component.definition.name} 在 R${component.row + 1}C${component.col + 1} 注入冷却材料`,
        });
      }
    });
  }

  private addTemperatureEvents() {
    const thresholds = [
      [0.4, "Burn", "燃烧"],
      [0.5, "Evaporate", "蒸发"],
      [0.7, "Hurt", "伤害"],
      [0.85, "Lava", "熔岩"],
      [1, "Explode", "爆炸"],
    ] as const;
    for (const [ratio, key, label] of thresholds) {
      if (this.reactor.currentHeat >= ratio * this.reactor.maxHeat && !this.temperatureMarks.has(key)) {
        this.temperatureMarks.add(key);
        this.pushEvent({
          tick: this.tick,
          level: ratio >= 0.85 ? "danger" : ratio >= 0.7 ? "warning" : "info",
          message: `堆温达到 ${label} 阈值 ${(ratio * 100).toFixed(0)}% (${Math.round(this.reactor.currentHeat).toLocaleString()} / ${Math.round(this.reactor.maxHeat).toLocaleString()})`,
        });
      }
    }
  }

  private forEachComponent(callback: (component: RuntimeComponent) => void) {
    for (let row = 0; row < REACTOR_ROWS; row++) {
      for (let col = 0; col < REACTOR_COLS; col++) {
        const component = this.reactor.getComponentAt(row, col);
        if (component) callback(component);
      }
    }
  }


  private cellKey(component: RuntimeComponent) {
    return `${component.row}:${component.col}`;
  }

  private initializeFuelRodStats(component: RuntimeComponent) {
    this.fuelRodStats.set(this.cellKey(component), {
      row: component.row,
      col: component.col,
      id: component.definition.id,
      name: component.definition.name,
      maxDamage: component.getMaxDamage(),
      totalDamage: 0,
      lastDamageDelta: 0,
      activeTicks: 0,
      totalEU: 0,
      totalHeat: 0,
      currentDamage: component.currentDamage,
      depleted: component.isBroken(),
    });
  }

  private recordFuelRodStats(component: RuntimeComponent, damageDelta: number) {
    if (component.getRodCount() <= 0) return;
    const key = this.cellKey(component);
    const stat = this.fuelRodStats.get(key);
    if (!stat) {
      this.initializeFuelRodStats(component);
      this.recordFuelRodStats(component, damageDelta);
      return;
    }
    const consumed = Math.max(0, damageDelta);
    stat.lastDamageDelta = consumed;
    stat.currentDamage = component.currentDamage;
    stat.depleted = component.isBroken();
    if (consumed <= 0) return;
    stat.activeTicks++;
    stat.totalDamage += consumed;
    stat.totalEU += component.currentEUGenerated;
    stat.totalHeat += component.currentHeatGenerated;
    this.totalFuelDamage += consumed;
    this.totalFuelHeat += component.currentHeatGenerated;
    const remainingDamage = Math.max(0, stat.maxDamage - component.currentDamage);
    stat.estimatedDepletionTick = remainingDamage > 0 ? this.tick + Math.ceil(remainingDamage / consumed) : this.tick;
  }

  private buildFuelRodStats(): FuelRodDepletionStat[] {
    return Array.from(this.fuelRodStats.values()).map((stat) => ({
      row: stat.row,
      col: stat.col,
      id: stat.id,
      name: stat.name,
      maxDamage: stat.maxDamage,
      currentDamage: this.reactor.getComponentAt(stat.row, stat.col)?.currentDamage ?? stat.currentDamage,
      totalDamage: stat.totalDamage,
      lastDamageDelta: stat.lastDamageDelta,
      activeTicks: stat.activeTicks,
      totalEU: stat.totalEU,
      totalHeat: stat.totalHeat,
      euPerDamage: stat.totalDamage > 0 ? stat.totalEU / stat.totalDamage : 0,
      heatPerDamage: stat.totalDamage > 0 ? stat.totalHeat / stat.totalDamage : 0,
      estimatedDepletionTick: stat.estimatedDepletionTick,
      depleted: this.reactor.getComponentAt(stat.row, stat.col)?.isBroken() ?? stat.depleted,
    }));
  }

  private initializeBreederStats(component: RuntimeComponent) {
    this.breederStats.set(this.cellKey(component), {
      row: component.row,
      col: component.col,
      id: component.definition.id,
      name: component.definition.name,
      maxDamage: component.getMaxDamage(),
      totalProgress: 0,
      lastProgressDelta: 0,
      activeTicks: 0,
      currentDamage: component.currentDamage,
      complete: component.isBroken(),
    });
  }

  private recordBreederStats(component: RuntimeComponent) {
    if (component.definition.kind !== "breeder") return;
    const key = this.cellKey(component);
    const stat = this.breederStats.get(key);
    if (!stat) {
      this.initializeBreederStats(component);
      this.recordBreederStats(component);
      return;
    }
    const progress = Math.max(0, component.currentBreederProgress);
    stat.lastProgressDelta = progress;
    stat.currentDamage = component.currentDamage;
    stat.complete = component.isBroken();
    if (progress <= 0) return;
    stat.activeTicks++;
    stat.totalProgress += progress;
    const remaining = Math.max(0, stat.maxDamage - component.currentDamage);
    stat.estimatedCompletionTick = remaining > 0 ? this.tick + Math.ceil(remaining / progress) : this.tick;
  }

  private buildBreederStats(): BreederProgressStat[] {
    return Array.from(this.breederStats.values()).map((stat) => ({
      row: stat.row,
      col: stat.col,
      id: stat.id,
      name: stat.name,
      maxDamage: stat.maxDamage,
      currentDamage: this.reactor.getComponentAt(stat.row, stat.col)?.currentDamage ?? stat.currentDamage,
      totalProgress: stat.totalProgress,
      lastProgressDelta: stat.lastProgressDelta,
      activeTicks: stat.activeTicks,
      progressPerTick: stat.activeTicks > 0 ? stat.totalProgress / stat.activeTicks : 0,
      estimatedCompletionTick: stat.estimatedCompletionTick,
      complete: this.reactor.getComponentAt(stat.row, stat.col)?.isBroken() ?? stat.complete,
    }));
  }

  private buildSnapshot(): TickSnapshot {
    return {
      tick: this.tick,
      active: this.active,
      reactorHeat: this.reactor.currentHeat,
      maxHeat: this.reactor.maxHeat,
      euOutput: this.reactor.currentEUoutput,
      euPerTick: this.reactor.currentEUoutput / 20,
      huOutput: this.reactor.ventedHeat * 40,
      huPerTick: this.reactor.ventedHeat * 2,
      ventedHeat: this.reactor.ventedHeat,
      components: this.reactor.components().map((component) => component.snapshot()),
      componentHeatFlows: this.reactor.getComponentHeatFlows(),
      hullHeatFlows: this.reactor.getHullHeatFlows(),
      fuelRodStats: this.buildFuelRodStats(),
      breederStats: this.buildBreederStats(),
      eventCount: this.events.length,
    };
  }

  private pushSnapshot() {
    const snapshot = this.buildSnapshot();
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    }
    return snapshot;
  }

  private pushEvent(event: SimulationEvent) {
    this.events.push(event);
    return event;
  }
}
