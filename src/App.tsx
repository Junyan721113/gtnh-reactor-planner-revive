import {
  Activity,
  AlertTriangle,
  Cpu,
  Download,
  Flame,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
  StepForward,
  Thermometer,
  Upload,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import { COMPONENT_BY_ID } from "./domain/components";
import { decodeReactorCode, encodeReactorCode } from "./domain/codecs";
import { createEmptyDesign } from "./domain/defaults";
import type { ReactorDesign, SimulationEvent, SimulationResult, TickSnapshot } from "./domain/types";
import { simulationToCsv } from "./sim/csv";
import { showInfo, resetInfo, type InfoBarMessage } from "./state/infoBarStore";
import { getSelectedId, useSelectedId } from "./state/selectionStore";
import { ConfigPanel } from "./ui/ConfigPanel";
import { EventsPanel } from "./ui/EventsPanel";
import { InfoBar } from "./ui/InfoBar";
import { MetricCard, type MetricPoint } from "./ui/MetricCard";
import { Palette } from "./ui/Palette";
import { ReactorGrid } from "./ui/ReactorGrid";
import { SpeedButton } from "./ui/SpeedButton";
import { fmt } from "./utils/format";
import type { WorkerResponse } from "./worker/simulationWorker";

type OperationMode = "idle" | "simulate" | "step" | "xujin";
type WorkerKind = "batch" | "session";
type MetricSeriesState = {
  heat: MetricPoint[];
  eu: MetricPoint[];
  hu: MetricPoint[];
};

const XUJIN_SPEEDS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000];
const INITIAL_REACTOR_CODE = "erp=ARsTxzfN3nf1Bfa1rx77yydR6kABViWJt8zkpzOJZHDTnc8u9+uuRJomf1EJX65KPqAGvgM=";
const MAX_SERIES_POINTS = 5_000;

function toPoint(tick: number, value: number): MetricPoint {
  return { tick, value: Number(value.toFixed(2)) };
}

function createEmptySeriesState(): MetricSeriesState {
  return { heat: [], eu: [], hu: [] };
}

function appendSeriesSnapshot(series: MetricSeriesState, snapshot: TickSnapshot): MetricSeriesState {
  return {
    heat: [...series.heat, toPoint(snapshot.tick, snapshot.reactorHeat)].slice(-MAX_SERIES_POINTS),
    eu: [...series.eu, toPoint(snapshot.tick, snapshot.euPerTick)].slice(-MAX_SERIES_POINTS),
    hu: [...series.hu, toPoint(snapshot.tick, snapshot.huPerTick)].slice(-MAX_SERIES_POINTS),
  };
}

