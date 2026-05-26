import { useState } from "react";
import type { SimulationEvent, SimulationSummary, TickSnapshot } from "../domain/types";
import { EventsPanel } from "./EventsPanel";
import { FuelStatsPanel } from "./FuelStatsPanel";

interface InfoBarMessage {
  title: string;
  detail: string;
}

interface Props {
  events: SimulationEvent[];
  latest: TickSnapshot | null;
  summary: SimulationSummary | undefined;
  onHoverInfoChange?: (message: InfoBarMessage | null) => void;
}

type DetailsTab = "fuel" | "events";

const TAB_INFO: Record<DetailsTab, InfoBarMessage> = {
  fuel: {
    title: "燃料效率",
    detail: "统计燃料棒耐久使用速度、单位耐久 EU、单位耐久产热，以及完成后的全堆 HU/耐久。",
  },
  events: {
    title: "事件流",
    detail: "按时间倒序显示阈值、损坏、耗尽与完成事件。优先关注 danger 和 warning 级别。",
  },
};

export function RunDetailsPanel({ events, latest, summary, onHoverInfoChange }: Props) {
  const [activeTab, setActiveTab] = useState<DetailsTab>("fuel");

  const showActiveInfo = () => onHoverInfoChange?.(TAB_INFO[activeTab]);

  return (
    <section className="run-details-panel" onMouseEnter={showActiveInfo} onMouseLeave={() => onHoverInfoChange?.(null)}>
      <div className="panel-title run-details-title">统计</div>
      <div className="run-details-tabs" role="tablist" aria-label="运行详情">
        <button
          className={activeTab === "fuel" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={activeTab === "fuel"}
          onClick={() => setActiveTab("fuel")}
          onMouseEnter={() => onHoverInfoChange?.(TAB_INFO.fuel)}
          title="燃料效率"
        >
          燃料效率
        </button>
        <button
          className={activeTab === "events" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={activeTab === "events"}
          onClick={() => setActiveTab("events")}
          onMouseEnter={() => onHoverInfoChange?.(TAB_INFO.events)}
          title="事件流"
        >
          事件流
        </button>
      </div>
      <div className="run-details-body" role="tabpanel">
        {activeTab === "fuel" ? (
          <FuelStatsPanel latest={latest} summary={summary} onHoverInfoChange={onHoverInfoChange} />
        ) : (
          <EventsPanel events={events} />
        )}
      </div>
    </section>
  );
}
