# GTNH 反应堆规划器重制版

这是一个面向 GT New Horizons 的 IC2 Experimental 反应堆规划器现代化重制项目。

项目目标是在尽量保留旧版 `Ic2ExpReactorPlanner.jar` 模拟语义的基础上，提供更现代的桌面 UI、GTNH 元件清单、动态热流可视化、状态曲线和事件流。

<img width="1616" height="939" alt="}}WCL(Y$C)_O6{313LM${83" src="https://github.com/user-attachments/assets/37a0713d-62b9-4237-b2e0-a7550ef50023" />

## 技术栈

- Tauri 2
- React 18 + TypeScript
- Vite
- Web Worker 模拟运行时
- Recharts 状态曲线

## 当前功能

- 6x9 反应堆网格编辑器
- GTNH 目标元件清单，包括 IC2 基础元件、GregTech 燃料、GoodGenerator 高密度/激发燃料等
- reactor code 导入/导出，当前导出 revision 4
- 三种运行方式：`单步`、`徐进`、`模拟`
- 堆温、EU/t、HU/t 状态卡和趋势曲线
- 元件间热量通量箭头、堆温释放/吸收圆点、元件热量条
- 信息栏 hover 说明，覆盖控制按钮、组件库、反应堆格子、配置和事件流
- 事件流、CSV 导出、设计保存/读取相关桌面能力

## 环境要求

- Node.js `20.19+` 或 `22.12+`
- Rust + Cargo，用于 Tauri
- 优先使用 `npm`

## 本地开发

```bash
npm install
npx tsc --noEmit
npm run test -- --reporter=verbose
npm run build
npm run tauri:dev
```

## 项目结构

- `src/`：React UI、前端编排和共享代码
- `src/domain/`：元件定义、reactor code、默认配置和类型
- `src/sim/`：TypeScript 模拟核心
- `src/worker/`：Web Worker 调度和消息协议
- `src/state/`：避免根组件重渲染的轻量外部状态
- `src/ui/`：界面组件
- `src-tauri/`：Tauri 桌面壳
- `tests/`：Vitest 测试
- `public/assets/`：离线贴图和静态资源

## 开发约束

- 本项目只做 GTNH 整合包中实际存在或用于 GTNH 反应堆规划的元件。
- 不要重新引入 Coaxium/Cesium 等非目标元件。
- 不要在仓库中嵌入外部上游仓库。
- 当前组件库图标视觉按现有设计保留，不再推进“离线 4x 贴图 + 1:1 显示”方案。
- UI 性能修复优先检查根组件状态、hover 事件和 Recharts 渲染路径。
- 项目文档尽量使用中文；代码标识、命令和英文元件名可以保留英文。

## 参考资料

- 旧版二进制基准：`Ic2ExpReactorPlanner.jar`
- 上游旧项目：[MauveCloud/Ic2ExpReactorPlanner](https://github.com/MauveCloud/Ic2ExpReactorPlanner)
- GTNH 重制参考：[MCTBL/GTNH_Reactor_Simulator](https://github.com/MCTBL/GTNH_Reactor_Simulator)
- GTNH Wiki：[Nuclear Reactors](https://wiki.gtnewhorizons.com/wiki/Nuclear_Reactors)

## 许可证

GPL-2.0-or-later，见 [LICENSE](LICENSE)。
