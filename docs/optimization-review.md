# Ic2ExpReactorPlanner-RE 优化审查报告

**审查日期**: 2026-05-25  |  **范围**: 全部源码 + 测试 + 构建配置  |  **TypeScript**: 通过  |  **测试**: 13/13 通过

---

## 1. 架构总览

项目结构清晰，分层合理：

- `src/domain/` -- 类型定义、元件数据、codec、默认配置
- `src/sim/` -- 纯运行时模拟引擎（无 DOM 依赖）
- `src/worker/` -- Web Worker 调度层
- `src/state/` -- 两个外部 store（`useSyncExternalStore`），脱离 React 渲染路径
- `src/ui/` -- 视图组件
- `src/utils/` -- 格式化、CSV、下载工具

模拟核心（`runtime.ts` + `stepper.ts`）与 UI 完全解耦，Worker 线程模型隔离良好，整体设计符合 AGENTS.md 记录的决策。

---

## 2. 性能优化建议

### 2.1 App.tsx 高频快照处理（中优先级）

**文件**: `src/App.tsx:61`

问题：`appendSeriesSnapshot` 在每次 XuJin tick 时创建 3 个新数组，每个数组取最后 5000 项。先 spread 再 slice 等价于先分配 5001 项数组再丢弃前一项，GC 压力大。高速模拟每 4000 tick 推送快照，主线程每帧仍做 O(n) 内存分配。

建议：使用环形缓冲区或仅在超过上限时才做 slice。更激进的做法是中间推送的快照完全不更新 series（MetricCard 只显示当前值，hover 时才需要完整曲线），仅在 `done` 消息时通过 `buildSeriesState` 批量构建。注意这会改变"运行中也能 hover 看曲线"的交互，需权衡。

### 2.2 ReactorGrid.tsx 每帧重建 Marker 和 State Map（中优先级）

**文件**: `src/ui/ReactorGrid.tsx:225`

问题：
- `componentState`、`fuelRodStats`、`mergedHeatMarkers`、`hullMarkers` 四个 `useMemo` 全部依赖 `latest`（每次 tick 变化都触发）。
- `toNetEdgeFlows` 对每个 heat flow 做双向合并和方向判定。
- `mapFlowToWarmSpectrum` 内部有 `Math.log2`、`smoothstep` 和 HSL 色值插值计算，每个箭头都走一遍。
- 54 个格子每个都有 marker 数组、hull dot、heat fill 条，render 时总共 200+ 子节点。

建议：挪到 Worker 端预计算工作量不小，更实际的改法是优化 `useMemo` 依赖列表、或用 `useDeferredValue` 降低快照更新频率。`componentState` 和 `fuelRodStats` 的 `Map` 可换成 object literal（54 槽位时对象字面量迭代更快）。

### 2.3 MetricCard 完整曲线 Popover（高优先级）

**文件**: `src/ui/MetricCard.tsx:72`

问题：hover 时挂载全量 5000 点的 `<AreaChart>`。Recharts SVG chart 在 5000 点时即使关闭动画仍消耗 80-150ms 渲染时间。但 `compactSeries` 函数已经存在（limit=180 用于迷你图），popover 里并未调用，改一行即可修复。

建议：popover 内 `data={compactSeries(series, 400)}` 替换 `data={series}`。

### 2.4 Worker 消息体量（低优先级，实测影响小）

**文件**: `src/worker/simulationWorker.ts:198`

`TickSnapshot` 的 `components` 字段包含全部 54 槽位快照，每次 postMessage 结构化克隆约 3-5KB。这个量级在当前环境下问题不大，做增量推送反而会引入不必要的同步复杂度。保持现状即可。

---

## 3. 代码质量与可维护性

### 3.1 调色板 ID 列表的三处硬编码（高优先级）

**文件**: `src/domain/components.ts:304` + `src/ui/Palette.tsx:49`

问题：新增一个元件需要同步修改 3 处：`COMPONENTS` 数组 + `PALETTE_GROUPS` + `PALETTE_SECTIONS`，且 `PALETTE_GROUPS` 的 ID 列表是手写扁平数组，极易出错。

建议：给 `ComponentDefinition` 增加 `category` 和 `subcategory` 字段，然后通过 `COMPONENTS.filter()` 动态生成所有分组。这是正确的工程方向，一劳永逸解决分类同步问题。

### 3.2 App.tsx 状态集中度（低优先级，已基本解决）

**文件**: `src/App.tsx`

App.tsx 有 15 个 `useState` + 3 个 `useRef`，但之前专门做的 `selectionStore`、`infoBarStore`、`SpeedButton` 分离已经解决了核心渲染路径问题——hover 不再触发整页重渲染、选中状态不经过 App。进一步拆分 worker 逻辑为独立 hook 收益边际递减，当前结构在可维护性与复杂度之间已经取得合理平衡。

### 3.3 未使用的模块（低优先级）

- `src/ui/ChartsPanel.tsx` -- 完整堆温/输出曲线面板，App.tsx 中未被引用（已被 MetricCard popover 替代）。AGENTS.md 已记录 RunDetailsPanel 替代关系，删不删看后续整理。
- `src/utils/download.ts` -- `downloadTextFile` 函数未被使用（Tauri 用 `invoke` 替代）。

---

## 4. 模拟逻辑审查

### 4.1 Condensator 热量计算行为变更（高优先级）

**文件**: `src/sim/runtime.ts:243`

```typescript
const accepted = Math.min(value, this.getMaxHeat() - value);
```

