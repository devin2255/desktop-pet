# Task 2 Report: 校验与能力门

## Scope

- Added `hasDuoSlack(manifest)` to `src/capability-gates.js`.
- Extended JS petpack validation in `src/petpack-validator.js` for optional `duo.slack`.
- Extended Python petpack validation in `skills/desktop-pet-maker/scripts/petpack_tool.py` with matching `duo.slack` rules.
- Added focused tests in:
  - `scripts/test-capability-gates.js`
  - `scripts/test-sequences-schema.js`
  - `skills/desktop-pet-maker/scripts/test_petpack_tool.py`

No `src/main-v3.js`, menu, IPC, preload, renderer, or Task 3 runtime wiring was added.
No git commit was created.

## Requirements Covered

- `hasDuoSlack(manifest)` returns true only when `hasDuo(manifest)` is true and `manifest.duo.slack` is a non-array object.
- JS validator accepts legal `duo.slack`.
- JS validator rejects empty/missing `clips`.
- JS validator rejects `jumpAction` or `carryAction` when missing, blank, or not pointing to a root-level animation.
- JS validator checks `enterLabel` and `leaveLabel` as optional 1-24 character strings.
- JS validator checks `clips` as 1-8 safe relative `.mp4`/`.webm` paths, case-insensitive.
- JS validator checks clip files when `requireFiles === true`.
- JS `referencedFiles(manifest)` includes `duo.slack.clips` so packaged clips are allowed and required.
- JS validator checks optional `boardSecids` as 1-8 non-empty strings.
- Python validator mirrors the same `duo.slack` shape/action/label/clips/boardSecids rules.
- Python `referenced_files(manifest)` includes `duo.slack.clips`.
- Python directory validation treats `.mp4`/`.webm` clips as video assets instead of PNG frames.

## TDD RED

After adding tests and before production implementation, I ran:

```text
node scripts/test-capability-gates.js
```

Expected failure:

```text
TypeError: hasDuoSlack is not a function
```

I also ran:

```text
node scripts/test-sequences-schema.js
```

Expected failure:

```text
AssertionError [ERR_ASSERTION]: Missing expected exception.
expected: /clips/
```

And:

```text
python -m unittest skills.desktop-pet-maker.scripts.test_petpack_tool
```

Expected failures:

```text
FAIL: test_duo_slack_rejects_empty_clips
AssertionError: ValueError not raised

FAIL: test_duo_slack_validates
AssertionError: 'video/slack/01.webm' not found in referenced_files(...)
```

## GREEN

After implementing the minimal production changes, I reran the required target tests:

```text
node scripts/test-capability-gates.js
```

Result:

```text
test-capability-gates: ok
```

```text
node scripts/test-sequences-schema.js
```

Result:

```text
test-sequences-schema: ok
```

```text
python -m unittest skills.desktop-pet-maker.scripts.test_petpack_tool
```

Result:

```text
Ran 15 tests in 0.314s
OK
```

## Files Changed

- `src/capability-gates.js`
- `src/petpack-validator.js`
- `scripts/test-capability-gates.js`
- `scripts/test-sequences-schema.js`
- `skills/desktop-pet-maker/scripts/petpack_tool.py`
- `skills/desktop-pet-maker/scripts/test_petpack_tool.py`
- `.superpowers/sdd/task-2-report.md`

## Concerns

- The working tree already contained many unrelated uncommitted Task 1/duo changes before this task. I did not revert or commit them.
- I only ran the brief-requested focused tests for Task 2, not the full repository suite.
