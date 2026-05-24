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

interface PaletteSection {
  title: string;
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
    description: "按 IC2、氦冷、钠钾冷却、空间冷却分段列出；当前模拟按热容处理，流体种类主要用于区分 GTNH 实物来源。",
  },
  "散热/换热": {
    shortTitle: "换热",
    description: "散热片负责释放热量，热交换器负责在元件与堆温之间转移热量，是控温核心组件。",
  },
  "反射/隔板/冷凝": {
    shortTitle: "反射",
    description: "提供中子反射、反应堆隔板抗爆/增热容，以及红石/青金石冷却单元吸热等辅助能力。",
  },
};

const PALETTE_GROUPS: PaletteGroup[] = COMPONENT_PALETTE_GROUPS.map((group) => ({
  ...group,
  ...GROUP_META[group.title],
}));

const PALETTE_SECTIONS: Record<string, PaletteSection[]> = {
  燃料棒: [
    {
      title: "IC2 铀 / MOX",
      description: "IC2 基础铀与 MOX 燃料棒，分别覆盖普通 EU 堆和 MOX 高温行为。",
      ids: [1, 2, 3, 4, 5, 6],
    },
    {
      title: "GregTech 钍",
      description: "钍燃料棒系列，低热、长寿命，适合稳定低输出布局。",
      ids: [26, 27, 28],
    },
    {
      title: "高密度燃料",
      description: "本地汉化词条为浓缩铀/浓缩钚，输出密度更高，浓缩钚按 MOX 风格处理。",
      ids: [36, 37, 38, 39, 40, 41],
    },
    {
      title: "激发燃料",
      description: "激发铀/激发钚系列，热量与输出都很激进，适合高通量方案测试。",
      ids: [42, 43, 44, 59, 60, 61],
    },
    {
      title: "硅岩系",
      description: "硅岩、超能硅岩、泰伯利亚与“核心”，覆盖 GTNH 后期核燃料族。",
      ids: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54],
    },
    {
      title: "特殊单棒",
      description: "荧石与锂燃料棒，按本地 GTNH 实例中存在的反应堆物品保留。",
      ids: [62, 63],
    },
  ],
  冷却单元: [
    {
      title: "IC2 冷却单元",
      description: "基础 10k/30k/60k 冷却单元，作为标准 IC2 热容元件。",
      ids: [14, 15, 16],
    },
    {
      title: "氦冷却单元",
      description: "GTNH 实例中的氦冷却单元系列；模拟行为为对应热容。",
      ids: [64, 65, 66],
    },
    {
      title: "钠钾冷却单元",
      description: "GTNH 实例中的钠钾冷却单元系列；与氦冷分开列出以匹配实际物品。",
      ids: [67, 68, 69],
    },
    {
      title: "空间冷却单元",
      description: "高容量空间冷却单元系列，用于后期大热容布局。",
      ids: [55, 56, 57, 58],
    },
  ],
  "散热/换热": [
    {
      title: "散热片",
      description: "散热片系列，负责从自身、堆温或邻接元件释放热量。",
      ids: [9, 10, 11, 12, 13],
    },
    {
      title: "热交换器",
      description: "热交换器系列，负责在元件之间或元件与堆温之间均衡热量。",
      ids: [17, 18, 19, 20],
    },
  ],
  "反射/隔板/冷凝": [
    {
      title: "反射板",
      description: "中子反射板系列，用于提高相邻燃料棒脉冲数，铱中子反射板来自 GregTech。",
      ids: [7, 8, 35],
    },
    {
      title: "反应堆隔板",
      description: "反应堆隔板系列，调整堆体热容和爆炸倍率，用于安全边界控制。",
      ids: [21, 22, 23],
    },
    {
      title: "冷凝冷却单元",
      description: "红石冷却单元与青金石冷却单元，作为可消耗热量缓冲元件处理。",
      ids: [24, 25],
    },
  ],
};

function kindLabel(kind: ComponentDefinition["kind"]) {
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
  const sections = PALETTE_SECTIONS[group.title];

  const showGroupInfo = () => {
    onHoverInfoChange?.({
      title: `组件分类：${group.title}`,
      detail: group.description,
    });
  };

  const renderItem = (id: number) => {
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
        {sections ? (
          <div className="palette-sections">
            {sections.map((section) => (
              <div className="palette-section" key={section.title}>
                <div
                  className="palette-section-title"
                  onMouseEnter={() =>
                    onHoverInfoChange?.({
                      title: section.title,
                      detail: section.description,
                    })
                  }
                  onMouseLeave={showGroupInfo}
                >
                  {section.title}
                </div>
                <div className="palette-grid">{section.ids.map(renderItem)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="palette-grid">{group.ids.map(renderItem)}</div>
        )}
      </div>
    </section>
  );
}
