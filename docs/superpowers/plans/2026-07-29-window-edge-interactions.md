# Window Edge Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible-pixel-aware dragging, dynamic speech-bubble placement, reusable Windows window-edge interactions, and the complete fall/recovery sequence to the player and the `son-pet` customer build.

**Architecture:** Keep window selection, edge classification, attachment geometry, visible-bound clamping, and fall physics in a CommonJS pure-logic module. Wrap `get-windows` behind an injectable Windows adapter, while `main-v3.js` owns the mutually exclusive interaction state machine and timers. The renderer reports alpha-derived visible insets for each displayed frame and resolves manifest-configured logical interaction roles to animations.

**Tech Stack:** Electron 43.2.0, Node.js 22.12+, CommonJS, `get-windows` 9.3.x, vanilla DOM/CSS, Node `assert`, Python 3/Pillow, repository `desktop-pet-maker`, GPT Image, PowerShell/CDP Windows verification.

## Global Constraints

- Platform target is Windows; non-Windows or failed window discovery must degrade to ordinary dragging.
- Window edge activation distance is exactly 32 DIP.
- Screen-top fall threshold is exactly 6 DIP from the visible alpha top.
- Window targeting wins over screen-top falling.
- Edge tie priority is top, bottom, then side.
- Attachment polling interval is 100ms.
- Fall acceleration is 1800 DIP/s², initial velocity is 0, and per-frame displacement is capped at 48 DIP.
- All geometry used by Electron is DIP; native-pixel bounds must be divided by the matching display `scaleFactor`.
- Drag uses the package’s `drag` interaction role, falling back to `walk`.
- `son-pet` remains two authorized photorealistic people with unchanged faces, hair, age, body shape, and clothes.
- Do not hard-code names, identity details, or pet asset paths in player code.
- Generated originals and processed transparent assets must remain in separate directories.
- `behavior.random` must not schedule `sleep`.
- Every interaction must stop roaming until it reaches `normal`.
- All animation changes and repeated interactions must preserve absolute window size, visible scale, baseline, and anchor.
- Final delivery must include the EXE, `build-report.json`, `verification-report.json`, `.petpack`, action preview image, and verification results.

---

## File Structure

- `src/window-interactions.js`: pure geometry, target selection, edge classification, attachment placement, display selection, and fall integration.
- `src/window-discovery.js`: dynamically imports `get-windows`, normalizes window records, converts physical pixels to DIP, and filters unusable/system/self windows.
- `src/interaction-controller.js`: owns the interaction state machine, attachment polling, climb interpolation, fall/impact/recovery sequencing, and timer cleanup.
- `src/main-v3.js`: wires Electron window, behavior scheduler, IPC, menus, sizes, discovery adapter, and controller.
- `src/preload-v3.js`: exposes only validated visible-inset and drag payload methods plus state subscription.
- `src/renderer-v3.js`: calculates alpha bounds, reports visible insets, positions the bubble, and resolves logical roles.
- `src/styles-v3.css`: replaces the fixed bubble top with a CSS variable and keeps the image/bubble layout stable.
- `src/petpack-validator.js`: validates optional `interactionActions` mappings and normalized anchors.
- `scripts/test-window-interactions.js`: tests pure target/edge/clamp/attachment/fall logic.
- `scripts/test-interaction-controller.js`: tests state transitions and timer cleanup using fakes.
- `scripts/test-renderer-interaction.js`: tests drag pose, alpha bounds, bubble spacing, and 50 repeated state updates.
- `scripts/test-petpack-security.js`: tests valid and invalid `interactionActions`.
- `skills/desktop-pet-maker/scripts/petpack_tool.py`: mirrors JavaScript manifest validation.
- `skills/desktop-pet-maker/scripts/test_petpack_tool.py`: Python validator regression tests.
- `skills/desktop-pet-maker/references/petpack-schema.md`: documents `interactionActions`.
- `package.json` / `package-lock.json`: adds `get-windows` and the new JavaScript tests.
- `pets/work/son-pet/source/interactions/`: preserved generated chroma originals.
- `pets/work/son-pet/processed/interactions/`: processed transparent interaction frames.
- `pets/library/son-pet/animations/{climb,perch,hang,fall,impact,pat-butt}/`: final package frames.
- `pets/library/son-pet/pet.json`: interaction mappings, animations, anchors, and unchanged menu/behavior configuration.
- `pets/library/son-pet/preview.png`: retained package preview.
- `pets/packages/son-pet.petpack`: rebuilt package.
- `outputs/son-pet-interactions-preview.png`: all new actions contact sheet.
- `outputs/son-pet-0.4.0.exe`: rebuilt portable customer executable.
- `outputs/build-report.json`: customer build provenance.
- `outputs/verification-report.json`: automated and manual verification evidence.

---

### Task 1: Pure Window Interaction Geometry

**Files:**
- Create: `src/window-interactions.js`
- Create: `scripts/test-window-interactions.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `selectTargetWindow(pointer, windows, excludedIds) -> window|null`
- Produces: `classifyWindowEdge(pointer, bounds, threshold = 32) -> "top"|"bottom"|"left"|"right"|null`
- Produces: `visibleRect(windowBounds, visibleInsets) -> Rect`
- Produces: `clampByVisibleBounds(windowBounds, visibleInsets, displayBounds) -> Point`
- Produces: `positionForAttachment(targetBounds, edge, anchor, petSize, visibleInsets, relativeOffset) -> Point`
- Produces: `nextFallFrame(state, elapsedMs, floorY) -> { y, velocity, landed }`

- [ ] **Step 1: Write failing geometry tests**

```js
'use strict';
const assert = require('assert');
const {
  selectTargetWindow, classifyWindowEdge, visibleRect,
  clampByVisibleBounds, positionForAttachment, nextFallFrame
} = require('../src/window-interactions');

