### Task 1: Lock the Slow Timing Contract

**Files:**
- Modify: `scripts/test-bestie-petpack.js:82-90`
- Modify: `pets/library/xiaomei-xiaotian/pet.json:94-106`

**Interfaces:**
- Consumes: existing manifest action `animations["perch-milk-tea"]`.
- Produces: exact duration contract `[600, 650, 850, 650, 650, 600]` while preserving six frames and loop flags.

- [ ] **Step 1: Add a failing timing assertion**

Add after the existing perch assertions, using the validated packed manifest:

```js
assert.deepStrictEqual(
  manifest.animations['perch-milk-tea'].durations,
  [600, 650, 850, 650, 650, 600]
);
assert.strictEqual(manifest.animations['perch-milk-tea'].holdLastFrame, false);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:bestie`

Expected: FAIL showing the actual six `200` values differ from the expected slow durations.

- [ ] **Step 3: Update only the manifest timing**

Change the action entry to:

```json
"durations": [600, 650, 850, 650, 650, 600],
"loop": true,
"holdLastFrame": false
```

Do not change frame paths, action id, scale, schema version, or interaction mapping. Rebuild once so the package/library parity assertion reflects the timing change:

```text
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:bestie`

Expected: `test-bestie-petpack: ok`.

