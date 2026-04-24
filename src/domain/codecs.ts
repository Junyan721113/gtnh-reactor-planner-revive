import { COMPONENT_BY_ID } from "./components";
import { createEmptyDesign, DEFAULT_CONFIG } from "./defaults";
import { REACTOR_COLS, REACTOR_ROWS, type ReactorDesign } from "./types";

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

class BigintStorage {
  private storedValue = 0n;

  store(value: number, max: number) {
    if (value < 0 || value > max) {
      throw new Error(`Value ${value} outside 0..${max}`);
    }
    this.storedValue = this.storedValue * BigInt(max + 1) + BigInt(Math.trunc(value));
  }

  extract(max: number) {
    const base = BigInt(max + 1);
    const value = this.storedValue % base;
    this.storedValue = this.storedValue / base;
    return Number(value);
  }

  static inputBase64(code: string) {
    const storage = new BigintStorage();
    const clean = code.replace(/\s+/g, "");
    let value = 0n;
    for (const char of clean.replace(/=+$/, "")) {
      const index = BASE64.indexOf(char);
      if (index < 0) throw new Error("Invalid Base64 reactor code");
      value = (value << 6n) + BigInt(index);
    }
    const paddingBits = (4 - (clean.replace(/=+$/, "").length % 4 || 4)) * 2;
    storage.storedValue = paddingBits > 0 ? value >> BigInt(paddingBits) : value;
    return storage;
  }

