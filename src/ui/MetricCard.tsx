import { memo, type ReactNode, useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface MetricPoint {
  tick: number;
  value: number;
}

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  detail: ReactNode;
  tone: "heat" | "eu" | "hu" | "danger" | "neutral";
  series?: MetricPoint[];
}

const TONE_COLORS: Record<Props["tone"], string> = {
  heat: "#ff9f43",
  eu: "#63e6be",
  hu: "#74c0fc",
  danger: "#ff4d5e",
  neutral: "#9fb3c7",
};

function compactSeries(series: MetricPoint[], limit = 180) {
  if (series.length <= limit) return series;
  const step = Math.ceil(series.length / limit);
  return series.filter((_, index) => index % step === 0 || index === series.length - 1);
}

export const MetricCard = memo(function MetricCard({ icon, label, value, detail, tone, series = [] }: Props) {
  const rawId = useId().replace(/:/g, "");
  const gradientId = `metric-gradient-${rawId}`;
  const color = TONE_COLORS[tone];
  const hasChart = series.length > 1;
  const miniSeries = compactSeries(series);

  return (
    <article className={`metric-card tone-${tone} ${hasChart ? "has-chart" : "no-chart"}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-copy">
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>

      {hasChart && (
        <>
          <div className="metric-sparkline" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={miniSeries}>
                <defs>
                  <linearGradient id={`${gradientId}-mini`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${gradientId}-mini)`} strokeWidth={2} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="metric-chart-popover">
            <div className="popover-title">
              <span>{label} 完整曲线</span>
              <small>{series.length.toLocaleString()} 个采样点</small>
            </div>
            <div className="popover-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="tick" stroke="#8ea4b8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#8ea4b8" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0d1724", border: "1px solid rgba(255,255,255,.14)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </article>
  );
});

MetricCard.displayName = "MetricCard";
