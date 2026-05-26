export function fmt(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

export function pct(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

export function kindLabel(kind: string) {
  switch (kind) {
    case "fuelRod":
      return "燃料棒";
    case "coolantCell":
      return "冷却单元";
    case "vent":
      return "散热片";
    case "exchanger":
      return "热交换器";
    case "plating":
      return "反应堆隔板";
    case "condensator":
      return "冷凝冷却单元";
    case "reflector":
      return "反射板";
    case "breeder":
      return "增殖棒";
    default:
      return kind;
  }
}
