# Windows Topmost Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the complete desktop-pet window above newly opened normal application windows while preserving the user's always-on-top switch.

**Architecture:** Add a focused CommonJS topmost guard and inject its `ensure()` function into the interaction controller. Use Windows `screen-saver` level plus `moveTop()` at lifecycle boundaries, without a polling watchdog.

**Tech Stack:** Electron 43.2.0, CommonJS, Node `assert`, Windows HWND style verification.

## Global Constraints

- The complete pet window, including hanging or seated legs, must remain above normal application windows.
- The guard must not focus the pet window.
- The tray “始终置顶” switch must remain functional.
- No periodic z-order timer may be added.
- The customer package must include every newly required source module.

---

### Task 1: Add and Integrate the Topmost Guard

**Files:**
- Create: `src/topmost-guard.js`
- Create: `scripts/test-topmost-guard.js`
- Modify: `src/main-v3.js`
- Modify: `src/interaction-controller.js`
- Modify: `scripts/test-interaction-controller.js`
- Modify: `package.json`
- Modify: `scripts/build-customer.js`

**Interfaces:**
- Produces: `createTopmostGuard({ getWindow, initiallyEnabled })`.
- Produces guard methods: `ensure()`, `setEnabled(value)`, `isEnabled()`.
- Consumes controller dependency: `ensureOnTop()`.

- [ ] Write failing tests for screen-saver level, moveTop, disabling,
  re-enabling, destroyed windows, controller state transitions, and package
  inclusion.
- [ ] Run focused tests and verify they fail because the guard does not exist.
- [ ] Implement the minimal guard and lifecycle integration.
- [ ] Run focused tests and full `npm test`.
- [ ] Commit the source, tests, spec, and plan.

### Task 2: Rebuild and Deliver

**Files:**
- Replace: `outputs/son-pet-0.4.0-topmost-fix.exe`
- Replace: `outputs/build-report.json`
- Replace: `outputs/verification-report.json`
- Replace: `outputs/verification-results.md`

- [ ] Build and validate `son-pet.petpack`.
- [ ] Build the customer EXE using the cached Electron 43.2.0 distribution.
- [ ] Launch the new build after avoiding the currently running old
  single-instance process.
- [ ] Inspect the titled `桌宠播放器` HWND and require `WS_EX_TOPMOST=true`.
- [ ] Run full tests, report/hash checks, and copy final artifacts.

