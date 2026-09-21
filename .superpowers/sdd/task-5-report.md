# Task 5 Report: 兄弟 Duo 资源（动作条 + clips + pet.json）

## Status

**DONE**

## TDD Evidence

1. **RED** — 先修改 `scripts/test-brother-duo-petpack.js`，新增断言：
   - `duo.slack.jumpAction === 'slack-jump'`
   - `duo.slack.carryAction === 'slack-carry'`
   - `duo.slack.clips.length >= 3`
   - 右键菜单包含 `{ id: 'duo-slack', label: '摸会儿鱼' }`
   - `slack-jump` 不循环，`slack-carry` 循环，且两者各 4 帧。

2. **RED Run**

```text
$ node scripts/test-brother-duo-petpack.js
AssertionError [ERR_ASSERTION]: folded menu missing 摸会儿鱼
```

3. **GREEN** — 增加资源、扩展写入脚本、重新生成 `pet.json` 并打包。

4. **GREEN Run**

```text
$ node pets/work/brother-duo/_write_pet_json.js && python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-duo pets/packages/brother-duo.petpack && node scripts/test-brother-duo-petpack.js
wrote D:\Vibe_Coding\desktop-pet\pets\library\brother-duo\pet.json
pets\packages\brother-duo.petpack
test-brother-duo-petpack: ok
```

## Implementation

- Created root action frames:
  - `pets/library/brother-duo/animations/slack-jump/01.png` ... `04.png`
  - `pets/library/brother-duo/animations/slack-carry/01.png` ... `04.png`
- Created muted abstract vertical-feed clips:
  - `pets/library/brother-duo/video/slack/01.webm`
  - `pets/library/brother-duo/video/slack/02.webm`
  - `pets/library/brother-duo/video/slack/03.webm`
- Updated `pets/work/brother-duo/_write_pet_json.js`:
  - root `animations.slack-jump`
  - root `animations.slack-carry`
  - `duo.slack`
  - folded menu item `duo-slack` / `摸会儿鱼`
- Rebuilt:
  - `pets/library/brother-duo/pet.json`
  - `pets/packages/brother-duo.petpack`

## Asset Verification

```text
slack-jump 4
all frames: (480, 480) RGBA, non-empty alpha
slack-carry 4
all frames: (480, 480) RGBA, non-empty alpha
video/slack/01.webm [{'codec_name': 'vp8', 'codec_type': 'video'}]
video/slack/02.webm [{'codec_name': 'vp8', 'codec_type': 'video'}]
video/slack/03.webm [{'codec_name': 'vp8', 'codec_type': 'video'}]
```

## Commits

None（按任务要求未提交）。

## Concerns

新增 PNG 使用现有 idle 帧保守合成，能保持服装颜色和左右身份，但不是重新绘制的高质量动作条；视觉丰富度可后续继续精修。

## Follow-up Fix: 2026-09-15 09:48

- Fixed `duo.slack.leaveLabel` from `接着干` to spec value `收工了` in `pets/work/brother-duo/_write_pet_json.js`, then regenerated `pets/library/brother-duo/pet.json`.
- Re-exported `pets/library/brother-duo/animations/slack-carry/01.png` ... `04.png` without the fake phone/device rectangle. Frames remain 480x480 RGBA with left judge, right floral, feet on baseline, and an empty transparent center gap for the CSS overlay.
- Rebuilt `pets/packages/brother-duo.petpack`.

```text
$ node pets/work/brother-duo/_write_pet_json.js
wrote D:\Vibe_Coding\desktop-pet\pets\library\brother-duo\pet.json

$ python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/brother-duo pets/packages/brother-duo.petpack
pets\packages\brother-duo.petpack

$ node scripts/test-brother-duo-petpack.js
test-brother-duo-petpack: ok

slack-carry center gap check:
01.png center-gap-alpha-max 0
02.png center-gap-alpha-max 0
03.png center-gap-alpha-max 0
04.png center-gap-alpha-max 0
```
