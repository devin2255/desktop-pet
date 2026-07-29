# `.petpack` schema version 1

A `.petpack` is a ZIP archive with a different extension. Paths use `/`, are relative to the archive root, and must never contain `..`.

```text
pet.json
preview.png
animations/
  idle/01.png ...
  walk/01.png ...
  sit/01.png ...
  sleep/01.png ...
  reaction/01.png ...
```

Manifest fields:

- `schemaVersion`: required integer `1`.
- `packageVersion`: recommended package revision such as `1.0.0`; increment it when updating a built-in package.
- `id`: required lowercase ASCII letters, numbers, and hyphens; 2–48 characters.
- `name`: required display name.
- `personality`: array of short strings.
- `preview`: required relative PNG path.
- `normalizationMetric`: optional scale-validation mode. New packages use `alpha-area-v1` to compare opaque visual mass; packages that omit it retain legacy `bbox-span-v1` validation for schema-v1 compatibility.
- `animations`: required object keyed by action.
- `behavior.random`: weighted state definitions used by the player.

Each animation contains:

- `frames`: ordered relative PNG paths.
- `durations`: milliseconds, same length as `frames`.
- `loop`: boolean.
- `holdLastFrame`: optional boolean for transitions such as `sit` and `reaction`.
- `scale`: optional display multiplier from `0.5` to `1.5`. Keep most actions at `1`; use a smaller value for a lying pose when it otherwise looks oversized.

Standard action counts are idle 4, walk 6, sit 4, sleep 4, and reaction 4. The player may accept future optional actions, but the maker must produce all five standard actions.

The archive must contain only the manifest, preview, and referenced assets. Every PNG must have an alpha channel, non-empty visible pixels, transparent corners, and no material green-screen residue.

All exported frames must use the same transparent canvas size and baseline. Normalize visual scale across all actions, not merely within each action strip, so switching poses does not make the pet jump in size.
