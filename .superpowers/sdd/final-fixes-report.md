# Final review fixes report

## Scope

Resolved all three Important findings from the final review without rebuilding the customer EXE or customer delivery artifacts.

## Changes

1. Both manifest validators now apply the same structural, frame-path, duration, duplicate-path, PNG-extension, and scale checks to every animation referenced by `interactionActions`. An interaction mapping to `climb: {}` is rejected by both implementations.
2. Window-edge classification now selects the nearest edge within the threshold. The established `top`, `bottom`, `left`, `right` priority is used only when distances are equal within `1e-6` DIP.
3. Schema-v1 validators continue accepting legacy `behavior.random` entries whose state is `sleep`. At runtime, `chooseBehavior` defensively filters those entries before weighted selection and uses a sleep-free fallback if filtering leaves no choices. The new-manifest template contains only `walk`, `sit`, and `reaction`.
4. The tracked `xiaogou.petpack` validation fixture was deterministically rebuilt with its random `sleep` entry removed so the stricter invariant holds for the repository demo package.

## TDD evidence

RED was observed before production edits:

- JavaScript validator accepted `interactionActions.climb -> animations.climb = {}`.
- Python validator accepted the same malformed animation.
- A first revision rejected legacy schema-v1 `behavior.random` sleep entries, exposing a compatibility regression.
- Edge classification returned `top` for a pointer 30 DIP from top and 1 DIP from left.
- The player fallback test found a `sleep` entry.

The compatibility follow-up RED cycle demonstrated that both validators rejected a legacy sleep entry and that the real `chooseBehavior` implementation selected that entry. The GREEN implementation restored validator acceptance while filtering sleep only at runtime.

GREEN after the minimal implementation:

- `node scripts/test-petpack-security.js` — passed.
- `python -m unittest discover -s skills/desktop-pet-maker/scripts -p test_petpack_tool.py -v` — 7 passed.
- `node scripts/test-window-interactions.js` — passed.
- `node scripts/test-interaction-controller.js` — passed.
- `npm test` — passed: all JavaScript checks, 14 Python tests, and demo package validation.

## Artifact boundary

No customer EXE, `son-pet.petpack`, build report, or verification report was rebuilt in this change.
