import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { COMPONENT_BY_ID } from "../domain/components";
import { REACTOR_COLS, REACTOR_ROWS, type ComponentSnapshot, type ReactorDesign, type TickSnapshot } from "../domain/types";
import { useSelectedId } from "../state/selectionStore";
import { pct } from "../utils/format";

interface HoverInfoMessage {
  title: string;
  detail: string;
}

interface Props {
  design: ReactorDesign;
  latest: TickSnapshot | null;
  onCellClick: (row: number, col: number) => void;
  onHoverInfoChange?: (message: HoverInfoMessage | null) => void;
}

type Direction = "up" | "right" | "down" | "left";

interface FlowMarker {
  key: string;
  placement: Direction;
  direction: Direction;
  amount: number;
  fillColor: string;
  glowColor: string;
}

interface HullFlowMarker {
  toHull: number;
  fromHull: number;
}

interface HoveredCell {
  row: number;
  col: number;
}

interface NetEdgeFlow {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  amount: number;
}

interface EdgeAccumulator {
  aRow: number;
  aCol: number;
  bRow: number;
  bCol: number;
  netFromAToB: number;
}

interface WarmColor {
  fillColor: string;
  glowColor: string;
}

type CssVars = CSSProperties & Record<`--${string}`, string | number>;

function cssVars(vars: Record<`--${string}`, string | number>): CssVars {
  return vars;
}

function directionBetween(fromRow: number, fromCol: number, toRow: number, toCol: number): Direction | null {
  if (toRow === fromRow - 1 && toCol === fromCol) return "up";
  if (toRow === fromRow + 1 && toCol === fromCol) return "down";
  if (toRow === fromRow && toCol === fromCol - 1) return "left";
  if (toRow === fromRow && toCol === fromCol + 1) return "right";
  return null;
}

