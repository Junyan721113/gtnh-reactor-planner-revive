import type { ReactorDesign, SimulationResult, TickSnapshot } from "../domain/types";
import { simulate } from "../sim/simulator";
import { StepwiseSimulator } from "../sim/stepper";
import { getXuJinIntervalMs, getXuJinStepsPerRefresh, normalizeXuJinSpeed } from "./timing";

export type WorkerRequest =
  | {
      type: "simulate";
      design: ReactorDesign;
      options?: {
        maxTicks?: number;
        sampleEvery?: number;
        maxSnapshots?: number;
      };
    }
  | {
      type: "xujin:start";
      design: ReactorDesign;
      speed: number;
      options?: {
        maxTicks?: number;
        maxSnapshots?: number;
      };
    }
  | {
      type: "xujin:simulateFast";
      design: ReactorDesign;
      options?: {
        maxTicks?: number;
        maxSnapshots?: number;
      };
    }
  | {
      type: "step";
      design: ReactorDesign;
      options?: {
        maxTicks?: number;
        maxSnapshots?: number;
      };
    }
  | { type: "xujin:setSpeed"; speed: number }
  | { type: "xujin:pause" }
  | { type: "xujin:resume" }
  | { type: "xujin:stop" }
  | { type: "cancel" };

export type WorkerResponse =
  | { type: "snapshot"; snapshot: TickSnapshot }
  | { type: "events"; events: import("../domain/types").SimulationEvent[] }
  | { type: "xujin:state"; running: boolean; speed: number; tick: number }
  | { type: "step:done"; tick: number }
  | { type: "done"; result: SimulationResult }
  | { type: "error"; message: string; stack?: string };

let cancelled = false;
let sessionRunner: StepwiseSimulator | null = null;
let sessionTimer: ReturnType<typeof setInterval> | null = null;
let fastLoopTimer: ReturnType<typeof setTimeout> | null = null;
let sessionSpeed = 1;
let sessionRunning = false;
let sessionStepCarry = 0;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === "cancel") {
    cancelled = true;
    clearSession(true);
    return;
  }
  if (request.type === "step") {
    runSingleStep(request.design, request.options);
    return;
  }
  if (request.type === "xujin:start") {
    startXuJin(request.design, request.speed, request.options);
    return;
  }
  if (request.type === "xujin:simulateFast") {
    startFastSimulation(request.design, request.options);
    return;
  }
  if (request.type === "xujin:setSpeed") {
    sessionSpeed = normalizeXuJinSpeed(request.speed);
    if (sessionTimer) restartXuJinTimer();
    postXuJinState(sessionRunning);
    return;
  }
  if (request.type === "xujin:pause") {
    pauseXuJin();
    return;
  }
  if (request.type === "xujin:resume") {
    resumeXuJin();
    return;
  }
  if (request.type === "xujin:stop") {
    clearSession(true);
    return;
  }
  if (request.type !== "simulate") return;
  clearSession(false);
  cancelled = false;
  try {
    const result = simulate(request.design, {
      ...request.options,
      onSnapshot(snapshot) {
        if (!cancelled) {
          self.postMessage({ type: "snapshot", snapshot } satisfies WorkerResponse);
        }
      },
    });
    if (!cancelled) self.postMessage({ type: "done", result } satisfies WorkerResponse);
  } catch (error) {
    const err = error as Error;
    self.postMessage({ type: "error", message: err.message, stack: err.stack } satisfies WorkerResponse);
  }
};

function runSingleStep(design: ReactorDesign, options: { maxTicks?: number; maxSnapshots?: number } = {}) {
  pauseXuJin();
  cancelled = false;
  try {
    ensureSessionRunner(design, options);
    const step = runSessionTickBatch(1);
    if (!step) return;
    if (step.completed) return;
    self.postMessage({ type: "step:done", tick: step.snapshot.tick } satisfies WorkerResponse);
    postXuJinState(false);
  } catch (error) {
    const err = error as Error;
    self.postMessage({ type: "error", message: err.message, stack: err.stack } satisfies WorkerResponse);
  }
}

