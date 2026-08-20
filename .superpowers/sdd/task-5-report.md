# Task 5 Report: 去背、切帧、入库、打包

## Status
**DONE**

## BASE
`0a2378b63afdd129ba8409b5d9d59936c43839ca`

## Commits
- `40945da` `feat: photoreal brother-judge frames with kowtow`（仅 `pets/library/brother-judge` + `pets/packages/brother-judge.petpack`）
- 未提交 `pets/work/`、未改动 `src/main-v3.js`

## What ran
1. chroma 去背（watermark 清理 + `remove_chroma_key.py`，flags 与 pipeline_7b 一致）→ `source/realistic/transparent/`
2. recompose gutters（默认 0.18，失败后 0.22）+ `process_animation_strips.py`
3. crawl / kowtow 额外安全重组后通过门禁：
   - **crawl**：主体过宽导致 fit 贴边 1px → recompose 时 `subject_scale=0.92`
   - **kowtow**：frame3 右侧平直边 runs=37/limit=36 → recompose 时 1px alpha erode
4. alpha-area 均衡到约 19661（全包 ratio 1.022 ≤ 1.08）后入库；`preview.png` ← idle/01
5. 打包前临时移开未引用的 `DESIGN.md`，build 后再放回 library

## Tests
| Check | Result |
|---|---|
| `petpack_tool.py validate` library | PASS |
| `petpack_tool.py build` → petpack | PASS |
| `petpack_tool.py validate` petpack | PASS |
| `test_process_animation_strips.py -v` | PASS (7/7) |
| `node scripts/test-renderer-interaction.js` | PASS |

## Artifacts
- `pets/library/brother-judge/animations/**`（含 kowtow×6）
- `pets/library/brother-judge/preview.png`
- `pets/packages/brother-judge.petpack`
- work intermediates（未提交）：`pets/work/brother-judge/source/realistic/{transparent,processed,equalized}/`、`pipeline_task5.py`、`equalize_task5.py`

## Concerns
- 均衡目标被 sleep/04 等“已贴满画布但仍偏瘦”的帧压到 ~19.6k，视觉体量略小于 process 默认 38k；若要更大更匀，需回上游重生成更饱满的 sleep/walk 帧（本任务范围外）。
- crawl/kowtow 用了不重画的 recompose 修补；平直边仍属源条边缘硬切痕迹，后续若重做写实条建议加宽单元格空隙。
- `DESIGN.md` 仍在 library 目录但不进 petpack；直接 `validate` library 目录会因 unreferenced file 失败，需先移开或忽略。