const windows = [
  { id: 'pet', bounds: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 'front', bounds: { x: 100, y: 100, width: 500, height: 400 } },
  { id: 'back', bounds: { x: 80, y: 80, width: 600, height: 500 } }
];
assert.strictEqual(selectTargetWindow({ x: 110, y: 110 }, windows, new Set(['pet'])).id, 'front');
assert.strictEqual(classifyWindowEdge({ x: 110, y: 110 }, windows[1].bounds, 32), 'top');
assert.strictEqual(classifyWindowEdge({ x: 350, y: 490 }, windows[1].bounds, 32), 'bottom');
assert.strictEqual(classifyWindowEdge({ x: 105, y: 300 }, windows[1].bounds, 32), 'left');
assert.strictEqual(classifyWindowEdge({ x: 350, y: 300 }, windows[1].bounds, 32), null);
assert.deepStrictEqual(
  visibleRect({ x: -20, y: -60, width: 220, height: 240 }, { left: 10, top: 60, right: 10, bottom: 5 }),
  { x: -10, y: 0, width: 200, height: 175 }
);
assert.deepStrictEqual(
  clampByVisibleBounds(
    { x: 20, y: -100, width: 220, height: 240 },
    { left: 10, top: 60, right: 10, bottom: 5 },
    { x: 0, y: 0, width: 1920, height: 1080 }
  ),
  { x: 20, y: -60 }
);
assert.deepStrictEqual(
  positionForAttachment(
    { x: 100, y: 100, width: 500, height: 400 }, 'top',
    { x: 0.5, y: 0.7 }, { width: 220, height: 240 },
    { left: 10, top: 20, right: 10, bottom: 5 }, 250
  ),
  { x: 240, y: -43 }
);
assert.deepStrictEqual(nextFallFrame({ y: 0, velocity: 0 }, 100, 1000), {
  y: 18, velocity: 180, landed: false
});
assert.deepStrictEqual(nextFallFrame({ y: 990, velocity: 1000 }, 100, 1000), {
  y: 1000, velocity: 1180, landed: true
});
console.log('window interaction geometry checks passed');
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node scripts/test-window-interactions.js`

Expected: FAIL with `Cannot find module '../src/window-interactions'`.

- [ ] **Step 3: Implement the pure functions**

```js
'use strict';

function contains(point, bounds) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function selectTargetWindow(pointer, windows, excludedIds = new Set()) {
  return windows.find((item) => item && !excludedIds.has(String(item.id))
    && item.visible !== false && item.minimized !== true
    && item.bounds?.width > 0 && item.bounds?.height > 0
    && contains(pointer, item.bounds)) || null;
}

function classifyWindowEdge(pointer, bounds, threshold = 32) {
  if (!contains(pointer, bounds)) return null;
  const distances = {
    top: Math.abs(pointer.y - bounds.y),
    bottom: Math.abs(bounds.y + bounds.height - pointer.y),
    left: Math.abs(pointer.x - bounds.x),
    right: Math.abs(bounds.x + bounds.width - pointer.x)
  };
  for (const edge of ['top', 'bottom', 'left', 'right']) {
    if (distances[edge] <= threshold) return edge;
  }
  return null;
}

function visibleRect(bounds, insets) {
  return {
    x: bounds.x + insets.left,
    y: bounds.y + insets.top,
    width: bounds.width - insets.left - insets.right,
    height: bounds.height - insets.top - insets.bottom
  };
}

function clampByVisibleBounds(bounds, insets, display) {
  const visible = visibleRect(bounds, insets);
  const x = Math.min(
    Math.max(bounds.x, display.x - insets.left),
    display.x + display.width - visible.width - insets.left
  );
  const y = Math.min(
    Math.max(bounds.y, display.y - insets.top),
    display.y + display.height - visible.height - insets.top
  );
  return { x: Math.round(x), y: Math.round(y) };
}

function positionForAttachment(target, edge, anchor, petSize, insets, offset = 0) {
  const visibleWidth = petSize.width - insets.left - insets.right;
  const visibleHeight = petSize.height - insets.top - insets.bottom;
  const centerX = target.x + Math.max(0, Math.min(target.width, offset));
  if (edge === 'top') return {
    x: Math.round(centerX - insets.left - visibleWidth * anchor.x),
    y: Math.round(target.y - insets.top - visibleHeight * anchor.y)
  };
  if (edge === 'bottom') return {
    x: Math.round(centerX - insets.left - visibleWidth * anchor.x),
    y: Math.round(target.y + target.height - insets.top - visibleHeight * anchor.y)
  };
  const targetX = edge === 'left' ? target.x : target.x + target.width;
  return {
    x: Math.round(targetX - insets.left - visibleWidth * anchor.x),
    y: Math.round(target.y + Math.max(0, Math.min(target.height, offset))
      - insets.top - visibleHeight * anchor.y)
  };
}

function nextFallFrame(state, elapsedMs, floorY) {
  const seconds = Math.max(0, elapsedMs) / 1000;
  const velocity = state.velocity + 1800 * seconds;
  const movement = Math.min(48, state.velocity * seconds + 900 * seconds * seconds);
  const y = Math.min(floorY, state.y + movement);
  return { y: Math.round(y), velocity, landed: y >= floorY };
}

