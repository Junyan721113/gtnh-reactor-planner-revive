import { memo } from "react";
import type { BreederProgressStat, FuelRodDepletionStat, SimulationSummary, TickSnapshot } from "../domain/types";

interface InfoBarMessage {
  title: string;
  detail: string;
}

interface Props {
  latest: TickSnapshot | null;
  summary: SimulationSummary | undefined;
  onHoverInfoChange?: (message: InfoBarMessage | null) => void;
}

function fmt(value: number, digits = 0) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function summarize(stats: FuelRodDepletionStat[]) {
  return stats.reduce(
    (acc, stat) => ({
      totalDamage: acc.totalDamage + stat.totalDamage,
      totalEU: acc.totalEU + stat.totalEU,
      totalHeat: acc.totalHeat + stat.totalHeat,
    }),
    { totalDamage: 0, totalEU: 0, totalHeat: 0 },
  );
}

function summarizeBreeders(stats: BreederProgressStat[]) {
  return stats.reduce(
    (acc, stat) => ({
      totalProgress: acc.totalProgress + stat.totalProgress,
      activeTicks: acc.activeTicks + stat.activeTicks,
    }),
    { totalProgress: 0, activeTicks: 0 },
  );
}

function statDetail(stat: FuelRodDepletionStat) {
  return [
    `位置 R${stat.row + 1}C${stat.col + 1}`,
    `耐久/tick ${fmt(stat.lastDamageDelta, 2)}`,
    `已用耐久 ${fmt(stat.totalDamage, 0)} / ${fmt(stat.maxDamage, 0)}`,
    `EU/耐久 ${fmt(stat.euPerDamage, 2)}`,
    `产热/耐久 ${fmt(stat.heatPerDamage, 2)}`,
    stat.estimatedDepletionTick ? `预计耗尽 ${fmt(stat.estimatedDepletionTick, 0)}s` : "尚未消耗",
  ].join("；");
}

function breederDetail(stat: BreederProgressStat) {
  return [
    `位置 R${stat.row + 1}C${stat.col + 1}`,
    `增殖/tick ${fmt(stat.lastProgressDelta, 2)}`,
    `平均增殖/tick ${fmt(stat.progressPerTick, 2)}`,
    `已增殖 ${fmt(stat.currentDamage, 0)} / ${fmt(stat.maxDamage, 0)}`,
    stat.estimatedCompletionTick ? `预计完成 ${fmt(stat.estimatedCompletionTick, 0)}s` : "尚未增殖",
  ].join("；");
}

export const FuelStatsPanel = memo(function FuelStatsPanel({ latest, summary, onHoverInfoChange }: Props) {
  const stats = summary?.fuelRodStats ?? latest?.fuelRodStats ?? [];
  const breederStats = summary?.breederStats ?? latest?.breederStats ?? [];
  const aggregate = summarize(stats);
  const breederAggregate = summarizeBreeders(breederStats);
  const totalDamage = summary?.totalFuelDamage ?? aggregate.totalDamage;
  const euPerDamage = summary?.euPerFuelDamage ?? (totalDamage > 0 ? aggregate.totalEU / totalDamage : 0);
  const heatPerDamage = summary?.heatPerFuelDamage ?? (totalDamage > 0 ? aggregate.totalHeat / totalDamage : 0);
  const breederProgressPerTick = breederAggregate.activeTicks > 0 ? breederAggregate.totalProgress / breederAggregate.activeTicks : 0;
  const sorted = [...stats].sort((a, b) => b.euPerDamage - a.euPerDamage || b.heatPerDamage - a.heatPerDamage).slice(0, 5);
  const sortedBreeders = [...breederStats]
    .sort((a, b) => b.progressPerTick - a.progressPerTick || b.lastProgressDelta - a.lastProgressDelta)
    .slice(0, 5);

  const panelInfo: InfoBarMessage = {
    title: "燃料效率",
    detail: "统计燃料棒耐久使用速度、单位耐久产出，以及锂/荧石增殖棒的增殖进度和预计完成时间。",
  };

  return (
    <section className="fuel-stats-panel" onMouseEnter={() => onHoverInfoChange?.(panelInfo)} onMouseLeave={() => onHoverInfoChange?.(null)}>
      <div className="panel-title">燃料效率</div>
      {stats.length === 0 && breederStats.length === 0 ? (
        <p className="muted">运行后显示燃料棒耐久速度、单位耐久产出，以及增殖棒进度。</p>
      ) : (
        <>
          <div className="fuel-efficiency-summary">
            {stats.length > 0 ? <span>已用耐久 {fmt(totalDamage, 0)}</span> : null}
            {stats.length > 0 ? <span>EU/耐久 {fmt(euPerDamage, 2)}</span> : null}
            {stats.length > 0 ? <span>产热/耐久 {fmt(heatPerDamage, 2)}</span> : null}
            {summary && stats.length > 0 ? <span>HU/耐久 {fmt(summary.huPerFuelDamage, 2)}</span> : null}
            {breederStats.length > 0 ? <span>增殖进度 {fmt(breederAggregate.totalProgress, 0)}</span> : null}
            {breederStats.length > 0 ? <span>增殖/tick {fmt(breederProgressPerTick, 2)}</span> : null}
          </div>
          <div className="fuel-stat-list">
            {sorted.map((stat) => (
              <article
                className="fuel-stat-item"
                key={`${stat.row}:${stat.col}:${stat.id}`}
                onMouseEnter={() =>
                  onHoverInfoChange?.({
                    title: `${stat.name} · R${stat.row + 1}C${stat.col + 1}`,
                    detail: statDetail(stat),
                  })
                }
                onMouseLeave={() => onHoverInfoChange?.(panelInfo)}
              >
                <strong>{stat.name}</strong>
                <span>R{stat.row + 1}C{stat.col + 1}</span>
                <p>
                  耐久/tick {fmt(stat.lastDamageDelta, 2)} · EU/耐久 {fmt(stat.euPerDamage, 1)} · 产热/耐久 {fmt(stat.heatPerDamage, 1)}
                </p>
              </article>
            ))}
            {sortedBreeders.map((stat) => (
              <article
                className="fuel-stat-item breeder-stat-item"
                key={`${stat.row}:${stat.col}:${stat.id}`}
                onMouseEnter={() =>
                  onHoverInfoChange?.({
                    title: `${stat.name} · R${stat.row + 1}C${stat.col + 1}`,
                    detail: breederDetail(stat),
                  })
                }
                onMouseLeave={() => onHoverInfoChange?.(panelInfo)}
              >
                <strong>{stat.name}</strong>
                <span>R{stat.row + 1}C{stat.col + 1}</span>
                <p>
                  增殖/tick {fmt(stat.lastProgressDelta, 2)} · 平均 {fmt(stat.progressPerTick, 2)} · 进度 {fmt(stat.currentDamage, 0)} /{" "}
                  {fmt(stat.maxDamage, 0)}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
});

FuelStatsPanel.displayName = "FuelStatsPanel";
