import type { CSSProperties } from "react";
import { COMPONENT_BY_ID } from "../domain/components";
import { REACTOR_COLS, REACTOR_ROWS, type ReactorDesign, type TickSnapshot } from "../domain/types";
import { useSelectedId } from "../state/selectionStore";
import { pct } from "../utils/format";

interface Props {
  design: ReactorDesign;
  latest: TickSnapshot | null;
  onCellClick: (row: number, col: number) => void;
}

function SelectedPlacementLabel() {
  const selectedId = useSelectedId();
  const selected = selectedId ? COMPONENT_BY_ID.get(selectedId) : null;
  return <span>{selected ? `当前放置：${selected.name}` : "当前放置：空格"}</span>;
}

export function ReactorGrid({ design, latest, onCellClick }: Props) {
  const componentState = new Map(latest?.components.map((component) => [`${component.row}:${component.col}`, component]) ?? []);

  return (
    <section className="reactor-card">
      <div className="reactor-header">
        <div>
          <p className="eyebrow">6 x 9 Reactor Grid</p>
          <h2>堆芯热图</h2>
        </div>
        <SelectedPlacementLabel />
      </div>
      <div className="reactor-grid">
        {Array.from({ length: REACTOR_ROWS }).map((_, row) =>
          Array.from({ length: REACTOR_COLS }).map((__, col) => {
            const cell = design.grid[row][col];
            const definition = cell.componentId ? COMPONENT_BY_ID.get(cell.componentId) : undefined;
            const state = componentState.get(`${row}:${col}`);
            const heatRatio = state ? pct(state.currentHeat, state.maxHeat) : 0;
            const damageRatio = state ? pct(state.currentDamage, state.maxDamage) : 0;
            return (
              <button
                key={`${row}:${col}`}
                className={`reactor-cell ${state?.broken ? "broken" : ""}`}
                style={{ "--heat": heatRatio, "--damage": damageRatio } as CSSProperties}
                onClick={() => onCellClick(row, col)}
                title={definition ? `${definition.name} R${row + 1}C${col + 1}` : `Empty R${row + 1}C${col + 1}`}
              >
                {definition && <img src={definition.image} alt="" />}
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
