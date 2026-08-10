### Task 3: Rebuild, Validate, and Runtime-Check the Delivery

**Files:**
- Regenerate: `pets/packages/xiaomei-xiaotian.petpack`
- Verify: `pets/library/xiaomei-xiaotian/pet.json`
- Verify: `scripts/test-bestie-petpack.js`

**Interfaces:**
- Consumes: accepted six frames and slow timing contract from Tasks 1–2.
- Produces: validated local `.petpack` with the new synchronized milk-tea loop.

- [ ] **Step 1: Rebuild the package**

Run:

```text
python skills/desktop-pet-maker/scripts/petpack_tool.py build pets/library/xiaomei-xiaotian pets/packages/xiaomei-xiaotian.petpack
```

Expected: exits 0 and writes the package without changing unrelated assets.

- [ ] **Step 2: Validate package and automated regressions**

Run:

```text
npm run test:bestie
python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/xiaomei-xiaotian.petpack
node scripts/test-renderer-interaction.js
python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v
```

Expected: all commands exit 0; package validates as `xiaomei-xiaotian`; all strip safety tests pass.

- [ ] **Step 3: Verify packed parity and unchanged unrelated assets**

Parse library and packed root `pet.json` and assert deep equality. SHA-256 compare every packaged animation asset against the library, and confirm only the six `perch-milk-tea` images differ from the pre-task package snapshot.

- [ ] **Step 4: Run a bounded player smoke test**

Launch `npm start` and verify no startup exception. If GUI control is available, attach the pet to a window top and observe at least 10 complete loops, confirming two persistent cups, synchronized sipping, slow synchronized leg swing, stable scale/baseline, transparent background, target-window following, drag release, and unchanged side-rest behavior. If GUI control is unavailable, explicitly report these visual checks as unverified.

- [ ] **Step 5: Review scope and delivery state**

Run `git status --short` and scoped diffs. Do not force-add ignored customer/reference/generated assets. Commit only the tracked regression test if changed; leave the rebuilt `.petpack`, manifest, and frames as local delivery artifacts according to repository policy.