module.exports = {
  selectTargetWindow, classifyWindowEdge, visibleRect,
  clampByVisibleBounds, positionForAttachment, nextFallFrame
};
```

- [ ] **Step 4: Run the geometry tests**

Run: `node scripts/test-window-interactions.js`

Expected: PASS and print `window interaction geometry checks passed`.

- [ ] **Step 5: Add the test to `test:js` and commit**

Modify `package.json` so `test:js` includes:

```json
"node scripts/test-window-interactions.js"
```

Run: `npm run test:js`

Expected: all JavaScript checks pass.

Commit:

```powershell
git add src/window-interactions.js scripts/test-window-interactions.js package.json
git commit -m "feat: add window interaction geometry"
```

---

### Task 2: Window Discovery Adapter

**Files:**
- Create: `src/window-discovery.js`
- Create: `scripts/test-window-discovery.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Electron `screen.getDisplayMatching(rect)` and current process ID.
- Produces: `createWindowDiscovery({ loadOpenWindows, screen, selfPid, logger })`
- Produces: `discovery.list() -> Promise<Array<{id, ownerPid, bounds, visible, minimized}>>`
- Produces: `discovery.available() -> boolean`

- [ ] **Step 1: Install the approved dependency**

Run: `npm install get-windows@^9.3.0`

Expected: `package.json` and `package-lock.json` contain `get-windows`.

- [ ] **Step 2: Write the failing adapter test**

```js
'use strict';
const assert = require('assert');
const { createWindowDiscovery } = require('../src/window-discovery');

(async () => {
  const discovery = createWindowDiscovery({
    selfPid: 77,
    logger: { warn: () => {} },
    screen: { getDisplayMatching: () => ({ scaleFactor: 2 }) },
    loadOpenWindows: async () => async () => [
      { id: 1, owner: { processId: 77, name: 'son-pet' }, bounds: { x: 0, y: 0, width: 200, height: 200 } },
      { id: 2, owner: { processId: 88, name: 'notepad' }, bounds: { x: 200, y: 100, width: 800, height: 600 } },
      { id: 3, owner: { processId: 99, name: 'Shell_TrayWnd' }, bounds: { x: 0, y: 1000, width: 1920, height: 80 } }
    ]
  });
  assert.deepStrictEqual(await discovery.list(), [{
    id: '2', ownerPid: 88,
    bounds: { x: 100, y: 50, width: 400, height: 300 },
    visible: true, minimized: false
  }]);
  assert.strictEqual(discovery.available(), true);
  console.log('window discovery checks passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `node scripts/test-window-discovery.js`

Expected: FAIL with `Cannot find module '../src/window-discovery'`.

- [ ] **Step 4: Implement dynamic loading and normalization**

```js
'use strict';
const SYSTEM_OWNERS = new Set(['explorer', 'shell_traywnd', 'progman', 'workerw']);

function createWindowDiscovery({
  loadOpenWindows = async () => (await import('get-windows')).openWindows,
  screen, selfPid = process.pid, logger = console
}) {
  let openWindows;
  let enabled = true;
  async function list() {
    if (!enabled) return [];
    try {
      openWindows ||= await loadOpenWindows();
      const records = await openWindows();
      return records.flatMap((item) => {
        const ownerPid = Number(item.owner?.processId);
        const ownerName = String(item.owner?.name || '').toLowerCase();
        const bounds = item.bounds;
        if (ownerPid === selfPid || SYSTEM_OWNERS.has(ownerName)
          || !bounds || bounds.width <= 0 || bounds.height <= 0 || item.isMinimized) return [];
        const scaleFactor = screen.getDisplayMatching(bounds).scaleFactor || 1;
        return [{
          id: String(item.id), ownerPid,
          bounds: {
            x: Math.round(bounds.x / scaleFactor),
            y: Math.round(bounds.y / scaleFactor),
            width: Math.round(bounds.width / scaleFactor),
            height: Math.round(bounds.height / scaleFactor)
          },
          visible: true, minimized: false
        }];
      });
    } catch (error) {
      enabled = false;
      logger.warn(`Window discovery disabled: ${error.message}`);
      return [];
    }
  }
  return { list, available: () => enabled };
}

module.exports = { createWindowDiscovery };
```

- [ ] **Step 5: Run tests and commit**

Add `node scripts/test-window-discovery.js` to `test:js`.

Run: `npm run test:js`

Expected: all checks pass, including `window discovery checks passed`.

Commit:

```powershell
git add src/window-discovery.js scripts/test-window-discovery.js package.json package-lock.json
git commit -m "feat: discover Windows target windows"
```

---

### Task 3: Manifest Interaction Roles and Validation

**Files:**
- Modify: `src/petpack-validator.js`
- Modify: `skills/desktop-pet-maker/scripts/petpack_tool.py`
- Modify: `scripts/test-petpack-security.js`
- Modify: `skills/desktop-pet-maker/scripts/test_petpack_tool.py`
- Modify: `skills/desktop-pet-maker/references/petpack-schema.md`

**Interfaces:**
- Produces: validated optional `interactionActions` object.
- Logical keys: `drag`, `climb`, `perch`, `hang`, `fall`, `impact`, `recover`.
- Each value: `{ action: string, anchor?: { x: number, y: number } }`.
- Every action must exist in `animations`; every anchor coordinate must be finite and within `0..1`.

- [ ] **Step 1: Add failing JavaScript validator tests**

Append tests that clone the demo manifest and assert:

```js
manifest.interactionActions = {
  drag: { action: 'walk' },
  perch: { action: 'sit', anchor: { x: 0.5, y: 0.7 } }
};
assert.doesNotThrow(() => validateManifest(manifest));
manifest.interactionActions.perch.anchor.y = 1.1;
assert.throws(() => validateManifest(manifest), /anchor/);
manifest.interactionActions.perch.action = 'missing';
assert.throws(() => validateManifest(manifest), /不存在/);
manifest.interactionActions.unknown = { action: 'sit' };
assert.throws(() => validateManifest(manifest), /interactionActions/);
```

- [ ] **Step 2: Add matching failing Python tests**

Create a temporary manifest in `test_petpack_tool.py`, then assert:

```python
manifest["interactionActions"] = {
    "drag": {"action": "walk"},
    "perch": {"action": "sit", "anchor": {"x": 0.5, "y": 0.7}},
}
petpack_tool.validate_manifest(manifest)
manifest["interactionActions"]["perch"]["anchor"]["x"] = -0.01
with self.assertRaisesRegex(ValueError, "anchor"):
    petpack_tool.validate_manifest(manifest)
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```powershell
node scripts/test-petpack-security.js
python -m unittest skills.desktop-pet-maker.scripts.test_petpack_tool -v
```