AGENTS.md 已记录此处为刻意行为变更，用于处理溢出拒收热量。当前逻辑用 `value` 而非 `this.currentHeat` 计算冷凝容量上限，意味着 condensator 接受热量的上限取决于当次传入值而非当前已用容量。这一行为与原版 IC2 不同，AGENTS.md 将其列为"应单独做 golden case 验证"的风险点。建议在确认 GTNH 意图后补对应测试。如果验证结果表明应为标准行为，则需改为 `Math.min(value, this.getMaxHeat() - this.currentHeat)`。

### 4.2 GTNH MOX 公式中的魔法数字（低优先级）

**文件**: `src/sim/runtime.ts:290`

```typescript
energy *= 1 + (1.5 * this.parent.currentHeat) / this.parent.maxHeat;
```

GTNH MOX 系数 1.5 是硬编码的。建议提取为命名常量并注明引用来源（GTNH wiki / MCTBL 参考）。

### 4.3 测试覆盖缺口（中优先级）

当前 13 个测试覆盖基础行为，但以下场景缺失：

- **codec**: 无效 code 解码、旧版 hex code 解码、revision 3/2/1 兼容性。
- **燃料极端值**: 激发铀（64 Hu/s 基础值）是否在内部分配热量时溢出。
- **增殖棒**: `heatBonusStep` 与堆温的边界行为（堆温=0/2999/3000/6000）。
- **Worker 协议**: 消息格式、cancel 中断、并发请求处理。
- **自动替换**: `automationThreshold` 与 `reactorPause` 组合行为。

### 4.4 `pushSnapshot` 中重复调用 `buildFuelRodStats` / `buildBreederStats`（中优先级）

**文件**: `src/sim/stepper.ts`

`buildSnapshot()` 内部已经调用 `this.buildFuelRodStats()` 和 `this.buildBreederStats()` 来填充快照的 `fuelRodStats` / `breederStats` 字段（遍历 Map 生成新数组）。但在 `finalize()` 里，`summary` 对象又独立调用了这两个方法，导致同一份 Map 在 `finalize()` 中被迭代两次——一次给 `summary.fuelRodStats`，一次给 `buildSnapshot()` 产生的最终快照。建议 `summary` 直接复用 `buildSnapshot()` 的返回结果，省掉一轮 O(n) 的 Map 遍历。

### 4.5 `fuelRodKey` 方法命名不一致（低优先级）

**文件**: `src/sim/stepper.ts`

`fuelRodKey(component)` 生成 `row:col` 标识符，但它被同时用于 `fuelRodStats` 和 `breederStats` 两个 Map 的键。breeder（增殖棒）不是 fuel rod，方法名有误导性。建议重命名为 `cellKey` 或直接内联字符串模板。

### 4.6 `runtime.ts` 文件头部 UTF-8 BOM 残留（低优先级）

**文件**: `src/sim/runtime.ts`

文件以 UTF-8 BOM (`0xEF 0xBB 0xBF`) 开头。TypeScript 编译器能容忍，但某些工具链（文本 diff、部分 linter）可能将其视为非空首行。保存为 UTF-8 without BOM 即可修复。

---

## 5. UI / 样式

### 5.1 动画性能（低优先级）

**文件**: `src/styles.css:485`

`.flow-triangle` 的 glow 效果使用 `box-shadow`，高频模拟时 20+ 个同时运行动画会触发布局重绘。建议改用 `filter: drop-shadow()` 或伪元素 `opacity` 动画减少 paint 开销。

### 5.2 单一 CSS 文件（低优先级）

`styles.css` 共 1028 行。当前规模可接受，但如果持续增长可考虑拆分为 CSS Modules（Vite 原生支持，无需额外配置）。

---

## 6. 体验优化建议

- **键盘快捷键**: 空格键放置/删除元件、数字键 1-4 切换调色板分类、Enter 启动模拟、Esc 停止。
- **撤销/重做**: 放置元件不可撤销，建议维护一个 grid 历史栈（最多 50 步）。
- **移动端**: 已有响应式断点，但 6x9 网格在 820px 下仍显局促，可考虑缩小 `--reactor-gap` 和字体。

---

## 7. 优先级汇总

| 优先级 | 类别 | 条目 | 影响 |
|--------|------|------|------|
| **高** | 行为变更 | condensator `adjustCurrentHeat` 用 `value` 而非 `currentHeat`，待 golden case 验证 | 模拟结果需与 GTNH 实物交叉确认 |
| **高** | 性能 | MetricCard popover 用全量 series 渲染 AreaChart（改一行即可修复） | hover 时明显延迟 |
| **高** | 可维护性 | 调色板 ID 列表分三处硬编码（给 ComponentDefinition 加 category 字段） | 新增元件易遗漏 |
| **中** | 性能 | `appendSeriesSnapshot` 每次 push + slice 造成 GC 压力 | XuJin 模式 UI 可能掉帧 |
| **中** | 性能 | ReactorGrid marker / state map 每 tick 重建（优先考虑 useDeferredValue / 依赖优化） | 中速模拟 CPU 占用偏高 |
| **中** | 性能 | `finalize()` 中 buildFuelRodStats / buildBreederStats 重复调用 | 每轮 Map 迭代 O(n) |
| **中** | 测试 | 模拟/Worker/codec 覆盖不足（旧 hex code、增殖边界、自动替换等） | 重构风险 |
| **低** | 代码清理 | `fuelRodKey` 命名误导（breeder 共用）、runtime.ts BOM 残留 | 代码库噪音 |
| **低** | 代码清理 | ChartsPanel、download.ts 未使用 | 代码库噪音 |