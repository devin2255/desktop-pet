# Task 9 Report — build laopo.petpack + regression tests + demo rewire

**Status:** PASS  
**Date:** 2026-08-02  

## Summary

Built and validated `pets/packages/laopo.petpack`, added `scripts/test-laopo-petpack.js`, rewired demo baseline from boss → laopo in `package.json` / security fixture / `.gitignore`, deleted shipped `boss.petpack` and `test-boss-petpack.js`. `npm test` PASS.

## Steps completed

1. **Build & validate**
   - `petpack_tool.py build pets/library/laopo pets/packages/laopo.petpack`
   - `petpack_tool.py validate` → `valid: laopo (老婆)`

2. **Regression test** `scripts/test-laopo-petpack.js`
   - Asserts id/name/`speechGender`/`startupGreeting`
   - Menu: `call-hubby` / `kowtow` / `talent-show` (+ audio paths)
   - Absent: `call-dad` / `self-slap` / `perch-cross-phone`
   - Perched: hair-flip / blow-kiss / look
   - Random: tea + affection lines; no sleep
   - Required animations include walk, talent-show, sweet trio

3. **package.json**
   - `validate:demo` → `laopo.petpack`
   - `build:boss` → `build:laopo`
   - `test:js` → `test-laopo-petpack.js`
   - `build.files` petpack → `laopo.petpack`
   - Icon/tray paths still `assets/generated/boss.*` (Task 10)

4. **Security fixture** → `laopo.petpack`

5. **Removed** `pets/packages/boss.petpack`, `scripts/test-boss-petpack.js`

6. **`.gitignore`** exception: `boss.petpack` → `laopo.petpack` (required so package is trackable)

## Tests

```
node scripts/test-laopo-petpack.js  → PASS
npm test                            → PASS
  test:js (incl. laopo + security)  → PASS
  test:python (14)                  → OK
  validate:demo                     → valid: laopo (老婆)
```

## Concerns

- Tray/icon still point at boss assets until Task 10 generates laopo icons.
- Docs (`AGENTS.md`, `README.md`, `ASSETS_LICENSE.md`) still mention boss demo; out of Task 9 scope / Task 10–11 may update.
- `scripts/build-customer.js` help example still shows boss path (cosmetic).
