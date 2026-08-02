# Task 10 Report — 客户 EXE 构建与实机验证（Medusa）

**Branch:** feat/medusa-pet  
**Status:** complete  

## Summary

发布门禁全部 PASS，`npm run build:medusa` 产出便携版 EXE，CDP 实机探针通过（启动、独立 userData、漫游气泡、菜单配置、交互角色 ×50 无尺度/位移）。未做数字签名与商店上架。

## Gates

```
node scripts/test-renderer-interaction.js                          → PASS
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v → PASS (7)
npm test                                                           → PASS
  validate:demo → valid: medusa (美杜莎)
```

## Build

```
npm run build:medusa
```

| Artifact | Path |
|---|---|
| EXE | `dist/customers/medusa/美杜莎桌面宠物-0.1.0.exe` |
| EXE SHA256 | `71b6d5c4561584e58f55bee802eb322c771094b6ac725b1af2354d2da6c0b9c9` |
| build-report | `dist/customers/medusa/build-report.json` |
| build-report copy | `outputs/medusa-build-report.json` |
| petpack SHA256 | `aa1379dc910fbbaaa6823cf7d4fde88d5bd9376e562cb7809e0f7a01e4ddf7f9` |

## Runtime verification

Launched portable EXE with `--remote-debugging-port=9334`.

| Check | Result |
|---|---|
| App starts, pet appears | PASS — window title 桌宠播放器; userData `Desktop Pet Deliveries/medusa` |
| `startupGreeting` in live manifest | PASS — `本女王来了。` |
| `speechGender` | PASS — `female` |
| Animations / roaming | PASS — CDP sampled idle/reaction/sit/inspect; live bubble `看你表现`; frame sources change |
| CDP interaction roles ×50 | PASS — drag/climb/perch/hang/fall/impact/recover; 0 resize/displace/scale |
| Menu config present | PASS — cold-smile / heaven-python / kneel-before-me; no call-hubby |
| Transparent body bg | PASS — `rgba(0,0,0,0)` |
| Process exit | PARTIAL — force-kill clean; tray Quit not UI-automated |
| 50 real clicks / perch UI / audio / hit-test | MANUAL-PENDING — see verification JSON |

Full detail: `outputs/medusa-verification-report.json`

## Artifacts

- `dist/customers/medusa/美杜莎桌面宠物-0.1.0.exe` (gitignored)
- `dist/customers/medusa/build-report.json` (under gitignored `dist/`)
- `outputs/medusa-build-report.json`
- `outputs/medusa-cdp-runtime.json`
- `outputs/medusa-live-probe.json`
- `outputs/medusa-verification-report.json`

## Known gaps

- No code signing
- No store listing
- Tray quit / transparent hit-testing / 50 physical clicks / perched idle / heaven-python VFX need human eyes/ears