function buildEdgeKey(rowA: number, colA: number, rowB: number, colB: number) {
  const keyA = `${rowA}:${colA}`;
  const keyB = `${rowB}:${colB}`;
  if (keyA <= keyB) return { key: `${keyA}|${keyB}`, fromIsA: true };
  return { key: `${keyB}|${keyA}`, fromIsA: false };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

const GTNH_HEAT_TIER_STOPS = [
  { amount: 1, t: 0.08 },
  { amount: 2, t: 0.18 },
  { amount: 4, t: 0.3 },
  { amount: 24, t: 0.48 },
  { amount: 64, t: 0.64 },
  { amount: 384, t: 0.78 },
  { amount: 1_536, t: 0.9 },
  { amount: 4_896, t: 1 },
];

const WARM_COLOR_STOPS = [
  { t: 0, hue: 54, saturation: 96, lightness: 70 },
  { t: 0.2, hue: 47, saturation: 98, lightness: 68 },
  { t: 0.42, hue: 36, saturation: 98, lightness: 65 },
  { t: 0.64, hue: 25, saturation: 98, lightness: 61 },
  { t: 0.82, hue: 14, saturation: 98, lightness: 58 },
  { t: 1, hue: 5, saturation: 96, lightness: 55 },
];

function interpolateStops<T extends { t: number }>(stops: T[], t: number, pick: (stop: T) => number) {
  const value = clamp01(t);
  for (let index = 1; index < stops.length; index++) {
    const previous = stops[index - 1];
    const next = stops[index];
    if (value <= next.t) {
      const local = (value - previous.t) / (next.t - previous.t || 1);
      return pick(previous) + (pick(next) - pick(previous)) * smoothstep(local);
    }
  }
  return pick(stops[stops.length - 1]);
}

function mapAmountToGtnhHeatTier(amount: number) {
  const heat = Math.max(0, amount);
  if (heat <= 0) return 0;
  if (heat <= GTNH_HEAT_TIER_STOPS[0].amount) return GTNH_HEAT_TIER_STOPS[0].t;
  const logHeat = Math.log2(heat);
  for (let index = 1; index < GTNH_HEAT_TIER_STOPS.length; index++) {
    const previous = GTNH_HEAT_TIER_STOPS[index - 1];
    const next = GTNH_HEAT_TIER_STOPS[index];
    if (heat <= next.amount) {
      const local = (logHeat - Math.log2(previous.amount)) / (Math.log2(next.amount) - Math.log2(previous.amount));
      return previous.t + (next.t - previous.t) * smoothstep(local);
    }
  }
  return 1;
}

function mapFlowToWarmSpectrum(amount: number, tickFlux: number): WarmColor {
  const relative = tickFlux > 0 ? clamp01(amount / tickFlux) : 0;
  const relativeScore = smoothstep(Math.log1p(relative * 24) / Math.log1p(24));
  const heatTierScore = mapAmountToGtnhHeatTier(amount);
  const t = clamp01(heatTierScore * 0.74 + relativeScore * 0.26);
  const hue = interpolateStops(WARM_COLOR_STOPS, t, (stop) => stop.hue);
  const saturation = interpolateStops(WARM_COLOR_STOPS, t, (stop) => stop.saturation);
  const lightness = interpolateStops(WARM_COLOR_STOPS, t, (stop) => stop.lightness);
  const glowHue = Math.max(0, hue - 5);
  const glowLightness = Math.max(40, lightness - 12);
  return {
    fillColor: `hsla(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}% / 0.96)`,
    glowColor: `hsla(${glowHue.toFixed(1)} 100% ${glowLightness.toFixed(1)}% / 0.56)`,
  };
}

function normalizeHullFlow(amount: number) {
  return Math.max(0.18, Math.min(1, Math.sqrt(Math.max(0, amount)) / 10));
}

function pushMarker(store: Map<string, FlowMarker[]>, key: string, marker: FlowMarker) {
  const existing = store.get(key);
  if (existing) {
    existing.push(marker);
    return;
  }
  store.set(key, [marker]);
}

function fmtNumber(value: number, digits = 0) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function kindLabel(kind: string) {
  switch (kind) {
    case "fuelRod":
      return "燃料棒";
    case "coolantCell":
      return "冷却单元";
    case "vent":
      return "散热器";
    case "exchanger":
      return "换热器";
    case "plating":
      return "装甲板";
    case "condensator":
      return "冷凝器";
    case "reflector":
      return "反射板";
    default:
      return kind;
  }
}

function buildRunningDetail(state: ComponentSnapshot) {
  return [
    `热量 ${fmtNumber(state.currentHeat)} / ${fmtNumber(state.maxHeat)}`,
    `损伤 ${fmtNumber(state.currentDamage)} / ${fmtNumber(state.maxDamage)}`,
    `EU ${fmtNumber(state.currentEU, 2)}，HU ${fmtNumber(state.currentHU, 2)}`,
    `堆交换 +${fmtNumber(state.currentHullHeating)} / -${fmtNumber(state.currentHullCooling)}，散热 ${fmtNumber(state.currentVentCooling)}`,
  ].join("；");
}

function toNetEdgeFlows(snapshot: TickSnapshot): NetEdgeFlow[] {
  const edgeMap = new Map<string, EdgeAccumulator>();
  for (const flow of snapshot.componentHeatFlows) {
    if (flow.amount <= 0) continue;
    if (!directionBetween(flow.fromRow, flow.fromCol, flow.toRow, flow.toCol)) continue;
    const { key, fromIsA } = buildEdgeKey(flow.fromRow, flow.fromCol, flow.toRow, flow.toCol);
    const edge = edgeMap.get(key);
    if (edge) {
      edge.netFromAToB += fromIsA ? flow.amount : -flow.amount;
      continue;
    }
    if (fromIsA) {
      edgeMap.set(key, {
        aRow: flow.fromRow,
        aCol: flow.fromCol,
        bRow: flow.toRow,
        bCol: flow.toCol,
        netFromAToB: flow.amount,
      });
    } else {
      edgeMap.set(key, {
        aRow: flow.toRow,
        aCol: flow.toCol,
        bRow: flow.fromRow,
        bCol: flow.fromCol,
        netFromAToB: -flow.amount,
      });
    }
  }

  const result: NetEdgeFlow[] = [];
  for (const edge of edgeMap.values()) {
    if (edge.netFromAToB === 0) continue;
    if (edge.netFromAToB > 0) {
      result.push({
        fromRow: edge.aRow,
        fromCol: edge.aCol,
        toRow: edge.bRow,
        toCol: edge.bCol,
        amount: edge.netFromAToB,
      });
    } else {
      result.push({
        fromRow: edge.bRow,
        fromCol: edge.bCol,
        toRow: edge.aRow,
        toCol: edge.aCol,
        amount: -edge.netFromAToB,
      });
    }
  }
  return result;
}

function SelectedPlacementLabel() {
  const selectedId = useSelectedId();
  const selected = selectedId ? COMPONENT_BY_ID.get(selectedId) : null;
  return <span>{selected ? `当前放置：${selected.name}` : "当前放置：空格"}</span>;
}

export function ReactorGrid({ design, latest, onCellClick, onHoverInfoChange }: Props) {
  const animationTick = latest?.tick ?? 0;
  const selectedId = useSelectedId();
  const selected = selectedId ? COMPONENT_BY_ID.get(selectedId) : null;
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);

  const componentState = useMemo(() => {
    return new Map(latest?.components.map((component) => [`${component.row}:${component.col}`, component]) ?? []);
  }, [latest]);

  const { mergedHeatMarkers, hullMarkers } = useMemo(() => {
    const heat = new Map<string, FlowMarker[]>();
    const hull = new Map<string, HullFlowMarker>();
    if (!latest) return { mergedHeatMarkers: heat, hullMarkers: hull };

    const edgeFlows = toNetEdgeFlows(latest);
    const tickFlux = edgeFlows.reduce((sum, edge) => sum + edge.amount, 0);

    for (let index = 0; index < edgeFlows.length; index++) {
      const edge = edgeFlows[index];
      const direction = directionBetween(edge.fromRow, edge.fromCol, edge.toRow, edge.toCol);
      if (!direction) continue;
      const fromKey = `${edge.fromRow}:${edge.fromCol}`;
      const warm = mapFlowToWarmSpectrum(edge.amount, tickFlux);
      pushMarker(heat, fromKey, {
        key: `edge-${index}`,
        placement: direction,
        direction,
        amount: edge.amount,
        fillColor: warm.fillColor,
        glowColor: warm.glowColor,
      });
    }

    for (const flow of latest.hullHeatFlows) {
      if (flow.amount <= 0) continue;
      const key = `${flow.row}:${flow.col}`;
      const slot = hull.get(key) ?? { toHull: 0, fromHull: 0 };
      if (flow.direction === "toHull") slot.toHull += flow.amount;
      else slot.fromHull += flow.amount;
      hull.set(key, slot);
    }

    return { mergedHeatMarkers: heat, hullMarkers: hull };
  }, [latest]);

  const buildCellInfo = (row: number, col: number): HoverInfoMessage => {
    const coord = `R${row + 1}C${col + 1}`;
    const cell = design.grid[row][col];
    const state = componentState.get(`${row}:${col}`);
    if (cell.componentId == null) {
      return {
        title: `空格槽位 · ${coord}`,
        detail: `点击可放置当前选择元件：${selected?.name ?? "空格 / 删除"}。`,
      };
    }

    const definition = COMPONENT_BY_ID.get(cell.componentId);
    if (!definition) {
      return {
        title: `未知元件 · ${coord}`,
        detail: "该槽位元件定义不存在，请检查数据源。",
      };
    }

    if (state) {
      return {
        title: `${definition.name} · ${coord}`,
        detail: buildRunningDetail(state),
      };
    }

    return {
      title: `${definition.name} · ${coord}`,
      detail: `类型：${kindLabel(definition.kind)}；来源：${definition.sourceMod}；最大热量 ${fmtNumber(definition.maxHeat)}；最大损伤 ${fmtNumber(definition.maxDamage)}。`,
    };
  };

  useEffect(() => {
    if (!hoveredCell || !onHoverInfoChange) return;
    onHoverInfoChange(buildCellInfo(hoveredCell.row, hoveredCell.col));
  }, [hoveredCell, latest, selectedId, design, onHoverInfoChange]);

  return (
    <section
      className="reactor-card"
      onMouseLeave={() => {
        setHoveredCell(null);
        onHoverInfoChange?.(null);
      }}
    >
      <div className="reactor-header">
        <div>
          <p className="eyebrow">6 x 9 Reactor Grid</p>
          <h2>堆芯热图</h2>
        </div>
        <div className="reactor-header-meta">
          <SelectedPlacementLabel />
          <p className="reactor-flow-legend">
            <span>
              <i className="legend-triangle" /> 元件热流（净值）
            </span>
            <span>
              <i className="legend-dot" /> 堆温释放 / 吸收
            </span>
          </p>
        </div>
      </div>
      <div className="reactor-grid">
        {Array.from({ length: REACTOR_ROWS }).map((_, row) =>
          Array.from({ length: REACTOR_COLS }).map((__, col) => {
            const cell = design.grid[row][col];
            const definition = cell.componentId ? COMPONENT_BY_ID.get(cell.componentId) : undefined;
            const key = `${row}:${col}`;
            const state = componentState.get(key);
            const heatRatio = state ? pct(state.currentHeat, state.maxHeat) : 0;
            const damageRatio = state ? pct(state.currentDamage, state.maxDamage) : 0;
            const mergedHeat = mergedHeatMarkers.get(key) ?? [];
            const hull = hullMarkers.get(key);
            const hullToIntensity = hull ? normalizeHullFlow(hull.toHull) : 0;
            const hullFromIntensity = hull ? normalizeHullFlow(hull.fromHull) : 0;

            return (
              <button
                key={key}
                className={`reactor-cell ${state?.broken ? "broken" : ""}`}
                style={cssVars({ "--heat": heatRatio, "--damage": damageRatio })}
                onClick={() => onCellClick(row, col)}
                onMouseEnter={() => {
                  setHoveredCell({ row, col });
                  onHoverInfoChange?.(buildCellInfo(row, col));
                }}
                title={definition ? `${definition.name} R${row + 1}C${col + 1}` : `Empty R${row + 1}C${col + 1}`}
              >
                <span className="cell-heat-clip" aria-hidden="true">
                  <span className="cell-heat-fill" />
                </span>
                {definition && <img src={definition.image} alt="" />}
                {mergedHeat.map((marker) => (
                  <span
                    key={`${animationTick}-${marker.key}`}
                    className={`flow-triangle place-${marker.placement} dir-${marker.direction}`}
                    style={cssVars({ "--flow-color": marker.fillColor, "--flow-glow": marker.glowColor })}
                    title={`Heat flow: ${Math.round(marker.amount).toLocaleString()}`}
                  />
                ))}
                {hull && hull.toHull > 0 ? (
                  <span
                    key={`to-hull-${animationTick}`}
                    className="hull-dot hull-release"
                    style={cssVars({ "--dot-intensity": hullToIntensity })}
                    title={`Release to hull: ${Math.round(hull.toHull).toLocaleString()}`}
                  />
                ) : null}
                {hull && hull.fromHull > 0 ? (
                  <span
                    key={`from-hull-${animationTick}`}
                    className="hull-dot hull-absorb"
                    style={cssVars({ "--dot-intensity": hullFromIntensity })}
                    title={`Absorb from hull: ${Math.round(hull.fromHull).toLocaleString()}`}
                  />
                ) : null}
                <span className="cell-coord">R{row + 1}C{col + 1}</span>
                {state && <span className="cell-value">{Math.round(Math.max(state.currentHeat, state.currentDamage)).toLocaleString()}</span>}
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}
