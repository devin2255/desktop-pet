# Task 8 Report — 编写 pet.json、打包并包级测试

**Status:** PASS  
**Date:** 2026-08-04  
**Package id:** `xiaomei-xiaotian`  
**Commit:** none（按指示不提交）

## Summary

完成「小美&小甜」清单、预览图、`.petpack` 打包与包级回归测试。`petpack_tool validate`（库目录 + 包）与 `node scripts/test-bestie-petpack.js` 全部通过。

## Deliverables

| 产物 | 路径 |
|---|---|
| 清单 | `pets/library/xiaomei-xiaotian/pet.json` |
| 预览 | `pets/library/xiaomei-xiaotian/preview.png`（自 `idle/01.png`） |
| 资源包 | `pets/packages/xiaomei-xiaotian.petpack` |
| 包级测试 | `scripts/test-bestie-petpack.js` |
| npm | `package.json`：`test:js` 接入测试；新增 `build:bestie` |

## Manifest 要点

- id/name/personality/startupGreeting/speechGender 按规格
- `normalizationMetric`: `alpha-area-v1`（bbox-span 跨动作漂移约 1.79，alpha-area 约 1.017）
- 动画：标准五动作 + drag + cuddle/selfie/whisper/cheer + relax-* 共 16 套
- `behavior.random`：walk32 / sit24 / reaction16 / sleep12 / cuddle10 / whisper6（不含 selfie/cheer/relax）
- `interactionActions.drag.action` = `drag`；窗口 climb/perch/hang/fall/impact/recover 映射到既有动画
- `sequences.relax` 7 阶段；`relax-models`：`waitForClick` + `messages: ["我要这个","我要这个"]` + `holdLastFrame: true`
- 菜单「去放松」：`sequence: "relax"`（无 `action`）

## Validate / Test

```text
python ... validate pets/library/xiaomei-xiaotian
→ valid: xiaomei-xiaotian (小美&小甜)

python ... build pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack
→ pets\packages\xiaomei-xiaotian.petpack

python ... validate pets/packages/xiaomei-xiaotian.petpack
→ valid: xiaomei-xiaotian (小美&小甜)

node scripts/test-bestie-petpack.js
→ test-bestie-petpack: ok
```

## Commit

- **No commit.**

## Concerns

1. 窗口攀爬类动作未单独绘制，仅映射 walk/sit/reaction/idle，真人姿态可能略违和。
2. 客户 EXE（`npm run build:bestie` / Task 9+）与实机启动验证尚未做。
3. 本报告覆盖原 Task 8（laopo 组装）报告文件名；laopo 历史内容以 git / 其它文档为准。
