import type { SimulationEvent } from "../domain/types";
import { memo } from "react";

interface Props {
  events: SimulationEvent[];
}

export const EventsPanel = memo(function EventsPanel({ events }: Props) {
  return (
    <section className="events-panel">
      <div className="panel-title">事件流</div>
      {events.length === 0 ? (
        <p className="muted">运行模拟后显示温度阈值、损坏、耗尽和完成事件。</p>
      ) : (
        <div className="event-list">
          {events.slice(0, 80).map((event, index) => (
            <article className={`event-item ${event.level}`} key={`${event.tick}:${index}`}>
              <span>{event.tick.toLocaleString()}s</span>
              <p>{event.message.replace(/^[^@]+@/, "")}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
});

EventsPanel.displayName = "EventsPanel";
