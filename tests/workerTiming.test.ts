import { describe, expect, it } from "vitest";
import { getXuJinIntervalMs, getXuJinStepsPerRefresh, normalizeXuJinSpeed } from "../src/worker/timing";

describe("worker timing", () => {
  it("normalizes XuJin speed into the supported range", () => {
    expect(normalizeXuJinSpeed(Number.NaN)).toBe(1);
    expect(normalizeXuJinSpeed(0)).toBe(1);
    expect(normalizeXuJinSpeed(2.9)).toBe(2);
    expect(normalizeXuJinSpeed(20_000)).toBe(10_000);
  });

  it("caps refresh rate at 10 Hz", () => {
    expect(getXuJinIntervalMs(1)).toBe(1_000);
    expect(getXuJinIntervalMs(10)).toBe(100);
    expect(getXuJinIntervalMs(10_000)).toBe(100);
  });

  it("converts speed into per-refresh batch size with carry", () => {
    expect(getXuJinStepsPerRefresh(1, 0)).toEqual({ steps: 1, carry: 0 });
    expect(getXuJinStepsPerRefresh(100, 0)).toEqual({ steps: 10, carry: 0 });
    expect(getXuJinStepsPerRefresh(15, 0)).toEqual({ steps: 1, carry: 0.5 });
    expect(getXuJinStepsPerRefresh(15, 0.5)).toEqual({ steps: 2, carry: 0 });
  });
});
