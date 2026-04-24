import { COMPONENT_BY_ID } from "../domain/components";
import { REACTOR_COLS, REACTOR_ROWS, type ComponentDefinition, type ComponentSnapshot, type ReactorDesign, type SimulationConfig } from "../domain/types";

const neighborOffsets = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;

export class ReactorRuntime {
  readonly grid: (RuntimeComponent | null)[][];
  readonly config: SimulationConfig;
  currentEUoutput = 0;
  currentHeat = 0;
  maxHeat = 10_000;
  ventedHeat = 0;

  constructor(design: ReactorDesign) {
    this.config = { ...design.config };
    this.currentHeat = this.config.currentHeat;
    this.grid = Array.from({ length: REACTOR_ROWS }, () => Array.from({ length: REACTOR_COLS }, () => null));
    for (let row = 0; row < REACTOR_ROWS; row++) {
      for (let col = 0; col < REACTOR_COLS; col++) {
        const cell = design.grid[row]?.[col];
        const definition = cell?.componentId ? COMPONENT_BY_ID.get(cell.componentId) : undefined;
        if (definition) {
          this.setComponentAt(
            row,
            col,
            new RuntimeComponent(definition, {
              initialHeat: cell.initialHeat,
              automationThreshold: cell.automationThreshold,
              reactorPause: cell.reactorPause,
            }),
          );
        }
      }
    }
  }

  getComponentAt(row: number, col: number) {
    if (row < 0 || row >= REACTOR_ROWS || col < 0 || col >= REACTOR_COLS) return null;
    return this.grid[row][col];
  }

  setComponentAt(row: number, col: number, component: RuntimeComponent | null) {
    const existing = this.grid[row][col];
    if (existing) existing.removeFromReactor();
    this.grid[row][col] = component;
    if (component) component.addToReactor(this, row, col);
  }

  clearEUOutput() {
    this.currentEUoutput = 0;
  }

  addEUOutput(value: number) {
    this.currentEUoutput += value;
  }

  clearVentedHeat() {
    this.ventedHeat = 0;
  }

  ventHeat(value: number) {
    this.ventedHeat += value;
  }

  adjustCurrentHeat(value: number) {
    this.currentHeat = Math.max(0, this.currentHeat + value);
  }

  adjustMaxHeat(value: number) {
    this.maxHeat += value;
  }

  components() {
    const result: RuntimeComponent[] = [];
    for (let row = 0; row < REACTOR_ROWS; row++) {
      for (let col = 0; col < REACTOR_COLS; col++) {
        const component = this.grid[row][col];
        if (component) result.push(component);
      }
    }
    return result;
  }
}

interface ComponentOverrides {
  initialHeat?: number;
  automationThreshold?: number;
  reactorPause?: number;
}

export class RuntimeComponent {
  readonly definition: ComponentDefinition;
  readonly initialHeat: number;
  readonly automationThreshold: number;
  readonly reactorPause: number;
  parent: ReactorRuntime | null = null;
  row = -1;
  col = -1;
  currentDamage = 0;
  currentHeat = 0;
  maxReachedHeat = 0;
  currentEUGenerated = 0;
  minEUGenerated = Number.MAX_VALUE;
  maxEUGenerated = 0;
  currentHeatGenerated = 0;
  minHeatGenerated = Number.MAX_VALUE;
  maxHeatGenerated = 0;
  currentHullHeating = 0;
  currentComponentHeating = 0;
  currentHullCooling = 0;
  currentVentCooling = 0;
  currentCellCooling = 0;
  bestCellCooling = 0;
  currentCondensatorCooling = 0;
  bestCondensatorCooling = 0;
  bestVentCooling = 0;

  constructor(definition: ComponentDefinition, overrides: ComponentOverrides = {}) {
    this.definition = definition;
    this.initialHeat = overrides.initialHeat ?? 0;
    this.automationThreshold =
      overrides.automationThreshold ??
      (definition.maxHeat > 1 ? Math.trunc(definition.maxHeat * 0.9) : definition.maxDamage > 1 ? Math.trunc(definition.maxDamage * 1.1) : 9_000);
    this.reactorPause = overrides.reactorPause ?? 0;
  }

