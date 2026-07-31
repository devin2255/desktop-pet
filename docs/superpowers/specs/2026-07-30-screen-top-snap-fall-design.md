# Screen-Top Snap and Fall Design

## Problem

Dragging the pet to the physical top of a display can leave a visible gap or
produce inconsistent release behavior. The current drag path clamps the
window by the most recently reported alpha insets, but it does not explicitly
snap the current visible alpha top to the display top when the pointer reaches
the top activation band. The release path then recomputes the fall condition
from mutable frame insets.

## Approved Behavior

- The top activation band is the first 6 DIP of the current display.
- While dragging inside that band, place the Electron window so the current
  visible alpha top is exactly the display's physical top.
- Never move visible body pixels above the display merely to follow the
  pointer. Only transparent canvas may be outside the display.
- On release, a valid normal application window under the pointer retains
  priority over the screen-top fall.
- Without a valid target window, a release that was snapped to the screen top
  starts `fall -> impact -> recover -> normal`.
- Small, medium, and large sizes use the same visible-pixel rule.
- Existing window-top perch, side climb, bottom hang, DPI conversion, and
  multi-display selection remain unchanged.

## State and Data Flow

`moveDrag(pointer)` selects the display from the pointer. It computes the
normal visible-bounds-clamped position, then, when the pointer is within
6 DIP of `display.bounds.y`, overrides only `y` with
`display.bounds.y - visibleInsets.top`. The controller records the display ID
and snapped state for the active drag.

`endDrag(pointer)` discovers targets first. If a valid target exists it keeps
the existing window interaction precedence. Otherwise it starts falling when
the drag is currently top-snapped. As a defensive fallback, it also accepts a
fresh visible-top measurement within 6 DIP.

Starting another drag, finishing a drag, attaching, falling, returning to
normal, or disposing clears the snap state so it cannot leak across
interactions.

## Testing

- Reproduce a drag whose ordinary pointer delta leaves a visible gap even
  though the pointer is at display y=0; assert the window snaps so visible top
  equals y=0.
- Repeat with different top insets representing small, medium, and large.
- Assert releasing a snapped drag without a window starts the complete fall
  sequence.
- Assert a valid window under the same pointer still wins.
- Assert leaving the 6 DIP band clears snap state and does not fall.
- Run the complete JavaScript/Python/package suite and rebuild the customer
  EXE.