  outputBase64() {
    if (this.storedValue === 0n) return "AA==";
    const bytes: number[] = [];
    let value = this.storedValue;
    while (value > 0n) {
      bytes.unshift(Number(value & 0xffn));
      value >>= 8n;
    }
    if ((bytes[0] & 0x80) !== 0) bytes.unshift(0);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
}

export function encodeReactorCode(design: ReactorDesign) {
  const storage = new BigintStorage();
  const config = design.config;
  storage.store(config.maxSimulationTicks, 5_000_000);
  storage.store(config.usingReactorCoolantInjectors ? 1 : 0, 1);
  storage.store(config.fluid ? 1 : 0, 1);
  if (config.pulsed) {
    storage.store(config.resumeTemp, 120_000);
    storage.store(config.suspendTemp, 120_000);
    storage.store(config.offPulse, 5_000_000);
    storage.store(config.onPulse, 5_000_000);
  }
  storage.store(config.currentHeat, 120_000);
  for (let row = REACTOR_ROWS - 1; row >= 0; row--) {
    for (let col = REACTOR_COLS - 1; col >= 0; col--) {
      const cell = design.grid[row][col];
      if (cell.componentId != null && COMPONENT_BY_ID.has(cell.componentId)) {
        const definition = COMPONENT_BY_ID.get(cell.componentId)!;
        const defaultThreshold =
          definition.maxHeat > 1 ? Math.trunc(definition.maxHeat * 0.9) : definition.maxDamage > 1 ? Math.trunc(definition.maxDamage * 1.1) : 9_000;
        const defaultPause = 0;
        const hasCustom =
          (cell.initialHeat ?? 0) > 0 ||
          (cell.automationThreshold ?? defaultThreshold) !== defaultThreshold ||
          (cell.reactorPause ?? defaultPause) !== defaultPause;
        if (hasCustom) {
          if (config.automated) {
            storage.store(cell.reactorPause ?? defaultPause, 10_000);
            storage.store(cell.automationThreshold ?? defaultThreshold, 1_080_000);
          }
          storage.store(cell.initialHeat ?? 0, 1_080_000);
          storage.store(1, 1);
        } else {
          storage.store(0, 1);
        }
        storage.store(cell.componentId, 58);
      } else {
        storage.store(0, 58);
      }
    }
  }
  storage.store(config.automated ? 1 : 0, 1);
  storage.store(config.pulsed ? 1 : 0, 1);
  storage.store(3, 255);
  return `erp=${storage.outputBase64()}`;
}

export function decodeReactorCode(rawCode: string): ReactorDesign {
  const code = rawCode.trim().replace(/^erp=/, "");
  if (!code) return createEmptyDesign();
  if (/^[0-9A-Za-z(),|]+$/.test(code) && code.length >= 108 && !/[+/=]/.test(code)) {
    return decodeOldHexCode(code);
  }
  const storage = BigintStorage.inputBase64(code);
  const design = createEmptyDesign();
  const revision = storage.extract(255);
  const componentMax = revision === 4 ? 72 : revision === 3 ? 58 : revision === 2 ? 44 : 38;
  const maxComponentHeat = revision === 4 ? 1_000_000_000 : revision === 3 ? 1_080_000 : 360_000;
  if (revision > 4) throw new Error(`Unsupported reactor code revision ${revision}`);
  if (revision >= 1) {
    design.config.pulsed = storage.extract(1) > 0;
    design.config.automated = storage.extract(1) > 0;
  }
  for (let row = 0; row < REACTOR_ROWS; row++) {
    for (let col = 0; col < REACTOR_COLS; col++) {
      const componentId = storage.extract(componentMax);
      if (componentId > 0 && COMPONENT_BY_ID.has(componentId)) {
        const cell = { componentId };
        if (storage.extract(1) > 0) {
          Object.assign(cell, { initialHeat: storage.extract(maxComponentHeat) });
          if (revision === 0 || design.config.automated) {
            Object.assign(cell, {
              automationThreshold: storage.extract(maxComponentHeat),
              reactorPause: storage.extract(10_000),
            });
          }
        }
        design.grid[row][col] = cell;
      } else {
        design.grid[row][col] = { componentId: null };
      }
    }
  }
  design.config.currentHeat = storage.extract(120_000);
  if (revision === 0 || design.config.pulsed) {
    design.config.onPulse = storage.extract(5_000_000);
    design.config.offPulse = storage.extract(5_000_000);
    design.config.suspendTemp = storage.extract(120_000);
    design.config.resumeTemp = storage.extract(120_000);
  }
  design.config.fluid = storage.extract(1) > 0;
  design.config.usingReactorCoolantInjectors = storage.extract(1) > 0;
  if (revision === 0) {
    design.config.pulsed = storage.extract(1) > 0;
    design.config.automated = storage.extract(1) > 0;
  }
  design.config.maxSimulationTicks = storage.extract(5_000_000);
  return design;
}

function decodeOldHexCode(code: string): ReactorDesign {
  const design = createEmptyDesign();
  let pos = 0;
  for (let row = 0; row < REACTOR_ROWS; row++) {
    for (let col = 0; col < REACTOR_COLS; col++) {
      const componentId = Number.parseInt(code.substring(pos, pos + 2), 16);
      pos += 2;
      design.grid[row][col] = COMPONENT_BY_ID.has(componentId) ? { componentId } : { componentId: null };
      if (pos + 1 < code.length && code[pos] === "(") {
        const end = code.indexOf(")", pos);
        const params = code.slice(pos + 1, end).split(",");
        for (const param of params) {
          const type = param[0];
          const value = Number.parseInt(param.slice(1), 36);
          if (type === "h") design.grid[row][col].initialHeat = value;
          if (type === "a") design.grid[row][col].automationThreshold = value;
          if (type === "p") design.grid[row][col].reactorPause = value;
        }
        pos = end + 1;
      }
    }
  }
  const [, mode, ...pulseParams] = code.slice(pos).split("|");
  if (mode) {
    design.config.fluid = mode[0] === "f";
    design.config.automated = mode[1] === "a";
    design.config.pulsed = mode[1] === "p" || mode[1] === "a";
    design.config.usingReactorCoolantInjectors = mode[2] === "i";
    design.config.currentHeat = mode.length > 3 ? Number.parseInt(mode.slice(3), 36) : DEFAULT_CONFIG.currentHeat;
  }
  for (const param of pulseParams) {
    const value = Number.parseInt(param.slice(1), 36);
    if (param[0] === "n") design.config.onPulse = value;
    if (param[0] === "f") design.config.offPulse = value;
    if (param[0] === "s") design.config.suspendTemp = value;
    if (param[0] === "r") design.config.resumeTemp = value;
  }
  return design;
}