Expected: both suites fail because `interactionActions` is not validated.

- [ ] **Step 4: Implement both validators**

Add the equivalent of this JavaScript block after animation validation:

```js
const INTERACTION_ROLES = new Set(['drag', 'climb', 'perch', 'hang', 'fall', 'impact', 'recover']);
if (manifest.interactionActions !== undefined) {
  if (!manifest.interactionActions || typeof manifest.interactionActions !== 'object'
      || Array.isArray(manifest.interactionActions)) {
    throw new Error('interactionActions 必须是对象');
  }
  for (const [role, config] of Object.entries(manifest.interactionActions)) {
    if (!INTERACTION_ROLES.has(role) || !config || typeof config !== 'object') {
      throw new Error('interactionActions 包含不支持的角色');
    }
    if (typeof config.action !== 'string' || !manifest.animations[config.action]) {
      throw new Error(`interactionActions 引用了不存在的动画：${config.action}`);
    }
    if (config.anchor !== undefined) {
      const { x, y } = config.anchor || {};
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new Error(`interactionActions ${role} 的 anchor 必须位于 0..1`);
      }
    }
  }
}
```

Add the same validator in Python:

```python
INTERACTION_ROLES = {"drag", "climb", "perch", "hang", "fall", "impact", "recover"}

interaction_actions = manifest.get("interactionActions")
if interaction_actions is not None:
    if not isinstance(interaction_actions, dict):
        raise ValueError("interactionActions must be an object")
    for role, config in interaction_actions.items():
        if role not in INTERACTION_ROLES or not isinstance(config, dict):
            raise ValueError("interactionActions contains an unsupported role")
        action = config.get("action")
        if not isinstance(action, str) or action not in animations:
            raise ValueError("interactionActions references an unknown animation")
        anchor = config.get("anchor")
        if anchor is not None:
            if not isinstance(anchor, dict):
                raise ValueError("interactionActions anchor must be an object")
            x, y = anchor.get("x"), anchor.get("y")
            if (
                not isinstance(x, (int, float))
                or isinstance(x, bool)
                or not isinstance(y, (int, float))
                or isinstance(y, bool)
                or not 0 <= x <= 1
                or not 0 <= y <= 1
            ):
                raise ValueError("interactionActions anchor must be within 0..1")
```

Document the seven roles, fallback table, and normalized anchor meaning in `petpack-schema.md`.

- [ ] **Step 5: Run validator suites and commit**

Run: `npm run test:js && npm run test:python`

Expected: all checks pass.

Commit:

```powershell
git add src/petpack-validator.js scripts/test-petpack-security.js skills/desktop-pet-maker/scripts/petpack_tool.py skills/desktop-pet-maker/scripts/test_petpack_tool.py skills/desktop-pet-maker/references/petpack-schema.md
git commit -m "feat: validate interaction action mappings"
```

---

### Task 4: Renderer Alpha Bounds, Drag Pose, and Dynamic Bubble

**Files:**
- Modify: `src/renderer-v3.js`
- Modify: `src/preload-v3.js`
- Modify: `src/styles-v3.css`
- Modify: `scripts/test-renderer-interaction.js`

**Interfaces:**
- Produces renderer report: `setVisibleInsets({ left, top, right, bottom })`.
- Consumes main state payload: `{ state, message, speech, logicalRole? }`.
- Resolves logical role using `manifest.interactionActions` and fallbacks.
- CSS variable `--bubble-top` is the bubble’s absolute top in window CSS pixels.

- [ ] **Step 1: Extend renderer fakes and write failing tests**

Add `setVisibleInsets` recording, configurable alpha data, `bubble.offsetHeight = 24`, and assertions:

```js
assert.deepStrictEqual(calls.insets.at(-1), {
  left: 20, top: 30, right: 20, bottom: 10
});
assert.strictEqual(
  bubble.style.getPropertyValue('--bubble-top'),
  '0px',
  'bubble is clamped after placing its bottom 6px above visible pixels'
);
stateCallback({ state: 'drag', logicalRole: 'drag', message: '' });
assert.strictEqual(petImage.src, 'walk.png', 'drag role falls back to walk');
for (let index = 0; index < 50; index += 1) {
  stateCallback({ state: 'perch', logicalRole: 'perch', message: '测试' });
}
assert.strictEqual(pet.style.getPropertyValue('--action-scale'), '1');
```