function buildSeriesState(snapshots: TickSnapshot[]): MetricSeriesState {
  return {
    heat: snapshots.map((snapshot) => toPoint(snapshot.tick, snapshot.reactorHeat)),
    eu: snapshots.map((snapshot) => toPoint(snapshot.tick, snapshot.euPerTick)),
    hu: snapshots.map((snapshot) => toPoint(snapshot.tick, snapshot.huPerTick)),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface StatusDetailProps {
  summary: SimulationResult["summary"] | undefined;
}

function StatusDetail({ summary }: StatusDetailProps) {
  const selectedId = useSelectedId();
  const selected = selectedId ? COMPONENT_BY_ID.get(selectedId) : null;
  if (summary) return <>{`${fmt(summary.ticks, 0)} tick`}</>;
  return <>{selected?.name ?? "选择组件后放置"}</>;
}

export default function App() {
  const [design, setDesign] = useState<ReactorDesign>(() => {
    try {
      return decodeReactorCode(INITIAL_REACTOR_CODE);
    } catch {
      return createEmptyDesign();
    }
  });
  const [codeText, setCodeText] = useState(INITIAL_REACTOR_CODE);
  const [snapshots, setSnapshots] = useState<TickSnapshot[]>([]);
  const [seriesState, setSeriesState] = useState<MetricSeriesState>(() => createEmptySeriesState());
  const [latest, setLatest] = useState<TickSnapshot | null>(null);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [mode, setMode] = useState<OperationMode>("idle");
  const [xuJinRunning, setXuJinRunning] = useState(false);
  const xuJinSpeedRef = useRef(1);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerKindRef = useRef<WorkerKind | null>(null);

  const bindInfoHover = (title: string, detail: string, onLeave: () => void = resetInfo) => ({
    onMouseEnter: () => showInfo({ title, detail }),
    onMouseLeave: onLeave,
  });

  const handleExternalInfoChange = (message: InfoBarMessage | null) => {
    if (message) {
      showInfo(message);
      return;
    }
    resetInfo();
  };

  const codePanelInfo: InfoBarMessage = {
    title: "Reactor Code",
    detail: "支持 erp= 编码导入/导出，可保存设计 JSON 并导出本次模拟 CSV。",
  };

  const showCodePanelInfo = () => {
    showInfo(codePanelInfo);
  };

  const attachWorker = (worker: Worker) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "snapshot") {
        setLatest(message.snapshot);
        setSnapshots((existing) => [...existing, message.snapshot].slice(-5_000));
        setSeriesState((existing) => appendSeriesSnapshot(existing, message.snapshot));
      }
      if (message.type === "events") {
        const incoming = [...message.events].reverse();
        setEvents((existing) => [...incoming, ...existing]);
      }
      if (message.type === "xujin:state") {
        setXuJinRunning(message.running);
        xuJinSpeedRef.current = message.speed;
      }
      if (message.type === "step:done") {
        setMode("xujin");
        setXuJinRunning(false);
      }
      if (message.type === "done") {
        setResult(message.result);
        setSnapshots(message.result.snapshots);
        setSeriesState(buildSeriesState(message.result.snapshots));
        setLatest(message.result.snapshots.at(-1) ?? null);
        setEvents([...message.result.events].reverse());
        setMode("idle");
        setXuJinRunning(false);
        worker.terminate();
        workerRef.current = null;
        workerKindRef.current = null;
      }
      if (message.type === "error") {
        setError(message.message);
        setMode("idle");
        setXuJinRunning(false);
        worker.terminate();
        workerRef.current = null;
        workerKindRef.current = null;
      }
    };
  };

  const resetRunState = () => {
    setError(null);
    setResult(null);
    setEvents([]);
    setSnapshots([]);
    setSeriesState(createEmptySeriesState());
    setLatest(null);
  };

  const terminateWorker = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    workerKindRef.current = null;
  };

  const getWorker = (kind: WorkerKind, reuse = false) => {
    if (!reuse || workerKindRef.current !== kind || !workerRef.current) {
      terminateWorker();
      const worker = new Worker(new URL("./worker/simulationWorker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      workerKindRef.current = kind;
      attachWorker(worker);
    }
    return workerRef.current!;
  };

  const runSimulation = () => {
    const continuing = workerKindRef.current === "session" && workerRef.current != null;
    const worker = getWorker("session", true);
    if (!continuing) resetRunState();
    setError(null);
    setResult(null);
    setMode("simulate");
    setXuJinRunning(true);
    worker.postMessage({
      type: "xujin:simulateFast",
      design,
      options: {
        maxTicks: design.config.maxSimulationTicks,
        maxSnapshots: 5_000,
      },
    });
  };

  const runSingleStep = () => {
    const continuing = workerKindRef.current === "session" && workerRef.current != null;
    const worker = getWorker("session", true);
    if (!continuing) resetRunState();
    setError(null);
    setResult(null);
    setMode("step");
    setXuJinRunning(false);
    worker.postMessage({
      type: "step",
      design,
      options: {
        maxTicks: design.config.maxSimulationTicks,
        maxSnapshots: 5_000,
      },
    });
  };

  const startXuJin = () => {
    const continuing = workerKindRef.current === "session" && workerRef.current != null;
    const worker = getWorker("session", true);
    if (!continuing) resetRunState();
    setMode("xujin");
    setXuJinRunning(true);
    worker.postMessage({
      type: "xujin:start",
      design,
      speed: xuJinSpeedRef.current,
      options: {
        maxTicks: design.config.maxSimulationTicks,
        maxSnapshots: 5_000,
      },
    });
  };

  const pauseXuJin = () => {
    workerRef.current?.postMessage({ type: "xujin:pause" });
  };

  const resumeXuJin = () => {
    workerRef.current?.postMessage({ type: "xujin:resume" });
  };

  const updateXuJinSpeed = (speed: number) => {
    xuJinSpeedRef.current = speed;
    if (mode === "xujin") workerRef.current?.postMessage({ type: "xujin:setSpeed", speed });
  };

  const stopCurrentRun = () => {
    workerRef.current?.postMessage(workerKindRef.current === "session" ? { type: "xujin:stop" } : { type: "cancel" });
    terminateWorker();
    resetRunState();
    setMode("idle");
    setXuJinRunning(false);
  };

  const invalidateSimulationState = () => {
    terminateWorker();
    resetRunState();
    setMode("idle");
    setXuJinRunning(false);
  };

  const updateDesign = (recipe: (draft: ReactorDesign) => void) => {
    invalidateSimulationState();
    setDesign((current) => {
      const next: ReactorDesign = {
        config: { ...current.config },
        grid: current.grid.map((row) => row.map((cell) => ({ ...cell }))),
      };
      recipe(next);
      return next;
    });
  };

  const placeCell = (row: number, col: number) => {
    if (mode !== "idle") return;
    updateDesign((draft) => {
      const selectedId = getSelectedId();
      draft.grid[row][col] = selectedId == null ? { componentId: null } : { componentId: selectedId };
    });
  };

  const exportCode = () => {
    const code = encodeReactorCode(design);
    setCodeText(code);
    void navigator.clipboard?.writeText(code);
  };

  const importCode = () => {
    try {
      invalidateSimulationState();
      setDesign(decodeReactorCode(codeText));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const clearDesign = () => {
    terminateWorker();
    setDesign(createEmptyDesign());
    resetRunState();
    setMode("idle");
    setXuJinRunning(false);
  };

  const pickSavePath = async (params: {
    title: string;
    defaultFilename: string;
    filterName: string;
    fileExtension: string;
  }) => {
    const path = await invoke<string | null>("pick_save_path", {
      title: params.title,
      default_filename: params.defaultFilename,
      filter_name: params.filterName,
      file_extension: params.fileExtension,
    });
    return typeof path === "string" && path.length > 0 ? path : null;
  };

  const saveDesignFile = async () => {
    try {
      const path = await pickSavePath({
        title: "保存反应堆设计",
        defaultFilename: "reactor-design.json",
        filterName: "JSON 文件",
        fileExtension: "json",
      });
      if (!path) return;
      await invoke("write_text_file", {
        path,
        contents: JSON.stringify(design, null, 2),
      });
      setError(null);
    } catch (error) {
      setError(`保存设计失败：${getErrorMessage(error)}`);
    }
  };

  const exportCsvFile = async () => {
    if (!result) return;
    try {
      const path = await pickSavePath({
        title: "导出模拟 CSV",
        defaultFilename: "reactor-simulation.csv",
        filterName: "CSV 文件",
        fileExtension: "csv",
      });
      if (!path) return;
      await invoke("write_text_file", {
        path,
        contents: simulationToCsv(result),
      });
      setError(null);
    } catch (error) {
      setError(`导出 CSV 失败：${getErrorMessage(error)}`);
    }
  };

  const summary = result?.summary;
  const running = mode !== "idle";
  const simulationRunning = mode === "simulate";
  const stepBusy = mode === "step";
  const xuJinBusy = mode === "xujin" && xuJinRunning;
  const hardBusy = simulationRunning || stepBusy || xuJinBusy;
  const canRestart = mode !== "idle" || snapshots.length > 0 || events.length > 0 || latest != null || result != null;
  const statusLabel =
    mode === "simulate"
      ? "高速模拟"
      : mode === "step"
        ? "单步判定"
        : mode === "xujin"
          ? xuJinRunning
            ? "徐进中"
            : "模拟暂停"
          : summary?.exploded
            ? "爆炸"
            : summary
              ? "完成"
              : "待机";

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <InfoBar />

        <div className="hero-actions">
          <button
            {...bindInfoHover("单步判定", "执行 1 次 tick 判定并保留当前进度，不会重置徐进计时。")}
            onClick={runSingleStep}
            disabled={simulationRunning || stepBusy}
          >
            <StepForward size={18} /> 单步
          </button>
          <button
            {...bindInfoHover(
              xuJinRunning ? "徐进已运行" : "徐进模式",
              xuJinRunning ? "暂停持续判定并保持当前进度。" : "按当前速度持续判定，可与单步共享同一进度。",
            )}
            onClick={mode === "xujin" ? (xuJinRunning ? pauseXuJin : resumeXuJin) : startXuJin}
            disabled={simulationRunning || stepBusy}
          >
            {mode === "xujin" ? xuJinRunning ? <Pause size={18} /> : <Play size={18} /> : <Gauge size={18} />}
            {xuJinRunning ? "暂停" : "徐进"}
          </button>
          <button
            className="primary"
            {...bindInfoHover("高速模拟", "以尽可能快的速度运行到结束，不受徐进速度档位限制。")}
            onClick={runSimulation}
            disabled={hardBusy}
          >
            <Play size={18} /> 模拟
          </button>
          <button
            {...bindInfoHover("停止", "终止当前会话并从头开始，清空快照、事件与曲线。")}
            onClick={stopCurrentRun}
            disabled={!canRestart}
          >
            <Square size={16} /> 停止
          </button>
          <SpeedButton
            initialSpeed={xuJinSpeedRef.current}
            disabled={simulationRunning || stepBusy}
            onSpeedChange={updateXuJinSpeed}
            speeds={XUJIN_SPEEDS}
            {...bindInfoHover("速度档位", "切换徐进速度倍率（1x 到 10000x），用于控制徐进节奏。")}
          />
          <button
            {...bindInfoHover("清空布局", "清空堆芯元件并重置当前运行状态。")}
            onClick={clearDesign}
            disabled={hardBusy}
          >
            <RotateCcw size={18} /> 清空
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          icon={<Thermometer />}
          label="堆温"
          value={fmt(latest?.reactorHeat ?? design.config.currentHeat, 0)}
          detail={`/ ${fmt(latest?.maxHeat ?? 10_000, 0)}`}
          tone="heat"
          series={seriesState.heat}
        />
        <MetricCard
          icon={<Cpu />}
          label="EU/t"
          value={fmt(latest?.euPerTick ?? summary?.avgEUt ?? 0)}
          detail={`总 EU ${fmt(summary?.totalEU ?? 0, 0)}`}
          tone="eu"
          series={seriesState.eu}
        />
        <MetricCard
          icon={<Flame />}
          label="HU/t"
          value={fmt(latest?.huPerTick ?? summary?.avgHUt ?? 0)}
          detail={`总 HU ${fmt(summary?.totalHU ?? 0, 0)}`}
          tone="hu"
          series={seriesState.hu}
        />
        <MetricCard
          icon={<Activity />}
          label="状态"
          value={statusLabel}
          detail={<StatusDetail summary={summary} />}
          tone={summary?.exploded ? "danger" : "neutral"}
        />
      </section>

      {error && (
        <section className="error-banner">
          <AlertTriangle size={18} />
          {error}
        </section>
      )}

      <section className="workspace">
        <aside className="side-panel left-panel">
          <div
            onMouseEnter={() =>
              showInfo({
                title: "模拟配置",
                detail: "配置流体堆、脉冲、自动替换、温度阈值和最大秒数，改动后会重新模拟。",
              })
            }
            onMouseLeave={resetInfo}
          >
            <ConfigPanel config={design.config} onChange={(patch) => updateDesign((draft) => Object.assign(draft.config, patch))} />
          </div>
          <div className="code-panel" onMouseEnter={showCodePanelInfo} onMouseLeave={resetInfo}>
            <div className="panel-title">Reactor Code</div>
            <textarea
              {...bindInfoHover("Reactor Code 输入框", "粘贴或编辑 erp= 编码，再点击“导入代码”应用到当前堆芯。", showCodePanelInfo)}
              value={codeText}
              onChange={(event) => setCodeText(event.target.value)}
              placeholder="erp=..."
              disabled={running}
            />
            <div className="button-row">
              <button {...bindInfoHover("导出代码", "将当前反应堆布局编码为 erp= 文本，并写入剪贴板。", showCodePanelInfo)} onClick={exportCode} disabled={running}>
                <Upload size={16} /> 导出代码
              </button>
              <button {...bindInfoHover("导入代码", "用输入框中的 erp= 文本覆盖当前布局并重置运行状态。", showCodePanelInfo)} onClick={importCode} disabled={running}>
                <Download size={16} /> 导入代码
              </button>
            </div>
            <div className="button-row">
              <button {...bindInfoHover("保存设计", "弹出路径选择窗口，将当前设计保存为 JSON 文件。", showCodePanelInfo)} onClick={() => void saveDesignFile()}>
                <Save size={16} /> 保存设计
              </button>
              <button
                {...bindInfoHover("导出 CSV", "弹出路径选择窗口，导出本次模拟的逐 tick 统计数据。", showCodePanelInfo)}
                disabled={!result}
                onClick={() => void exportCsvFile()}
              >
                <Download size={16} /> 导出 CSV
              </button>
            </div>
          </div>
        </aside>

        <section className="reactor-stage">
          <ReactorGrid design={design} latest={latest} onCellClick={placeCell} onHoverInfoChange={handleExternalInfoChange} />
        </section>

        <aside className="side-panel">
          <Palette onHoverInfoChange={handleExternalInfoChange} />
          <div
            onMouseEnter={() =>
              showInfo({
                title: "事件流",
                detail: "按时间倒序显示阈值、损坏、耗尽与完成事件。优先关注 danger 和 warning 级别。",
              })
            }
            onMouseLeave={resetInfo}
          >
            <EventsPanel events={events} />
          </div>
        </aside>
      </section>
    </main>
  );
}

