# GitHub 迁移指南

## 1. 在 GitHub 创建空仓库

- 建议仓库名：`gtnh-reactor-planner`
- 不要勾选 README / .gitignore / License（本地已准备）

## 2. 本地初始化与首推

在项目根目录执行：

```bash
git add .
git commit -m "chore: initialize modern GTNH reactor planner repository"
git remote add origin https://github.com/Junyan721113/<your-repo>.git
git push -u origin main
```

## 3. 迁移后检查项

- GitHub Actions `CI` 工作流是否通过
- `node_modules/`、`dist/`、`src-tauri/target/` 是否未被提交
- README、LICENSE、工作流文件是否可见

## 4. 可选强化

- 开启 Branch protection（`main`）
- 要求 PR 必须通过 `CI`
- 启用 Issue / PR 模板
