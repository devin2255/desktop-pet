# Windows Topmost Guard Design

## Problem

The visible Electron pet window can lose Windows `WS_EX_TOPMOST` after another
application window opens. Because Windows applies z-order to the complete
window rectangle, the part above the new window remains visible while the
overlapping legs disappear behind it.

## Approved Behavior

- Use Electron's Windows `screen-saver` always-on-top level instead of
  `floating`.
- Centralize topmost behavior in a small guard with `ensure()`, `setEnabled()`,
  and `isEnabled()`.
- `ensure()` reasserts the level and calls `moveTop()` without focusing the
  pet.
- Run `ensure()` when the pet is created, shown, and changes interaction
  state.
- If Electron reports `always-on-top-changed=false` while the feature is
  enabled, reassert it asynchronously.
- Preserve the tray menu switch. Once the user disables always-on-top, the
  guard must not restore it until explicitly enabled again.
- Do not use a periodic watchdog.

## Verification

- Unit-test enabled, disabled, re-enabled, destroyed-window, and move-to-top
  behavior.
- Assert the new module is included in normal and customer packages.
- Run the full suite and rebuild the customer EXE.
- Inspect the rebuilt running pet's titled main HWND and require
  `WS_EX_TOPMOST=true`.