- [ ] **Step 2: Run the renderer test and verify failure**

Run: `node scripts/test-renderer-interaction.js`

Expected: FAIL because alpha insets are not reported and drag does not resolve to `walk`.

- [ ] **Step 3: Add the minimal preload method**

Expose:

```js
setVisibleInsets: (insets) => ipcRenderer.send('pet:visible-insets', insets)
```

Keep window titles, process paths, and discovery results unavailable to the renderer.

- [ ] **Step 4: Calculate alpha bounds and dynamic bubble position**

Refactor `refreshHitMask()` to scan alpha once after drawing:

```js
function scanVisibleInsets() {
  const { width, height } = hitCanvas;
  const data = hitContext.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < HIT_ALPHA_CUTOFF) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  const rect = petImage.getBoundingClientRect();
  const fit = Math.min(rect.width / width, rect.height / height);
  const contentWidth = width * fit;
  const contentHeight = height * fit;
  const contentLeft = rect.left + (rect.width - contentWidth) / 2;
  const contentTop = rect.bottom - contentHeight;
  return {
    left: Math.round(contentLeft + minX * fit),
    top: Math.round(contentTop + minY * fit),
    right: Math.round(innerWidth - (contentLeft + (maxX + 1) * fit)),
    bottom: Math.round(innerHeight - (contentTop + (maxY + 1) * fit))
  };
}

function positionBubble(insets) {
  const top = Math.max(0, Math.round(insets.top - bubble.offsetHeight - 6));
  bubble.style.setProperty('--bubble-top', `${top}px`);
}
```

Call `setVisibleInsets` and `positionBubble` after every frame image load. Cache the last valid insets and smooth only changes under 4px to prevent frame flicker.

Resolve role fallbacks:

```js
const FALLBACKS = {
  drag: 'walk', climb: 'walk', perch: 'sit', hang: 'sit',
  fall: 'reaction', impact: 'reaction', recover: 'reaction'
};
function resolveLogicalRole(role) {
  return manifest.interactionActions?.[role]?.action
    || FALLBACKS[role] || role;
}
```

In pointer drag start, ask main for the logical `drag` state; do not locally accumulate transforms.

- [ ] **Step 5: Replace fixed bubble positioning**

Change:

```css
.bubble {
  top: var(--bubble-top, 0px);
}
```

Do not retain a size-specific hard-coded `top`.

- [ ] **Step 6: Run renderer and syntax tests, then commit**

Run: `npm run test:js`

Expected: all checks pass and the renderer test confirms 50 stable role changes.

Commit:

```powershell
git add src/renderer-v3.js src/preload-v3.js src/styles-v3.css scripts/test-renderer-interaction.js
git commit -m "feat: align drag and bubbles to visible pixels"
```

---

### Task 5: Interaction State Controller and Electron Wiring

**Files:**
- Create: `src/interaction-controller.js`
- Create: `scripts/test-interaction-controller.js`
- Modify: `src/main-v3.js`
- Modify: `package.json`
- Modify: `scripts/build-customer.js`

**Interfaces:**
- Consumes Task 1 geometry and Task 2 discovery.
- Produces `createInteractionController(dependencies)` with:
  - `startDrag(pointer)`
  - `moveDrag(pointer)`
  - `endDrag(pointer)`
  - `updateVisibleInsets(insets)`
  - `detachAndFall(reason)`
  - `dispose()`
  - `state()`
- Main’s `sendState` accepts `logicalRole` and emits `{ state, logicalRole, message, speech }`.

- [ ] **Step 1: Write state-machine tests using a fake clock/window**

Cover these exact transitions:

```js
assert.deepStrictEqual(states, ['drag']);
await controller.endDrag({ x: 200, y: 100 });
assert.deepStrictEqual(states.slice(-2), ['climb', 'perch']);

discovery.windows = [{ id: 'w1', bounds: { x: 100, y: 100, width: 500, height: 400 } }];
await controller.endDrag({ x: 350, y: 499 });
assert.strictEqual(controller.state(), 'hanging');

discovery.windows = [];
visibleInsets.top = 60;
windowBounds.y = -60;
await controller.endDrag({ x: 500, y: 0 });
clock.flushAnimationFrames();
clock.flushTimeouts();
assert.deepStrictEqual(states.slice(-4), ['fall', 'impact', 'recover', 'normal']);
assert.deepStrictEqual(windowBounds, expectedCurrentDisplayBottomRight);
```

Also assert:

- top/bottom/side/center behavior;
- window wins over screen top;
- attached window movement changes pet position;
- missing/minimized target triggers fall;
- dragging attached pet detaches;
- discovery rejection returns to `normal`;
- `dispose()` clears poll, animation, walk, and behavior timers.

- [ ] **Step 2: Run the controller test and verify failure**

Run: `node scripts/test-interaction-controller.js`

Expected: FAIL with `Cannot find module '../src/interaction-controller'`.

- [ ] **Step 3: Implement the controller with one authoritative state**

Use:

```js
const INTERACTIVE_STATES = new Set([
  'dragging', 'climbing', 'perched', 'hanging',
  'falling', 'impact', 'recovering'
]);

function transition(next, logicalRole) {
  currentState = next;
  if (INTERACTIVE_STATES.has(next)) pauseBehavior();
  sendState(logicalRole || next);
}
```

Required behavior:

- `startDrag`: stop walking, clear attachment polling, store pointer/window origin, transition to `dragging` with role `drag`.
- `moveDrag`: apply pointer delta, then `clampByVisibleBounds` against the current display’s full `bounds`, not `workArea`, so visible pixels reach the top.
- `endDrag`: call discovery once, select the topmost normal window, classify the edge, and dispatch.
- side: interpolate to the target top attachment over the configured `climb` animation duration, then enter `perched`.
- top: enter `perched`.
- bottom: enter `hanging`.
- no edge: return to `normal`.
- no window and visible top within 6 DIP: fall to the current display’s bottom-right startup position.
- poll attachments every 100ms and follow the saved relative offset.
- target absent/minimized/invalid: `detachAndFall`.
- fall: use the controller’s injected `scheduleFrame(callback)` abstraction, backed by a 16ms `setTimeout` in production and a deterministic fake clock in tests; call `nextFallFrame` for every tick, then wait for the manifest durations of `impact` and `recover`.
- every size update uses `{ x, y, width: currentSize.width, height: currentSize.height }`.

- [ ] **Step 4: Wire the controller into `main-v3.js`**

Changes:

```js
const { createWindowDiscovery } = require('./window-discovery');
const { createInteractionController } = require('./interaction-controller');
```

Extend `publicManifest`:

```js
interactionActions: manifest.interactionActions || {}
```

Replace direct drag handlers with controller calls and include the end pointer:

```js
onTrusted('pet:drag-start', (pointer) => interaction.startDrag(pointer));
onTrusted('pet:drag-move', (pointer) => interaction.moveDrag(pointer));
onTrusted('pet:drag-end', (pointer) => interaction.endDrag(pointer));
onTrusted('pet:visible-insets', (insets) => interaction.updateVisibleInsets(insets));
```

Validate all four inset values as finite, nonnegative, and smaller than the current window dimension. Update renderer `endDrag` to send `{ screenX, screenY }`.

Make `runBehavior`, context-menu actions, size changes, and quit consult or dispose the controller so roaming never overlaps an interaction.

- [ ] **Step 5: Include new modules in customer builds**

Add these files to both default `build.files` and generated customer `build.files`:

```json
"src/window-interactions.js",
"src/window-discovery.js",
"src/interaction-controller.js"
```

Ensure the customer package copies `get-windows` through normal production dependencies and still uses the existing optional `CUSTOMER_ELECTRON_DIST` workaround only when set.

- [ ] **Step 6: Run all automated tests and commit**

Add `node scripts/test-interaction-controller.js` to `test:js`.

Run: `npm test`

Expected: JavaScript, Python, and demo package validation all pass.

Commit:

```powershell
git add src/interaction-controller.js scripts/test-interaction-controller.js src/main-v3.js src/preload-v3.js src/renderer-v3.js package.json scripts/build-customer.js
git commit -m "feat: add reusable window edge interaction state machine"
```

---

### Task 6: Generate and Process `son-pet` Interaction Assets

**Files:**
- Preserve: `pets/work/son-pet/source/interactions/*.png`
- Create: `pets/work/son-pet/processed/interactions/{climb,perch,hang,fall,impact,pat-butt}/*.png`
- Create: `pets/library/son-pet/animations/{climb,perch,hang,fall,impact,pat-butt}/*.png`
- Modify: `pets/library/son-pet/pet.json`
- Create: `outputs/son-pet-interactions-preview.png`

**Interfaces:**
- Consumes the authorized reference photo and current accepted `son-pet` frames as identity/scale references.
- Produces 28 new normalized transparent frames:
  - `climb`: 6
  - `perch`: 4
  - `hang`: 4
  - `fall`: 4
  - `impact`: 4
  - `pat-butt`: 6

- [ ] **Step 1: Record the source inputs and inspect current accepted frames**

Use the original:

`C:\Users\Thinkpad\Downloads\20260729-195846.jpg`

Inspect representative current `idle`, `walk`, `sit`, and `reaction` PNGs. Record canvas size, visible alpha bounds, baseline, alpha area, and two-person component behavior in `pets/work/son-pet/asset-metrics.json`.

- [ ] **Step 2: Generate six green-screen action strips with GPT Image**

Use `imagegen` with the original photo plus accepted action frames. Each prompt must state:

```text
The same two authorized Chinese men together as one paired desktop-pet subject.
Photorealistic full bodies, unchanged faces, facial features, short black hair,
age, body proportions, black jackets, trousers, shoes, and relative height.
No face swap, no cartoon style, no text, no props, no window or edge drawn.
Uniform bright green background, wide empty gutters between frames, complete
hands, fingers, feet, shoes, and clothing in every cell, fixed camera, fixed
scale, fixed ground baseline, consistent lighting.
```

Add action-specific direction:

- `climb` 6 cells: both men climb an invisible vertical right edge, alternating hands and knees, finish pulling up.
- `perch` 4 cells: both sit on an invisible horizontal top edge, legs hanging naturally.
- `hang` 4 cells: both hands of each person grip an invisible overhead lower edge, bodies suspended.
- `fall` 4 cells: lose support and fall vertically, bodies intact and scale unchanged.
- `impact` 4 cells: land and fall onto their bottoms without squash/stretch.
- `pat-butt` 6 cells: stand from impact, pat dust from their own backsides, then return to the established front-facing kneel.

Save untouched tool outputs as `*-chroma-original.png` under `pets/work/son-pet/source/interactions/`.

- [ ] **Step 3: Add explicit action-count support to the repository processor**

First add this failing unit test:

```python
def test_parse_custom_action_counts(self) -> None:
    self.assertEqual(
        parse_action_counts(["climb:6", "perch:4", "hang:4"]),
        {"climb": 6, "perch": 4, "hang": 4},
    )
    with self.assertRaisesRegex(ValueError, "name:count"):
        parse_action_counts(["climb"])
```

