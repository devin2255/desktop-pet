# Task 4 报告：从 niulai 移除兄弟判官预装

**Status:** DONE  
**Branch:** feature/niulai  
**Commit:** chore: remove brother-judge fixtures from niulai branch delivery

## 实现

- 确认 `pets/library/brother-judge`、`brother-judge.petpack`、审计脚本已不在 git 跟踪（先前已移除）。
- 更新 `scripts/test-petpack-security.js`：改用 `niulai.petpack` 断言办公雷达与来电音频。
- 更新 `scripts/test-boss-watch-e2e.js`：从 `pets/library/niulai/pet.json` 加载 watch 词库。
- 更新 `docs/prompts/README.md` 与 `make-current-branch-pet.txt`：声明本分支主宠为牛来，checkout `feature/niulai`。
- 重建 `pets/packages/niulai.petpack` 以同步 `watch.menuLabel` 等字段。

## 测试

```text
npm run test:js — PASS
```

## 预装包确认

- `pets/packages/niulai.petpack` — 有
- `pets/packages/laopo.petpack` — 演示包保留
- `brother-judge` — 无
