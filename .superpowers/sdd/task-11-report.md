# Task 11 Report — laopo customer EXE build + verification

**Branch:** feat/laopo-pet  
**Status:** complete  
**Commit:** `ef6d6f9` — fix: include startup-greeting in customer EXE packaging

## Summary

Gates passed, customer EXE built, startup failure from missing `startup-greeting.js` fixed, portable EXE smoke-verified via CDP, and verification report written. EXE itself is gitignored under `dist/`.

## Gates

```
npm run test:regression  → PASS
npm test                 → PASS (js + python + validate:demo laopo)
```

## Build

```
npm run build:laopo
```

**EXE:** `dist/customers/laopo/老婆桌面宠物-0.1.0.exe`  
**SHA256:** `d2edc03cbf4af0b57f87d2301b67ce8a19d8354a943cb5019355940a7217edb8`  
**build-report:** `dist/customers/laopo/build-report.json`

## Fix applied during verification

First EXE build failed at runtime with Chromium **Error** dialog:

`Cannot find module './startup-greeting'`

`scripts/build-customer.js` electron-builder `files` whitelist omitted `src/startup-greeting.js` (present in root `package.json` `build.files` but not mirrored for customer builds). Also observed `extraMetadata` rewriting root `package.json` to a stripped 0.1.0 stub; builder now snapshots/restores `package.json` around the electron-builder spawn.

## Runtime verification

Launched portable EXE with `--remote-debugging-port=9334`.

| Check | Result |
|---|---|
| App starts, pet appears | PASS — window title 桌宠播放器; userData `Desktop Pet Deliveries/laopo` created |
| `startupGreeting` in live manifest | PASS — `老公，我来啦~` |
| Animations / roaming | PASS — CDP sampled `sit`/`encourage`/`serve-tea`; live bubble `老公喝茶`; frame sources change |
| CDP interaction roles ×50 | PASS — drag/climb/perch/hang/fall/impact/recover; 0 resize/displace/scale |
| Menu config present | PASS — call-hubby / kowtow / talent-show; no perch-cross-phone |
| Process exit | PARTIAL — force-kill clean; tray Quit not UI-automated |
| 50 real clicks / perch / audio / hit-test | MANUAL-PENDING — see verification JSON |

Full detail: `outputs/laopo-verification-report.json`

## Artifacts (local, not committed)

- `dist/customers/laopo/老婆桌面宠物-0.1.0.exe` (gitignored)
- `dist/customers/laopo/build-report.json` (under gitignored `dist/`)
- `outputs/laopo-cdp-runtime.json`
- `outputs/laopo-live-probe.json`

## Known gaps

- No code signing
- Tray quit / transparent hit-testing / 50 physical clicks / perched idle actions need human eyes/ears