  addToReactor(parent: ReactorRuntime, row: number, col: number) {
    this.removeFromReactor();
    this.parent = parent;
    this.row = row;
    this.col = col;
    if (this.definition.kind === "plating") {
      parent.adjustMaxHeat(this.definition.plating?.heatAdjustment ?? 0);
    }
  }

  removeFromReactor() {
    if (this.parent && this.definition.kind === "plating") {
      this.parent.adjustMaxHeat(-(this.definition.plating?.heatAdjustment ?? 0));
    }
    this.parent = null;
    this.row = -1;
    this.col = -1;
  }

  clearCurrentHeat() {
    this.currentHeat = this.initialHeat;
    this.maxReachedHeat = this.initialHeat;
    this.bestVentCooling = 0;
    this.bestCellCooling = 0;
    this.bestCondensatorCooling = 0;
    this.minEUGenerated = Number.MAX_VALUE;
    this.maxEUGenerated = 0;
    this.minHeatGenerated = Number.MAX_VALUE;
    this.maxHeatGenerated = 0;
  }

  clearDamage() {
    this.currentDamage = 0;
  }

  preReactorTick() {
    this.currentHullHeating = 0;
    this.currentComponentHeating = 0;
    this.currentHullCooling = 0;
    this.currentVentCooling = 0;
    this.currentCellCooling = 0;
    this.currentCondensatorCooling = 0;
    this.currentEUGenerated = 0;
    this.currentHeatGenerated = 0;
  }

  getMaxDamage() {
    if (this.definition.kind === "reflector" && this.definition.maxDamage > 1 && this.parent?.config.mcVersion === "1.7.10") {
      return this.definition.maxDamage / 3;
    }
    return this.definition.maxDamage;
  }

  getMaxHeat() {
    return this.definition.maxHeat;
  }

  isBroken() {
    return this.currentHeat >= this.getMaxHeat() || this.currentDamage >= this.getMaxDamage();
  }

  isHeatAcceptor() {
    return this.getMaxHeat() > 1 && !this.isBroken();
  }

  isCoolable() {
    return this.getMaxHeat() > 1 && this.definition.kind !== "condensator";
  }

  isNeutronReflector() {
    return (this.definition.kind === "reflector" || this.definition.kind === "fuelRod") && !this.isBroken();
  }

  getRodCount() {
    return this.definition.fuel?.rodCount ?? 0;
  }

  applyDamage(value: number) {
    if (this.getMaxDamage() > 1 && value > 0) this.currentDamage += value;
  }

  adjustCurrentHeat(value: number): number {
    if (this.definition.kind === "condensator") {
      if (value < 0) return value;
      this.currentCondensatorCooling += value;
      this.bestCondensatorCooling = Math.max(this.bestCondensatorCooling, this.currentCondensatorCooling);
      const accepted = Math.min(value, this.getMaxHeat() - value);
      this.currentHeat += accepted;
      this.maxReachedHeat = Math.max(this.maxReachedHeat, this.currentHeat);
      return value - accepted;
    }
    if (this.definition.kind === "coolantCell") {
      this.currentCellCooling += value;
      this.bestCellCooling = Math.max(this.currentCellCooling, this.bestCellCooling);
    }
    if (!this.isHeatAcceptor()) return value;
    let next = this.currentHeat + value;
    let rejected = 0;
    if (next > this.getMaxHeat()) {
      rejected = this.getMaxHeat() - next + 1;
      next = this.getMaxHeat();
    } else if (next < 0) {
      rejected = next;
      next = 0;
    }
    this.currentHeat = next;
    this.maxReachedHeat = Math.max(this.maxReachedHeat, this.currentHeat);
    return rejected;
  }

  generateHeat() {
    if (this.definition.kind === "fuelRod") return this.generateFuelRodHeat();
    if (this.definition.kind === "reflector") {
      for (const [dr, dc] of neighborOffsets) {
        const neighbor = this.parent?.getComponentAt(this.row + dr, this.col + dc);
        if (neighbor) this.applyDamage(neighbor.getRodCount());
      }
    }
    return 0;
  }

