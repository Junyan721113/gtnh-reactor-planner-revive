import { useState } from "react";
import { COMPONENT_BY_ID, PALETTE_GROUPS as COMPONENT_PALETTE_GROUPS } from "../domain/components";
import type { ComponentDefinition } from "../domain/types";
import { setSelectedId, useSelectedId } from "../state/selectionStore";

interface InfoBarMessage {
  title: string;
  detail: string;
}

interface PaletteGroup {
  title: string;
  shortTitle: string;
  description: string;
  ids: number[];
}

interface Props {
  onHoverInfoChange?: (message: InfoBarMessage | null) => void;
}

const GROUP_META: Record<string, Omit<PaletteGroup, "title" | "ids">> = {
  燃料棒: {
    shortTitle: "燃料",
    description: "GTNH 中实际存在的 IC2、GregTech 与 GoodGenerator 反应堆燃料；关注耐久、基础 EU/HU 与 MOX 行为。",
  },
  冷却单元: {
    shortTitle: "冷却",
    description: "按 GTNH wiki 的冷却单元容量列出；流体种类在反应堆内只影响贴图与合成，不改变模拟容量。",
  },
  "散热/换热": {
    shortTitle: "换热",
    description: "在元件与堆温之间转移或释放热量，是控温核心组件。",
  },
  "反射/隔热/冷凝": {
    shortTitle: "反射",
    description: "提供中子反射、抗爆或冷凝吸热等辅助能力。",
  },
};

const PALETTE_GROUPS: PaletteGroup[] = COMPONENT_PALETTE_GROUPS.map((group) => ({
  ...group,
  ...GROUP_META[group.title],
}));

function kindLabel(kind: ComponentDefinition["kind"]) {
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

function describeComponent(component: ComponentDefinition) {
  const base = [`类型 ${kindLabel(component.kind)}`, `来源 ${component.sourceMod}`];
  if (component.kind === "fuelRod" && component.fuel) {
    base.push(
      `耐久 ${component.maxDamage.toLocaleString()}`,
      `能量倍率 ${component.fuel.energyMult}`,
      `热量倍率 ${component.fuel.heatMult}`,
      `棒数 ${component.fuel.rodCount}`,
      `MOX ${component.fuel.moxStyle ? "是" : "否"}`,
    );
    return base.join("；");
  }
  if (component.kind === "coolantCell") {
    base.push(`热容 ${component.maxHeat.toLocaleString()}`);
    return base.join("；");
  }
  if (component.kind === "vent" && component.vent) {
    base.push(
      `自身散热 ${component.vent.selfVent}`,
      `堆温吸热 ${component.vent.hullDraw}`,
      `邻居散热 ${component.vent.sideVent}`,
      `最大热量 ${component.maxHeat.toLocaleString()}`,
    );
    return base.join("；");
  }
  if (component.kind === "exchanger" && component.exchanger) {
    base.push(`元件换热 ${component.exchanger.switchSide}`, `堆温换热 ${component.exchanger.switchReactor}`, `最大热量 ${component.maxHeat.toLocaleString()}`);
    return base.join("；");
  }
  if (component.kind === "plating" && component.plating) {
    base.push(
      `堆体热容 +${component.plating.heatAdjustment.toLocaleString()}`,
      `爆炸倍率 ${component.plating.explosionPowerMultiplier.toFixed(4)}`,
    );
    return base.join("；");
  }
  if (component.kind === "condensator") {
    base.push(`冷凝容量 ${component.maxHeat.toLocaleString()}`);
    return base.join("；");
  }
  if (component.kind === "reflector") {
    base.push(`耐久 ${component.maxDamage.toLocaleString()}`);
    return base.join("；");
  }
  base.push(`最大热量 ${component.maxHeat.toLocaleString()}`, `最大损伤 ${component.maxDamage.toLocaleString()}`);
  return base.join("；");
}

export function Palette({ onHoverInfoChange }: Props) {
  const selectedId = useSelectedId();
  const [activeGroup, setActiveGroup] = useState(PALETTE_GROUPS[0].title);
  const group = PALETTE_GROUPS.find((item) => item.title === activeGroup) ?? PALETTE_GROUPS[0];

  const showGroupInfo = () => {
    onHoverInfoChange?.({
      title: `组件分类：${group.title}`,
      detail: group.description,
    });
  };

  return (
    <section className="palette-panel" onMouseEnter={showGroupInfo} onMouseLeave={() => onHoverInfoChange?.(null)}>
      <div className="panel-title">组件库</div>
      <button
        className={`palette-empty ${selectedId == null ? "selected" : ""}`}
        onClick={() => setSelectedId(null)}
        onMouseEnter={() =>
          onHoverInfoChange?.({
            title: "空格 / 删除",
            detail: "选择后点击反应堆格子会清空该位置元件。",
          })
        }
        onMouseLeave={showGroupInfo}
      >
        空格 / 删除
      </button>
      <div className="palette-tabs" role="tablist" aria-label="组件分类">
        {PALETTE_GROUPS.map((item) => (
          <button
            key={item.title}
            className={item.title === activeGroup ? "active" : ""}
            onClick={() => {
              setActiveGroup(item.title);
              onHoverInfoChange?.({
                title: `组件分类：${item.title}`,
                detail: item.description,
              });
            }}
            onMouseEnter={() =>
              onHoverInfoChange?.({
                title: `组件分类：${item.title}`,
                detail: item.description,
              })
            }
            onMouseLeave={showGroupInfo}
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
            const component = COMPONENT_BY_ID.get(id);
            if (!component) return null;
            return (
              <button
                key={id}
                className={`palette-item ${selectedId === id ? "selected" : ""}`}
                onClick={() => setSelectedId(id)}
                onMouseEnter={() =>
                  onHoverInfoChange?.({
                    title: `${component.name} · ${component.sourceMod} · ${kindLabel(component.kind)}`,
                    detail: describeComponent(component),
                  })
                }
                onMouseLeave={showGroupInfo}
                title={component.name}
              >
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
