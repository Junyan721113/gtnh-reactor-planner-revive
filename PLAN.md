# Ic2ExpReactorPlanner 现代化计划

## 摘要
采用 `Tauri 2 + React + TypeScript + Vite` 重建 UI，保留原 JAR 作为数值兼容 oracle。选择理由：Tauri 使用系统 WebView，包体和内存压力小于 Electron；React/TS 更适合做热图、曲线、回放面板；PyQt/PySide 更适合传统桌面表单，但对这个项目的动态可视化和现有 Java 逻辑迁移收益较低。

## 框架取舍
- `Tauri + React`：本项目首选。UI 表现力强，桌面分发轻量，Rust 后端只负责文件/系统能力，模拟核心放在 TypeScript Web Worker。
- `Electron + React`：前端能力同样强，且集成 Node/Java 方便，但 Electron 官方说明会内置 Chromium 和 Node.js，包体与内存开销更高。
- `JavaFX`：最容易复用 Java 逻辑，兼容风险最低，但动态可视化、交互设计和前端生态不如 React。
- `PyQt/PySide`：适合 Python 桌面工具；PyQt 有 GPL/商业授权约束，且要么重写 Java 核心，要么跨语言桥接，复杂度不划算。

## 实施方案
- 新建 Tauri 项目，不覆盖现有 `Ic2ExpReactorPlanner.jar`；原 JAR 作为回归测试基准和资源来源。
- 从上游 `MauveCloud/Ic2ExpReactorPlanner` 的 `v2.4.2` 源码恢复逻辑，并与本地 JAR 的组件、贴图、Bundle、GTNH 条目做差异核对。
- 将模拟核心迁移为纯 TypeScript 数据层：`ComponentDefinition`、`ReactorDesign`、`SimulationConfig`、`TickSnapshot`、`SimulationSummary`。
- 模拟运行放入 Web Worker，主线程只接收 tick 快照、事件和 summary，避免 UI 卡顿。
- React UI 第一版包含：6x9 反应堆网格、组件 palette、代码导入/导出、运行/暂停/重置/单步、EU/HU 与堆温统计卡片。
- 动态可视化第一版只做高价值部分：组件热量热图、堆温曲线、EU/HU 输出曲线、组件损坏/耗尽进度、关键告警高亮。
- Tauri 后端只实现桌面能力：打开/保存设计、导出 CSV、导入贴图包、持久化用户设置。

## 测试计划
- 用原 JAR/恢复的 Java 源码生成 golden cases，覆盖空堆、普通 EU 堆、流体堆、脉冲堆、自动化替换、GTNH 特有燃料和空间冷却单元。
- 对比新 TS 内核与旧 Java 的逐 tick 数据：堆温、EU/HU、组件热量、损坏、首次断裂、首次燃料耗尽、爆炸时间。
- 对导入/导出 reactor code 做双向兼容测试，包括旧格式和当前格式。
- UI 测试覆盖拖放组件、改配置后重新模拟、暂停/继续、曲线随 tick 更新、CSV 导出。
- 性能目标：大模拟在 Worker 中运行，UI 动画维持流畅；曲线数据做采样/窗口化，避免长期模拟拖垮渲染。

## 环境与假设
- 已选择：`Tauri + React`、逐 tick 兼容、热图和曲线。
- 当前 Rust/Cargo 已安装；当前 Node 是 `18.15.0`，但 Vite 当前文档要求 Node `20.19+` 或 `22.12+`，执行前需要升级 Node。
- 使用 `npm` 优先；当前 `pnpm` 触发 Corepack 权限问题，不作为首选包管理器。
- 参考依据：[Tauri 文档](https://v2.tauri.app/start/)、[Tauri 架构](https://v2.tauri.app/concept/architecture/)、[Vite Node 要求](https://vite.dev/guide/)、[Electron 文档](https://www.electronjs.org/docs/latest/)、[PyQt 授权 FAQ](https://www.riverbankcomputing.com/commercial/license-faq)。
