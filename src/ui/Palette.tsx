import { useState } from "react";
import { COMPONENT_BY_ID } from "../domain/components";
import { setSelectedId, useSelectedId } from "../state/selectionStore";

interface PaletteGroup {
  title: string;
  shortTitle: string;
  ids: number[];
}

const PALETTE_GROUPS: PaletteGroup[] = [
  { title: "燃料棒", shortTitle: "燃料", ids: [1, 2, 3, 4, 5, 6, 26, 27, 28, 36, 37, 38, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 39, 40, 41, 42, 43, 44] },
  { title: "冷却单元", shortTitle: "冷却", ids: [14, 15, 16, 29, 30, 31, 32, 33, 34, 55, 56, 57, 58] },
  { title: "散热/换热", shortTitle: "换热", ids: [9, 10, 11, 12, 13, 17, 18, 19, 20] },
  { title: "反射/隔热/冷凝", shortTitle: "反射", ids: [7, 8, 35, 21, 22, 23, 24, 25] },
];

export function Palette() {
  const selectedId = useSelectedId();
  const [activeGroup, setActiveGroup] = useState(PALETTE_GROUPS[0].title);
  const group = PALETTE_GROUPS.find((item) => item.title === activeGroup) ?? PALETTE_GROUPS[0];

  return (
    <section className="palette-panel">
      <div className="panel-title">组件库</div>
      <button className={`palette-empty ${selectedId == null ? "selected" : ""}`} onClick={() => setSelectedId(null)}>
        空格 / 删除
      </button>
      <div className="palette-tabs" role="tablist" aria-label="组件分类">
        {PALETTE_GROUPS.map((item) => (
          <button
            key={item.title}
            className={item.title === activeGroup ? "active" : ""}
            onClick={() => setActiveGroup(item.title)}
            role="tab"
            aria-selected={item.title === activeGroup}
            title={item.title}
          >
            {item.shortTitle}
          </button>
        ))}
      </div>
      <div className="palette-group" role="tabpanel">
        <h3>{group.title}</h3>
        <div className="palette-grid">
          {group.ids.map((id) => {
            const component = COMPONENT_BY_ID.get(id)!;
            return (
              <button key={id} className={`palette-item ${selectedId === id ? "selected" : ""}`} onClick={() => setSelectedId(id)} title={component.name}>
                <img src={component.image} alt="" />
                <span>{component.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