function startXuJin(design: ReactorDesign, speed: number, options: { maxTicks?: number; maxSnapshots?: number } = {}) {
  pauseXuJin();
  cancelled = false;
  sessionSpeed = normalizeXuJinSpeed(speed);
  try {
    ensureSessionRunner(design, options);
    sessionRunning = true;
    restartXuJinTimer();
    postXuJinState(true);
  } catch (error) {
    const err = error as Error;
    self.postMessage({ type: "error", message: err.message, stack: err.stack } satisfies WorkerResponse);
  }
}

function startFastSimulation(design: ReactorDesign, options: { maxTicks?: number; maxSnapshots?: number } = {}) {
  pauseXuJin();
  cancelled = false;
  try {
    ensureSessionRunner(design, options);
    sessionRunning = true;
    scheduleFastSimulationChunk();
    postXuJinState(true);
  } catch (error) {
    const err = error as Error;
    self.postMessage({ type: "error", message: err.message, stack: err.stack } satisfies WorkerResponse);
  }
}

function ensureSessionRunner(design: ReactorDesign, options: { maxTicks?: number; maxSnapshots?: number }) {
  sessionRunner ??= new StepwiseSimulator(design, {
    maxTicks: options.maxTicks,
    maxSnapshots: options.maxSnapshots ?? 5_000,
    sampleEvery: 1,
  });
}

function pauseXuJin() {
  if (sessionTimer) clearInterval(sessionTimer);
  if (fastLoopTimer) clearTimeout(fastLoopTimer);
  sessionTimer = null;
  fastLoopTimer = null;
  sessionRunning = false;
  postXuJinState(false);
}

function resumeXuJin() {
  if (!sessionRunner || sessionTimer || fastLoopTimer) return;
  sessionRunning = true;
  restartXuJinTimer();
  postXuJinState(true);
}

function restartXuJinTimer() {
  if (sessionTimer) clearInterval(sessionTimer);
  sessionStepCarry = 0;
  sessionTimer = setInterval(runXuJinTick, getXuJinIntervalMs(sessionSpeed));
}

function runXuJinTick() {
  const batch = getXuJinStepsPerRefresh(sessionSpeed, sessionStepCarry);
  sessionStepCarry = batch.carry;
  const step = runSessionTickBatch(batch.steps);
  if (!step) return;
  if (step.completed) return;
  postXuJinState(true);
}

function scheduleFastSimulationChunk() {
  if (!sessionRunning || cancelled || !sessionRunner) return;
  fastLoopTimer = setTimeout(runFastSimulationChunk, 0);
}

function runFastSimulationChunk() {
  fastLoopTimer = null;
  if (!sessionRunning || cancelled || !sessionRunner) return;
  const step = runSessionTickBatch(4_000);
  if (!step) return;
  if (step.completed) return;
  postXuJinState(true);
  scheduleFastSimulationChunk();
}

/** Run a batch of ticks using stepBatch (builds only final snapshot). Posts done+clearSession internally on completion. */
function runSessionTickBatch(stepsToRun: number) {
  if (!sessionRunner || cancelled) return null;
  const result = sessionRunner.stepBatch(stepsToRun);
  if (result.completed && result.result) {
    self.postMessage({ type: "done", result: result.result } satisfies WorkerResponse);
    clearSession(false);
    return result;
  }
  const events = result.events;
  if (events.length > 0) {
    self.postMessage({ type: "events", events } satisfies WorkerResponse);
  }
  self.postMessage({ type: "snapshot", snapshot: result.snapshot } satisfies WorkerResponse);
  return result;
}

function clearSession(emitState: boolean) {
  if (sessionTimer) clearInterval(sessionTimer);
  if (fastLoopTimer) clearTimeout(fastLoopTimer);
  sessionTimer = null;
  fastLoopTimer = null;
  sessionRunner = null;
  sessionRunning = false;
  sessionStepCarry = 0;
  if (emitState) postXuJinState(false);
}

function postXuJinState(running: boolean) {
  self.postMessage({ type: "xujin:state", running, speed: sessionSpeed, tick: sessionRunner?.tick ?? 0 } satisfies WorkerResponse);
}
