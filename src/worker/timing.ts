export const MAX_XUJIN_SPEED = 10_000;
export const MAX_REFRESH_HZ = 10;

export function normalizeXuJinSpeed(speed: number) {
  if (!Number.isFinite(speed)) return 1;
  return Math.max(1, Math.min(MAX_XUJIN_SPEED, Math.trunc(speed)));
}

export function getXuJinIntervalMs(speed: number) {
  const normalized = normalizeXuJinSpeed(speed);
  if (normalized <= MAX_REFRESH_HZ) return Math.round(1_000 / normalized);
  return Math.round(1_000 / MAX_REFRESH_HZ);
}

export function getXuJinStepsPerRefresh(speed: number, carry: number) {
  const normalized = normalizeXuJinSpeed(speed);
  if (normalized <= MAX_REFRESH_HZ) return { steps: 1, carry: 0 };
  const exact = normalized / MAX_REFRESH_HZ + carry;
  const steps = Math.max(1, Math.floor(exact));
  return { steps, carry: exact - steps };
}
