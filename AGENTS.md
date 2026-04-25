# AGENTS.md

## 项目目标
- 将旧版 `Ic2ExpReactorPlanner.jar` 现代化为面向 GTNH 的反应堆规划器，技术栈为 Tauri 2、React 18、TypeScript、Vite 和 Web Worker 模拟运行时。
- 在可行范围内保留 IC2/GTNH 模拟行为，同时改进 UI 密度、动态热流可视化、reactor code 兼容和桌面保存/导出工作流。

## 工作区事实
- 仓库根目录：`D:\llh\Python\Ic2ExpReactorPlanner-RE`。
- 主应用代码在 `src/`，Tauri 壳在 `src-tauri/`，测试在 `tests/`，离线贴图在 `public/assets/`。
- `package.json` 要求 Node：`>=20.19.0 || >=22.12.0`。
- 包管理器优先使用 `npm`。
- 旧版兼容参考文件是 `Ic2ExpReactorPlanner.jar`。
- 不要在本项目里保留外部上游仓库。用户已经明确拒绝过 `vendor/Ic2ExpReactorPlanner-upstream-v2.4.2` 这种嵌入式仓库。

## 约束
- 与用户沟通使用中文，除非用户明确要求其他语言。
- 项目文档尽量使用中文；必要的代码标识、命令、文件名、英文元件名可以保留英文。
- 优先做小而集中的改动。修 UI 行为时不要顺手重构无关模块。
- 手工编辑文件时使用 `apply_patch`。
- 工作区可能是脏的。不要回退用户或前序 agent 的改动，除非用户明确要求。
- 不要重新引入 Coaxium/Cesium 反应堆元件，也不要恢复非 GTNH 目标的元件分类。
- 保留当前组件库图标视觉；不要再推进已经放弃的“离线 4x 贴图 + 1:1 显示”方案，除非用户明确要求。
- 用户只要求 UI 渲染或性能修复时，不要改动模拟规则。

## 已定决策
- 框架：Tauri 2 + React + TypeScript + Vite。
- 模拟运行在 `src/worker/simulationWorker.ts`，大模拟不能阻塞 UI 主线程。
- 速度状态、当前选中元件状态、信息栏状态应尽量脱离 `App` 根渲染路径。
- 信息栏使用 `src/state/infoBarStore.ts` 和 `src/ui/InfoBar.tsx`，避免 hover 时整页重渲染。
- `src/ui/MetricCard.tsx` 的完整 5000 点 Recharts 曲线只在 hover 时挂载，不要默认渲染。
- 元件数据以 GTNH 为目标，集中在 `src/domain/components.ts`。当前燃料族包括 IC2 基础燃料、Thorium、High Density Uranium/Plutonium、Excited Uranium/Plutonium、Naquadah、Naquadria、Tiberium、The Core、Glowstone、Lithium。
- reactor code 导出为 revision 4，支持 58 号以上元件 ID。
- 热流箭头显示的是元件间净热流，位于槽位边界；颜色映射按 GTNH 热量档位设计，不只是 `amount / tickFlux`。

## 当前状态
- 最近验证通过的命令：
- `npx tsc --noEmit`
- `npm run test -- --reporter=verbose`
- `npm run build`
- `npm run build` 仍会报告既有 Vite chunk size 警告，目前不视为失败。
- 当前工作区有较多未提交改动，涉及 UI、模拟可视化、codec、元件清单和信息栏。编辑前先看 `git status --short`。

## 下一步建议
- 如果“模拟完成”状态再次卡顿，优先检查根级 state 更新，尤其是 hover handler 和图表 props。
- 如果再次调整元件数据，应同时更新 `src/domain/components.ts`、`src/ui/Palette.tsx` 和 codec 测试。
- 如果新增当前范围之外的元件 ID，应同步更新 `src/domain/codecs.ts` 的组件编号上限，并补 reactor code 往返测试。
- 如果改热流渲染，同时检查 `src/sim/runtime.ts` 的热流记录和 `src/ui/ReactorGrid.tsx` 的 marker 渲染。
- 如果用户质疑 GTNH 燃料公式，先核对 GTNH wiki 或用户给出的 `MCTBL/GTNH_Reactor_Simulator`，再改公式。

## 风险
- 部分 GTNH 燃料参数是当前简化 IC2 风格模拟模型下的近似映射。
- Lithium 当前使用已有占位贴图，因为本地没有找到专用 Lithium reactor-cell 贴图。
- 用户 hover 状态卡并打开完整曲线时，大量 Recharts 数据仍有渲染成本。
- README 可能仍有旧贴图策略描述；不要只看 README 判断当前行为，应以代码为准。

## 关键文件
- `src/App.tsx`：顶层编排、worker 消息、布局和控制按钮。
- `src/domain/components.ts`：元件定义和组件库分组。
- `src/domain/codecs.ts`：reactor code 编码/解码和 revision 处理。
- `src/domain/types.ts`：共享模拟类型和元件类型。
- `src/sim/runtime.ts`：每 tick 的运行时行为和热流记录。
- `src/sim/stepper.ts`：逐步模拟、快照、事件和 summary。
- `src/worker/simulationWorker.ts`：worker 协议和调度。
- `src/state/selectionStore.ts`：当前选中元件外部 store。
- `src/state/infoBarStore.ts`：信息栏外部 store。
- `src/ui/ReactorGrid.tsx`：6x9 网格、hover 信息、热流 marker、热量条渲染。
- `src/ui/MetricCard.tsx`：状态卡、小曲线和 hover 完整曲线。
- `src/ui/Palette.tsx`：组件库 tab 和 hover 描述。
- `tests/codecs.test.ts`：reactor code 兼容测试。
- `tests/simulator.test.ts`：基础模拟行为测试。