  generateEnergy() {
    const fuel = this.definition.fuel;
    if (!fuel || !this.parent) return 0;
    const pulses = this.countNeutronNeighbors() + (fuel.rodCount === 1 ? 1 : fuel.rodCount === 2 ? 2 : 3);
    let energy = fuel.energyMult * pulses;
    const gtMode = this.parent.config.gtMode;
    if (gtMode === "GT5.09" || this.definition.sourceMod === "GT5.09") {
      energy *= 2;
      if (fuel.moxStyle) energy *= 1 + (1.5 * this.parent.currentHeat) / this.parent.maxHeat;
    } else if (gtMode === "GTNH" || this.definition.sourceMod === "GTNH") {
      energy *= 10;
      if (fuel.moxStyle) energy *= 1 + (1.5 * this.parent.currentHeat) / this.parent.maxHeat;
    } else if (fuel.moxStyle) {
      energy *= 1 + (4 * this.parent.currentHeat) / this.parent.maxHeat;
    }
    this.currentEUGenerated = energy;
    this.minEUGenerated = Math.min(this.minEUGenerated, energy);
    this.maxEUGenerated = Math.max(this.maxEUGenerated, energy);
    this.parent.addEUOutput(energy);
    this.applyDamage(1);
    return energy;
  }

  dissipate() {
    if (this.definition.kind !== "vent" || !this.parent) return 0;
    const vent = this.definition.vent!;
    const hullDraw = Math.min(vent.hullDraw, this.parent.currentHeat);
    this.currentHullCooling = hullDraw;
    this.parent.adjustCurrentHeat(-hullDraw);
    this.adjustCurrentHeat(hullDraw);
    const selfDissipation = Math.min(vent.selfVent, this.currentHeat);
    this.currentVentCooling = selfDissipation;
    this.parent.ventHeat(selfDissipation);
    this.adjustCurrentHeat(-selfDissipation);
    if (vent.sideVent > 0) {
      for (const [dr, dc] of neighborOffsets) {
        const neighbor = this.parent.getComponentAt(this.row + dr, this.col + dc);
        if (neighbor?.isCoolable()) {
          const rejected = neighbor.adjustCurrentHeat(-vent.sideVent);
          const dissipated = vent.sideVent + rejected;
          this.parent.ventHeat(dissipated);
          this.currentVentCooling += dissipated;
        }
      }
    }
    this.bestVentCooling = Math.max(this.bestVentCooling, this.currentVentCooling);
    return selfDissipation;
  }

