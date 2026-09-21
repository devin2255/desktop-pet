# Task 8 Report: pet.json / preview / petpack

**Status:** DONE  
**Commits:** none

## Delivered

- `pets/library/brother-duo/pet.json`
- `pets/library/brother-duo/preview.png` (folded idle/01)
- `pets/packages/brother-duo.petpack`
- `scripts/test-brother-duo-petpack.js`
- `package.json` `test:js` + `build:brother-duo`

Judge audio copied except unreferenced `15-mg-boss.mp3` / `18-cheer-ok.mp3`. Floral window roles map to sit/walk/reaction/idle/drag.

## Verification

```
python ... validate pets/library/brother-duo  → valid: brother-duo
python ... build ... brother-duo.petpack
python ... validate pets/packages/brother-duo.petpack → valid
node scripts/test-brother-duo-petpack.js → test-brother-duo-petpack: ok
```
