import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TickSnapshot } from "../domain/types";

interface Props {
  snapshots: TickSnapshot[];
}

export function ChartsPanel({ snapshots }: Props) {
  const data = snapshots.map((snapshot) => ({
    tick: snapshot.tick,
    heat: Math.round(snapshot.reactorHeat),
    eu: Number(snapshot.euPerTick.toFixed(2)),
    hu: Number(snapshot.huPerTick.toFixed(2)),
  }));

  return (
    <section className="charts-grid">
      <article className="chart-card">
        <div className="panel-title">堆温曲线</div>
        <div className="chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
            <defs>
              <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff7a18" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ff7a18" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey="tick" stroke="#8ea4b8" />
            <YAxis stroke="#8ea4b8" />
            <Tooltip contentStyle={{ background: "#0d1724", border: "1px solid rgba(255,255,255,.14)" }} />
            <Area type="monotone" dataKey="heat" stroke="#ff9f43" fill="url(#heatGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="chart-card">
        <div className="panel-title">输出曲线</div>
        <div className="chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey="tick" stroke="#8ea4b8" />
            <YAxis stroke="#8ea4b8" />
            <Tooltip contentStyle={{ background: "#0d1724", border: "1px solid rgba(255,255,255,.14)" }} />
            <Line type="monotone" dataKey="eu" stroke="#63e6be" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="hu" stroke="#74c0fc" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