Run:

```powershell
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
```

Expected: FAIL because `parse_action_counts` does not exist.

Implement:

```python
def parse_action_counts(values: list[str] | None) -> dict[str, int]:
    if not values:
        return dict(FRAME_COUNTS)
    result: dict[str, int] = {}
    for value in values:
        name, separator, raw_count = value.partition(":")
        if not separator or not name or not raw_count.isdigit():
            raise ValueError("--action must use name:count")
        count = int(raw_count)
        if count < 1 or count > 12 or name in result:
            raise ValueError("--action must use unique name:count with count 1..12")
        result[name] = count
    return result
```

Add:

```python
parser.add_argument("--action", action="append", help="Action and frame count as name:count")
action_counts = parse_action_counts(args.action)
```

Pass `action_counts` to loading and change `contact_sheet(output_root, action_counts)` to iterate over that map instead of the standard constant. Keep the existing default of the five required standard actions when `--action` is omitted.

Run:

```powershell
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
```

Expected: all processor tests pass.

- [ ] **Step 4: Process strips with the repository maker**

```powershell
python skills/desktop-pet-maker/scripts/process_animation_strips.py `
  --input-dir pets/work/son-pet/source/interactions `
  --output-dir pets/work/son-pet/processed/interactions `
  --action climb:6 --action perch:4 --action hang:4 `
  --action fall:4 --action impact:4 --action pat-butt:6 `
  --max-significant-components 2
```

Expected: all 28 transparent frames share the current pet canvas, preserve the paired subject, and pass safety-gutter, flat-side, detached-fragment, alpha-area, centroid, and baseline checks.

- [ ] **Step 5: Visually inspect every frame and regenerate failures**

Reject and regenerate any strip containing:

- clipping or missing fingers, hands, feet, or shoes;
- faces changing between frames;
- the two men merging or swapping;
- green fringe or green reflection;
- baked-in window lines, text, or props;
- frame-cell leakage;
- scale, baseline, centroid, or identity drift.

Do not patch missing anatomy by erasing leaked fragments.

- [ ] **Step 6: Install final frames and update the manifest**

Copy approved processed frames into the six final animation directories and add:

```json
"interactionActions": {
  "drag": { "action": "walk" },
  "climb": { "action": "climb", "anchor": { "x": 0.5, "y": 0.5 } },
  "perch": { "action": "perch", "anchor": { "x": 0.5, "y": 0.7 } },
  "hang": { "action": "hang", "anchor": { "x": 0.5, "y": 0.1 } },
  "fall": { "action": "fall" },
  "impact": { "action": "impact" },
  "recover": { "action": "pat-butt" }
}
```

Add the six animations with the exact frame counts and absolute `scale: 1`. Keep `call-dad`, `kowtow`, and `behavior.random` unchanged; confirm no random entry uses `sleep`.

- [ ] **Step 7: Build the action preview and validate the directory**

Generate a labeled transparent/checkerboard contact sheet containing all 28 frames:

`outputs/son-pet-interactions-preview.png`

Run:

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/library/son-pet
```

Expected: validation passes with no warnings.

- [ ] **Step 8: Commit player-safe package sources**

Commit only repository-intended package files and processing support; keep large untouched generation originals according to repository ignore policy.

```powershell
git add pets/library/son-pet skills/desktop-pet-maker/scripts outputs/son-pet-interactions-preview.png
git commit -m "feat: add son-pet window interaction animations"
```

---

### Task 7: Rebuild and Audit the `.petpack` and Customer EXE

**Files:**
- Create: `pets/packages/son-pet.petpack`
- Create: `outputs/son-pet.petpack`
- Create: `outputs/son-pet-0.4.0.exe`
- Create: `outputs/build-report.json`

**Interfaces:**
- Consumes the fully validated `pets/library/son-pet`.
- Produces a customer-mode portable EXE named `son-pet`.
- Delivery ID remains `son-pet`; data directory remains isolated under `Desktop Pet Deliveries/son-pet`.

- [ ] **Step 1: Build and revalidate the package**

Run:

```powershell
python skills/desktop-pet-maker/scripts/petpack_tool.py build `
  pets/library/son-pet pets/packages/son-pet.petpack
python skills/desktop-pet-maker/scripts/petpack_tool.py validate `
  pets/packages/son-pet.petpack
```

Expected: both commands succeed.

- [ ] **Step 2: Run the complete repository test suite**

Run: `npm test`

Expected: all JavaScript, Python, and package validation checks pass.

- [ ] **Step 3: Build the customer executable**

Run:

```powershell
npm run build:customer -- `
  --pet pets/packages/son-pet.petpack `
  -name "son-pet" `
  --delivery-id son-pet
