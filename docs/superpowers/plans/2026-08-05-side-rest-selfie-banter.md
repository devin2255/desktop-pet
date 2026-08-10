# Side Rest and Selfie Banter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep pets attached to window side edges indefinitely and make the Xiaomei-Xiaotian selfie interaction reuse its current artwork for a three-line “争后排显脸小” exchange.

**Architecture:** The generic interaction controller will stop after attaching on a left or right edge instead of scheduling the old hold-and-climb transition. Character-specific humor remains declarative: the Xiaomei-Xiaotian manifest will point the selfie menu item at a sequence that repeats the existing `selfie` action and returns to `idle`.

**Tech Stack:** Electron, CommonJS JavaScript, Node `assert` test scripts, JSON `.petpack` manifests, Python petpack validation tooling.

## Global Constraints

- Do not hard-code pet names, dialogue, personality, or animation paths in player code.
- Do not change `schemaVersion` or break action-based context menu entries.
- Do not generate or redraw selfie assets.
- Preserve all unrelated uncommitted workspace changes.
- Follow test-first red-green-refactor for both behavior changes.

---

### Task 1: Keep Side Attachments Resting in Place

**Files:**
- Modify: `scripts/test-interaction-controller.js:235-270`
- Modify: `src/interaction-controller.js:381-409,535-541`

**Interfaces:**
- Consumes: `attach(target, edge, offset, role, state, extras)` and the existing attachment polling lifecycle.
- Produces: `restOnSide(target, pointer, edge)` returning no asynchronous climb work; `endDrag(pointer)` still resolves to `true` for a valid side-edge drop.

- [ ] **Step 1: Replace the old climb-delay expectations with a failing side-rest test**

Update the side-edge test to release on the right edge and assert the stable outcome:

```js
const result = await harness.controller.endDrag({ x: 100, y: 250 });
assert.strictEqual(result, true);
assert.strictEqual(harness.controller.getState(), 'climbing');
assert.strictEqual(harness.states.at(-1), 'climb-right');
assert.strictEqual(harness.climbs.length, 0, 'side rest never starts position animation');
assert.ok(!harness.clock.scheduledTimeoutDelays.includes(3000), 'side rest has no climb delay');
assert.strictEqual(harness.attachments.at(-1).edge, 'right');
```

Remove assertions that expect `perch`, a 3000 ms wait, or timed travel to the top.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node scripts/test-interaction-controller.js`

Expected: FAIL because the old controller schedules 3000 ms and eventually calls the position animator or reaches `perched`.

- [ ] **Step 3: Replace climb-to-top with side attachment only**

Replace `climbToTop` with a synchronous helper:

```js
function restOnSide(target, pointer, edge) {
  const sideOffset = pointer.y - target.bounds.y;
  const clingFacing = edge === 'right' ? 'left' : 'right';
  attach(target, edge, sideOffset, 'climb', 'climbing', { facing: clingFacing });
}
```

Update the side branch in `endDrag`:

```js
if (edge === 'left' || edge === 'right') {
  restOnSide(target, pointer, edge);
  return true;
}
```

Delete only climb-only timing and travel helpers/dependencies that become unused; retain shared attachment, fall, and frame scheduling behavior.

- [ ] **Step 4: Run interaction tests and verify GREEN**

Run: `node scripts/test-interaction-controller.js`

Expected: `test-interaction-controller: ok` with no assertion failures.

- [ ] **Step 5: Run syntax and renderer regressions**

Run: `node --check src/interaction-controller.js; node scripts/test-window-interactions.js; node scripts/test-renderer-interaction.js`

Expected: all commands exit 0 and both test scripts print their `ok` messages.

### Task 2: Add Xiaomei-Xiaotian Selfie Banter Sequence

**Files:**
- Modify: `scripts/test-bestie-petpack.js:60-90`
- Modify: `pets/library/xiaomei-xiaotian/pet.json:348-430`
- Regenerate: `pets/packages/xiaomei-xiaotian.petpack`

**Interfaces:**
- Consumes: manifest `sequences.<id>.stages[]` and `contextMenuActions[].sequence` already supported by the player and validators.
- Produces: sequence id `selfie-banter`, referenced by context menu item id `selfie`.

- [ ] **Step 1: Add a failing manifest contract test**

Add these assertions after loading the manifest:

```js
const selfieMenu = manifest.contextMenuActions.find((item) => item.id === 'selfie');
assert.strictEqual(selfieMenu.sequence, 'selfie-banter');
assert.ok(!Object.hasOwn(selfieMenu, 'action'));
assert.deepStrictEqual(manifest.sequences['selfie-banter'].stages, [
  { action: 'selfie', message: '我站后面！', duration: 1200 },
  { action: 'selfie', message: '不行，后面显脸小！', duration: 1600 },
  { action: 'selfie', message: '那一起往后挤～', duration: 1800 },
  { action: 'idle', duration: 0 }
]);
```

- [ ] **Step 2: Run the package test and verify RED**

Run: `node scripts/test-bestie-petpack.js`

Expected: FAIL because `selfieMenu.sequence` is absent and the menu still references `action: "selfie"`.

- [ ] **Step 3: Add the declarative sequence and switch the menu trigger**

Add under `sequences`:

```json
"selfie-banter": {
  "stages": [
    { "action": "selfie", "message": "我站后面！", "duration": 1200 },
    { "action": "selfie", "message": "不行，后面显脸小！", "duration": 1600 },
    { "action": "selfie", "message": "那一起往后挤～", "duration": 1800 },
    { "action": "idle", "duration": 0 }
  ]
}
```

Change only the selfie menu trigger:

```json
{
  "id": "selfie",
  "label": "合个影",
  "sequence": "selfie-banter"
}
```

- [ ] **Step 4: Rebuild the petpack from the checked library**

Run: `python skills/desktop-pet-maker/scripts/petpack_tool.py pack pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack`

Expected: command exits 0 and replaces the package with a valid ZIP-format `.petpack` containing the updated root `pet.json` and unchanged animation assets.

- [ ] **Step 5: Verify GREEN for manifest and package validation**

Run: `node scripts/test-bestie-petpack.js; python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/xiaomei-xiaotian.petpack`

Expected: JavaScript prints `test-bestie-petpack: ok`; validator reports the package as valid.

### Task 3: Full Regression and Runtime Check

**Files:**
- Verify only: `package.json`, player sources, resource package, generated runtime output.

**Interfaces:**
- Consumes: completed controller and petpack changes from Tasks 1 and 2.
- Produces: verification evidence; no new runtime interface.

- [ ] **Step 1: Run required automated regressions**

Run: `npm run test:js`

Run: `python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v`

Expected: all JavaScript tests and animation-strip tests pass without failures.

- [ ] **Step 2: Run the complete project test command**

Run: `npm test`

Expected: JavaScript, Python, and demo package validation all exit 0.

- [ ] **Step 3: Start the development player for a bounded smoke test**

Run: `npm start`

Expected: Electron launches without startup exceptions. Manually verify that a side-edge drop stays attached beyond 3 seconds and follows the target window, then trigger “合个影” and observe all three lines before idle resumes. Exit through the tray or context menu.

- [ ] **Step 4: Review the final diff without disturbing unrelated changes**

Run: `git diff --check; git status --short; git diff -- src/interaction-controller.js scripts/test-interaction-controller.js scripts/test-bestie-petpack.js pets/library/xiaomei-xiaotian/pet.json`

Expected: no whitespace errors; only the planned files and regenerated petpack are attributed to this feature. Existing unrelated dirty files remain untouched.
