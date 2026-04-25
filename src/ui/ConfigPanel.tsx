import type { SimulationConfig } from "../domain/types";
import { memo } from "react";

interface Props {
  config: SimulationConfig;
  onChange: (patch: Partial<SimulationConfig>) => void;
}

export const ConfigPanel = memo(function ConfigPanel({ config, onChange }: Props) {
  return (
    <section className="config-panel">
      <div className="panel-title">模拟配置</div>
      <label className="switch-row">
        <span>流体反应堆</span>
        <input type="checkbox" checked={config.fluid} onChange={(event) => onChange({ fluid: event.target.checked })} />
      </label>
      <label className="switch-row">
        <span>脉冲控制</span>
        <input type="checkbox" checked={config.pulsed} onChange={(event) => onChange({ pulsed: event.target.checked })} />
      </label>
      <label className="switch-row">
        <span>自动化替换</span>
        <input type="checkbox" checked={config.automated} onChange={(event) => onChange({ automated: event.target.checked, pulsed: event.target.checked || config.pulsed })} />
      </label>
      <label className="switch-row">
        <span>冷却液注入器</span>
        <input type="checkbox" checked={config.usingReactorCoolantInjectors} onChange={(event) => onChange({ usingReactorCoolantInjectors: event.target.checked })} />
      </label>
      <div className="field-grid">
        <label>
          初始堆温
          <input type="number" value={config.currentHeat} onChange={(event) => onChange({ currentHeat: Number(event.target.value) })} />
        </label>
        <label>
          最大秒数
          <input type="number" value={config.maxSimulationTicks} onChange={(event) => onChange({ maxSimulationTicks: Number(event.target.value) })} />
        </label>
        <label>
          On Pulse
          <input type="number" value={config.onPulse} onChange={(event) => onChange({ onPulse: Number(event.target.value) })} />
        </label>
        <label>
          Off Pulse
          <input type="number" value={config.offPulse} onChange={(event) => onChange({ offPulse: Number(event.target.value) })} />
        </label>
        <label>
          暂停温度
          <input type="number" value={config.suspendTemp} onChange={(event) => onChange({ suspendTemp: Number(event.target.value) })} />
        </label>
        <label>
          恢复温度
          <input type="number" value={config.resumeTemp} onChange={(event) => onChange({ resumeTemp: Number(event.target.value) })} />
        </label>
      </div>
      <label>
        GT 行为
        <select value={config.gtMode} onChange={(event) => onChange({ gtMode: event.target.value as SimulationConfig["gtMode"] })}>
          <option value="GTNH">GTNH</option>
          <option value="none">IC2/默认</option>
        </select>
      </label>
    </section>
  );
});

ConfigPanel.displayName = "ConfigPanel";
