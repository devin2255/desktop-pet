# Screen-Top Snap and Fall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pet's visible alpha top reach the physical display top and trigger falling on release when no valid window target exists.

**Architecture:** Extend the existing interaction controller with drag-scoped top-snap state. Keep geometry in DIP, derive the snapped window y-coordinate from the renderer-reported visible top inset, preserve window-target precedence, and clear snap state at every interaction boundary.

**Tech Stack:** Electron 43.2.0, CommonJS, Node `assert`, existing deterministic controller harness, PowerShell customer build.

## Global Constraints

- Screen-top activation threshold is exactly 6 DIP.
- A valid normal application window under the pointer wins over screen-top falling.
- Visible body pixels may not be dragged above the physical display top.
- Only transparent canvas may extend outside display bounds.
- Window size, action scale, anchor, and baseline must remain unchanged.
- Small, medium, and large sizes must share the same visible-pixel rule.

---

### Task 1: Reproduce and Fix Screen-Top Snap State

**Files:**
- Modify: `scripts/test-interaction-controller.js`
- Modify: `src/interaction-controller.js`

**Interfaces:**
- Consumes: `moveDrag(pointer)`, `endDrag(pointer)`, renderer-reported `visibleInsets`.
- Produces: drag-scoped `topSnap` state and exact visible-top placement.

- [ ] **Step 1: Write failing controller tests**

Add tests that start a drag below the screen top, move the pointer to y=0,
and prove ordinary delta would leave a gap. With top insets of 20, 60, and
100 DIP, assert:

```js
harness.controller.moveDrag({ x: 200, y: 0 });
assert.strictEqual(harness.bounds().y + topInset, harness.display.bounds.y);
```

Add release tests asserting no-window top snap enters `fall`, while a valid
window under the same pointer enters `perch`. Add a test that moving back to
y=7 clears the snap and releases normally.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node scripts/test-interaction-controller.js
```

Expected: FAIL because current `moveDrag` only clamps the ordinary drag
position and `endDrag` has no drag-scoped top-snap state.

- [ ] **Step 3: Implement minimal drag-scoped snap**

In `createInteractionController`, store a top-snap record only while dragging.
When `pointer.y - display.bounds.y <= visibleTopThreshold`, set:

```js
next.y = Math.round(display.bounds.y - visibleInsets.top);
topSnap = { displayId: String(display.id), displayTop: display.bounds.y };
```

Clear the record when the pointer leaves the band and at all interaction
boundaries. In `endDrag`, keep target discovery first, then fall when the
current drag is top-snapped or the fresh visible top is within the threshold.

- [ ] **Step 4: Run focused and full suites**

Run:

```powershell
node scripts/test-interaction-controller.js
npm test
```

Expected: interaction controller checks pass; full suite passes with zero
failures.

- [ ] **Step 5: Commit**

```powershell
git add src/interaction-controller.js scripts/test-interaction-controller.js docs/superpowers/specs/2026-07-30-screen-top-snap-fall-design.md docs/superpowers/plans/2026-07-30-screen-top-snap-fall.md
git commit -m "fix: snap visible pet to screen top before fall"
```

### Task 2: Rebuild and Verify Customer Delivery

**Files:**
- Replace: `outputs/son-pet-0.4.0.exe`
- Replace: `outputs/build-report.json`
- Replace: `outputs/verification-report.json`
- Replace: `outputs/verification-results.md`

**Interfaces:**
- Consumes: committed controller fix and existing `son-pet.petpack`.
- Produces: final customer EXE and matching integrity reports.

- [ ] **Step 1: Rebuild the package and customer EXE**

Run:

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/son-pet pets/packages/son-pet.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/son-pet.petpack
npm run build:customer -- --pet pets/packages/son-pet.petpack --name "son-pet" --delivery-id son-pet
```

Expected: package validates and `dist/customers/son-pet/son-pet-0.4.0.exe`
is created.

- [ ] **Step 2: Audit and copy artifacts**

Verify the ASAR contains the fixed `src/interaction-controller.js`, correct
delivery identity, and no private source paths. Copy the rebuilt EXE,
`build-report.json`, petpack, and updated verification reports to the final
delivery output directory.

- [ ] **Step 3: Run final integrity checks**

Run:

```powershell
npm test
python skills/desktop-pet-maker/scripts/petpack_tool.py validate outputs/son-pet.petpack
git diff --check
```

Expected: all tests pass, package validates, report hashes match the rebuilt
files, and no tracked whitespace errors exist.

