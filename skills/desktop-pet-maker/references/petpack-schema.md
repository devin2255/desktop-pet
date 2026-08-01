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
- `startupGreeting`: optional custom greeting shown when the pet first appears or when switching to this pet. If omitted or blank after trimming, the player uses `我是${name}。` on startup and `你好，我是${name}。` when switching. Maximum 80 characters.
- `preview`: required relative PNG path.
- `normalizationMetric`: optional scale-validation mode. New packages use `alpha-area-v1` to compare opaque visual mass; packages that omit it retain legacy `bbox-span-v1` validation for schema-v1 compatibility.
- `animations`: required object keyed by action.
- `behavior.random`: weighted state definitions used by the player.
- `interactionActions`: optional object that maps window-interaction roles to animation actions.

Each animation contains:

- `frames`: ordered relative PNG paths.
- `durations`: milliseconds, same length as `frames`.
- `loop`: boolean.
- `holdLastFrame`: optional boolean for transitions such as `sit` and `reaction`.
- `scale`: optional display multiplier from `0.5` to `1.5`. Keep most actions at `1`; use a smaller value for a lying pose when it otherwise looks oversized.

Standard action counts are idle 4, walk 6, sit 4, sleep 4, and reaction 4. The player may accept future optional actions, but the maker must produce all five standard actions.

## Window interaction actions

`interactionActions` may contain only these seven logical roles. Each configured value is an object with a required `action` string that names an animation in `animations`, plus an optional normalized `anchor`:

```json
{
  "interactionActions": {
    "drag": { "action": "walk" },
    "perch": { "action": "sit", "anchor": { "x": 0.5, "y": 0.7 } }
  }
}
```

| Role | Purpose | Fallback action when not mapped |
| --- | --- | --- |
| `drag` | User moves the pet | `walk` |
| `climb` | Pet moves along a window edge | `walk` |
| `perch` | Pet settles on an edge | `sit` |
| `hang` | Pet holds onto an edge | `sit` |
| `fall` | Pet drops from an attachment | `reaction` |
| `impact` | Pet lands after a fall | `reaction` |
| `recover` | Pet returns to normal behavior | `idle` |

`anchor` is the attachment point inside the pet's visible bounds: `x: 0` is the left edge and `x: 1` the right edge; `y: 0` is the top edge and `y: 1` the bottom edge. Both coordinates are finite numbers in the inclusive range `0..1`. Omit `anchor` to use the player's default attachment point.

The archive must contain only the manifest, preview, and referenced assets. Every PNG must have an alpha channel, non-empty visible pixels, transparent corners, and no material green-screen residue.

All exported frames must use the same transparent canvas size and baseline. Normalize visual scale across all actions, not merely within each action strip, so switching poses does not make the pet jump in size.
