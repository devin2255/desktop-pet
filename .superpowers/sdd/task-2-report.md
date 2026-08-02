# Task 2 Report: behavior 项 `speechAudio` 支持

**Branch:** `feat/laopo-pet`  
**Commit:** `95d2f59` — feat: support optional speechAudio on behavior items

## Summary

Implemented optional `speechAudio` on `behavior.random` and `behavior.perched` items so roaming/perched dialogue can play pre-recorded audio via `pet:state`. No laopo-specific assets; generic player/validator only.

## TDD Flow

1. Added failing tests in `test-petpack-security.js`, `test-renderer-interaction.js`, `test-interaction-controller.js`
2. Confirmed failures (referencedFiles missing behavior audio; renderer ignored state speechAudio; perched idle did not forward speechAudio)
3. Implemented validator, main, renderer, interaction-controller, Python tool
4. Re-ran focused tests — all PASS

## Files Changed

| File | Change |
|------|--------|
| `src/petpack-validator.js` | Collect `behavior.random`/`perched` `speechAudio` in `referencedFiles`; validate extension in `validateBehaviorList` |
| `skills/desktop-pet-maker/scripts/petpack_tool.py` | Mirror referenced_files + validate_behavior_list speechAudio rules |
| `src/main-v3.js` | `sendState` emits `speechAudio`; resolves relative paths to `pet-asset:` URLs; `runBehavior` passes resolved audio |
| `src/renderer-v3.js` | `setState`/`onState` prefer state-level `speechAudio` over context-menu fallback |
| `src/interaction-controller.js` | Perched idle `emitRole` forwards `speechAudio` (relative path; main resolves) |
| `scripts/test-petpack-security.js` | referencedFiles + invalid extension assertions |
| `scripts/test-renderer-interaction.js` | behavior speechAudio playback via `pet:state` |
| `scripts/test-interaction-controller.js` | perched idle speechAudio passthrough |

## Interfaces

- **Consumes:** `behavior.random[].speechAudio?`, `behavior.perched[].speechAudio?` — package-relative path (`mp3`/`wav`/`ogg`)
- **Produces:** `pet:state` payload includes optional `speechAudio` (resolved `pet-asset:` URL or empty string)

## Test Results

```
node scripts/test-renderer-interaction.js     PASS
node scripts/test-petpack-security.js         PASS
node scripts/test-interaction-controller.js   PASS
node scripts/test-startup-greeting.js         PASS (regression)
node --check src/{main-v3,renderer-v3,petpack-validator,interaction-controller}.js  PASS
```

## Self-Review

**Correctness:** Matches brief verbatim. Main resolves URLs once (skips already-resolved `pet-asset:`). Renderer prefers explicit state audio over context-menu lookup. Perched controller passes relative paths; main wrapper resolves.

**Scope:** No laopo petpack, no schema doc update (brief did not require). Context menu path unchanged (still via `publicManifest` + `resolveSpeechAudio` fallback).

**Concerns:**
- `runContextMenuAction` still does not pass `speechAudio` on `pet:state`; renderer relies on manifest lookup — pre-existing, unchanged.
- Python unit tests for behavior speechAudio validation not added (brief only required JS security test); parity is in `petpack_tool.py` shape validator.

## Ready For

Task 3+ can attach laopo `behavior.random` entries with `speechAudio: "audio/serve-tea.mp3"` etc.; player will validate, reference, resolve, and play.