  transfer() {
    if (this.definition.kind !== "exchanger" || !this.parent) return;
    const exchanger = this.definition.exchanger!;
    let myHeat = 0;
    if (exchanger.switchSide > 0) {
      for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const neighbor = this.parent.getComponentAt(this.row + dr, this.col + dc);
        if (!neighbor?.isHeatAcceptor()) continue;
        let add = this.calculateExchange(neighbor.currentHeat, neighbor.getMaxHeat(), exchanger.switchSide, exchanger.switchSide);
        myHeat -= add;
        if (add > 0) this.currentComponentHeating += add;
        add = neighbor.adjustCurrentHeat(add);
        myHeat += add;
      }
    }
    if (exchanger.switchReactor > 0) {
      const add = this.calculateExchange(this.parent.currentHeat, this.parent.maxHeat, exchanger.switchReactor, exchanger.switchSide);
      myHeat -= add;
      this.parent.adjustCurrentHeat(add);
      if (add > 0) this.currentHullHeating = add;
      else this.currentHullCooling = -add;
    }
    this.adjustCurrentHeat(myHeat);
  }

  getVentCoolingCapacity() {
    if (this.definition.kind !== "vent" || !this.parent) return 0;
    const vent = this.definition.vent!;
    let result = vent.selfVent;
    if (vent.sideVent > 0) {
      for (const [dr, dc] of neighborOffsets) {
        if (this.parent.getComponentAt(this.row + dr, this.col + dc)?.isCoolable()) result += vent.sideVent;
      }
    }
    return result;
  }

  getHullCoolingCapacity() {
    if (this.definition.kind === "vent") return this.definition.vent?.hullDraw ?? 0;
    if (this.definition.kind === "exchanger") return this.definition.exchanger?.switchReactor ?? 0;
    return 0;
  }

  needsCoolantInjected() {
    return this.definition.kind === "condensator" && this.currentHeat > 0.85 * this.getMaxHeat();
  }

  injectCoolant() {
    if (this.definition.kind === "condensator") this.currentHeat = 0;
  }

  snapshot(): ComponentSnapshot {
    return {
      row: this.row,
      col: this.col,
      id: this.definition.id,
      key: this.definition.key,
      name: this.definition.name,
      currentHeat: this.currentHeat,
      maxHeat: this.getMaxHeat(),
      currentDamage: this.currentDamage,
      maxDamage: this.getMaxDamage(),
      currentEU: this.currentEUGenerated,
      currentHU: this.currentHeatGenerated,
      currentHullHeating: this.currentHullHeating,
      currentComponentHeating: this.currentComponentHeating,
      currentHullCooling: this.currentHullCooling,
      currentVentCooling: this.currentVentCooling,
      broken: this.isBroken(),
    };
  }

  private countNeutronNeighbors() {
    let result = 0;
    for (const [dr, dc] of neighborOffsets) {
      if (this.parent?.getComponentAt(this.row + dr, this.col + dc)?.isNeutronReflector()) result++;
    }
    return result;
  }

  private generateFuelRodHeat() {
    const fuel = this.definition.fuel!;
    const pulses = this.countNeutronNeighbors() + (fuel.rodCount === 1 ? 1 : fuel.rodCount === 2 ? 2 : 3);
    let heat = Math.trunc(fuel.heatMult * pulses * (pulses + 1));
    if (fuel.moxStyle && this.parent?.config.fluid && this.parent.currentHeat / this.parent.maxHeat > 0.5) heat *= 2;
    this.currentHeatGenerated = heat;
    this.minHeatGenerated = Math.min(this.minHeatGenerated, heat);
    this.maxHeatGenerated = Math.max(this.maxHeatGenerated, heat);
    this.handleFuelHeat(heat);
    return heat;
  }

  private handleFuelHeat(heat: number) {
    if (!this.parent) return;
    const neighbors = neighborOffsets
      .map(([dr, dc]) => this.parent!.getComponentAt(this.row + dr, this.col + dc))
      .filter((component): component is RuntimeComponent => !!component?.isHeatAcceptor());
    if (neighbors.length === 0) {
      this.parent.adjustCurrentHeat(heat);
      this.currentHullHeating = heat;
      return;
    }
    this.currentComponentHeating = heat;
    const share = Math.trunc(heat / neighbors.length);
    for (const neighbor of neighbors) neighbor.adjustCurrentHeat(share);
    const remainder = heat % neighbors.length;
    neighbors[0].adjustCurrentHeat(remainder);
  }

  private calculateExchange(otherHeat: number, otherMaxHeat: number, cap: number, lowHeatReference: number) {
    const myPercent = (this.currentHeat * 100) / this.getMaxHeat();
    const otherPercent = (otherHeat * 100) / otherMaxHeat;
    let add = Math.trunc((otherMaxHeat / 100) * (otherPercent + myPercent / 2));
    if (add > cap) add = cap;
    if (otherPercent + myPercent / 2 < 1.0) add = lowHeatReference / 2;
    if (otherPercent + myPercent / 2 < 0.75) add = lowHeatReference / 4;
    if (otherPercent + myPercent / 2 < 0.5) add = lowHeatReference / 8;
    if (otherPercent + myPercent / 2 < 0.25) add = 1;
    const roundedOther = Math.round(otherPercent * 10) / 10;
    const roundedMine = Math.round(myPercent * 10) / 10;
    if (roundedOther > roundedMine) add = -add;
    else if (roundedOther === roundedMine) add = 0;
    return add;
  }
}
