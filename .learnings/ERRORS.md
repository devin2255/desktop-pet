# Errors

Command failures and integration errors.

---

## [ERR-20260813-002] electron-builder runtime download timeout

**Logged**: 2026-08-13T11:03:00+08:00
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
Customer EXE build timed out while electron-builder downloaded Electron 43.2.0.

### Error
`Timeout awaiting 'request' for 600000ms` after the download progress reached 100%.

### Context
- Petpack validation passed before packaging.
- A cache entry was created under the local Electron cache.

### Suggested Fix
Retry using the completed local cache; if it recurs, configure a reachable Electron mirror or pre-populate the runtime cache.

### Metadata
- Reproducible: unknown
- Related Files: scripts/build-customer.js, package.json

---

## [ERR-20260813-001] npm build:customer argument forwarding

**Logged**: 2026-08-13T00:00:00+08:00
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
The installed npm version consumed `--pet` and `--delivery-id` instead of forwarding them to the customer builder.

### Error
`build-customer.js` received positional values and failed with `未知参数：pets/packages/brother-judge.petpack`.

### Context
- Attempted the documented `npm run build:customer -- --pet ...` command.
- The `.petpack` validation itself passed.

### Suggested Fix
Use `node scripts/build-customer.js --pet ...` as the reliable local workaround, and later update the documented npm invocation for current npm versions.

### Metadata
- Reproducible: yes
- Related Files: scripts/build-customer.js, package.json, AGENTS.md

---