```

If Electron extraction again fails with `EPERM`, set `CUSTOMER_ELECTRON_DIST` to the already verified local Electron 43.2.0 distribution and rerun the identical build.

Expected: a portable EXE and `build-report.json`.

- [ ] **Step 4: Audit the build**

Verify:

- report package SHA-256 equals the built `.petpack`;
- EXE exists and has a new SHA-256;
- ASAR contains all six new source modules and no hard-coded `son-pet` identity in generic logic;
- ASAR contains only the customer delivery petpack;
- no source photo path or generated-original path appears in ASAR;
- delivery ID and application name both equal `son-pet`;
- package dependency tree includes `get-windows`;
- unsigned status is explicitly recorded.

- [ ] **Step 5: Copy final build artifacts**

Copy only final user-facing files to `outputs/`:

- `son-pet-0.4.0.exe`
- `build-report.json`
- `son-pet.petpack`
- `son-pet-interactions-preview.png`

Do not overwrite the preserved original reference photo or generated source strips.

---

### Task 8: Windows Runtime Verification and Final Report

**Files:**
- Modify: `scripts/test-runtime-cdp.ps1`
- Create: `outputs/verification-report.json`
- Create: `outputs/verification-results.md`

**Interfaces:**
- Consumes the final portable EXE.
- Produces machine-readable and human-readable verification evidence.

- [ ] **Step 1: Extend automated runtime inspection**

Update the CDP report to capture:

```powershell
interactionActions = $initial.manifest.interactionActions
visibleInsets = Invoke-Eval "window.__petDebug?.visibleInsets || null"
bubbleTop = Invoke-Eval "getComputedStyle(document.getElementById('bubble')).top"
windowSize = Invoke-Eval "({width: innerWidth, height: innerHeight})"
```

Sample 50 transitions for every new logical role and assert:

- `innerWidth` and `innerHeight` never change;
- image display rectangle never shifts by more than 2 DIP at the configured anchor;
- action scale remains exactly `1`;
- every expected frame source appears;
- no role accumulates CSS classes or transforms.

- [ ] **Step 2: Launch the real final EXE**

Use a clean test data directory or remove only the dedicated recoverable test directory after resolving its exact path. Start the final EXE and confirm the process, pet window, and tray appear.

- [ ] **Step 3: Verify the original required behavior**

Check and record:

- crawling left and right;
- `behavior.random` never schedules sleep;
- “叫爸” shows `爸!` and uses Windows Chinese system speech;
- “磕头” shows `给您磕头了` and returns to kneeling;
- dragging;
- transparent-pixel mouse pass-through;
- right-click menu;
- tray show/hide;
- clean exit;
- independent `son-pet` data directory.

- [ ] **Step 4: Verify bubble spacing and top boundary**

For small, medium, and large:

- trigger both text actions;
- measure visible alpha top and bubble bottom;
- accept only 4–8px spacing, target 6px;
- drag until visible hair reaches the physical top of the current display;
- confirm transparent canvas margin, not the visible people, is outside the display;
- confirm there is no artificial gap like the reported screenshot.

- [ ] **Step 5: Verify window interactions**

Using Notepad and a second overlapping normal application window:

- top edge enters `perch`;
- left and right sides play `climb`, move to the top, then enter `perch`;
- lower edge enters two-hand `hang`;
- center releases normally;
- overlapping target selects the frontmost normal window;
- moving the target window moves the pet;
- minimizing and closing the target causes fall;
- dragging an attached pet detaches it;
- taskbar, desktop, pet window, hidden, and minimized windows are never targets.

- [ ] **Step 6: Verify screen-top fall and multi-monitor rules**

- With no valid window under the pointer, release with visible alpha top within 6 DIP of the current display top.
- Confirm sequence: `fall -> impact -> recover -> normal`.
- Confirm recovery image pats the backside and ends in the established kneel.
- Confirm final location is the current display’s bottom-right startup location.
- Confirm a valid window under the same pointer prevents the screen-top fall.
- If a second display is connected, repeat on it and verify its bounds, scale factor, and bottom-right landing.

- [ ] **Step 7: Run 50 consecutive interaction cycles**

Cycle through drag, climb, perch, hang, fall, impact, recover, call-dad, and kowtow 50 times. Record:

- initial and final Electron window bounds;
- alpha bounding boxes per role;
- anchor positions;
- scale values;
- unexpected displacement count;
- unexpected resize count.

Acceptance: zero unexpected resize, zero cumulative displacement, no clipped body parts, no green fringe, no identity drift, and no timer overlap.

- [ ] **Step 8: Write verification reports**

Generate `outputs/verification-report.json` from observed results:

```powershell
$exePath = Resolve-Path 'outputs/son-pet-0.4.0.exe'
$petpackPath = Resolve-Path 'outputs/son-pet.petpack'
$verification = [ordered]@{
  schemaVersion = 1
  deliveryId = 'son-pet'
  executable = [ordered]@{
    path = Split-Path -Leaf $exePath
    sha256 = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
    signed = $false
  }
  petpack = [ordered]@{
    path = Split-Path -Leaf $petpackPath
    sha256 = (Get-FileHash -LiteralPath $petpackPath -Algorithm SHA256).Hash
  }
  automated = $automatedResults
  manual = $manualResults
  interactionCycles = [ordered]@{
    count = 50
    unexpectedResize = 0
    unexpectedDisplacement = 0
  }
  unverified = $unverifiedResults
  completedAt = [DateTime]::UtcNow.ToString('o')
}
$verification | ConvertTo-Json -Depth 12 |
  Set-Content -LiteralPath 'outputs/verification-report.json' -Encoding utf8NoBOM
```

Populate `$automatedResults`, `$manualResults`, and `$unverifiedResults` from the checks performed in Steps 1–7. The report must never claim a manual check that was not actually performed.

- [ ] **Step 9: Final integrity check**

Run:

```powershell
Get-FileHash outputs/son-pet-0.4.0.exe -Algorithm SHA256
Get-FileHash outputs/son-pet.petpack -Algorithm SHA256
python skills/desktop-pet-maker/scripts/petpack_tool.py validate outputs/son-pet.petpack
git status --short
```

Expected: hashes match both reports, the copied package validates, and only intentionally untracked/generated deliverables remain.
