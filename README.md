# GTNH Reactor Planner (Tauri + React)

GTNH / IC2 Experimental Reactor Planner modern rewrite.

This project keeps the simulation semantics compatible with the original planner while providing a modern desktop UI, offline textures, and smoother dynamic visualization.

## Tech Stack

- Tauri 2
- React 18 + TypeScript
- Vite
- Web Worker (simulation runtime)
- Recharts (metric charts)

## Current Features

- 6x9 reactor grid editor with GTNH components
- Reactor code import/export
- Three run modes: `单步` / `徐进` / `模拟`
- Heap temperature, EU/t, HU/t metric cards and trend charts
- Event stream, CSV export, design save/load
- Offline 4x textures with 1:1 display mode

## Requirements

- Node.js `20.19+` or `22.12+`
- Rust + Cargo (for Tauri)

## Local Development

```bash
npm install
npm run test
npm run build
npm run tauri:dev
```

## Project Structure

- `src/`: UI and frontend orchestration
- `src/worker/`: worker-side simulation scheduling
- `src/sim/`: TypeScript simulation core
- `src-tauri/`: desktop shell (Rust)
- `tests/`: Vitest tests
- `public/assets/`: offline textures and static assets

## References

- Legacy binary baseline: `Ic2ExpReactorPlanner.jar`
- Upstream project: <https://github.com/MauveCloud/Ic2ExpReactorPlanner>
- GTNH remake reference: <https://github.com/MCTBL/GTNH_Reactor_Simulator>

## License

GPL-2.0-or-later (see `LICENSE`).
