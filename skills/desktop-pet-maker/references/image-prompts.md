# Image prompt contract

Use one call per strip. Replace `<IDENTITY>` with the stable physical description derived from the photos. Use the same approved master image and prior strips as references whenever possible.

Apply this shared suffix to every prompt:

```text
Preserve exactly the same pet identity: <IDENTITY>.
Use a polished soft 2D game-sprite illustration with a clear silhouette at 150px display size.
Lay out exactly the requested frames in one horizontal row of equal cells, in temporal order.
Use one complete pet per cell, identical scale, camera angle, center alignment, and ground baseline.
Treat every cell as a strict invisible containment box. Keep every visible pixel of ears, whiskers, paws, fur, and the complete natural tail tip inside its own cell.
Reserve at least 12% of each cell width as untouched green gutter on both the left and right, plus generous green padding above and below. A slightly smaller pet is better than any crop or spill.
Keep the torso at the same visual size and screen position in every frame. Do not zoom, pan, recenter, or change camera distance between frames.
The tail must end in a natural rounded or tapered tip, never a flat vertical or diagonal cut. No pet pixel may cross into a neighboring cell.
Use a perfectly flat solid #00ff00 chroma-key background with no separators.
No crop, text, labels, borders, grid lines, floor, shadows, props, extra animals, motion marks, watermark, or green on the pet.
```

## Master

```text
Create one full-body three-quarter standing master character. Preserve the pet's recognizable coat markings, face, ears, eyes, muzzle, body proportions, legs, and the complete tail through its natural tip. Pose it cautiously looking upward. Center it with generous padding.
```

## Idle — 4 frames

```text
Create exactly four loop frames: alert standing, gentle inhale, soft blink with a tiny head dip, and exhale returning toward frame one. Keep motion subtle but visible.
```

## Walk — 6 frames

```text
Create exactly six smooth loop frames walking toward the right: contact, down, passing, up, opposite contact, opposite passing. Show real alternating legs and weight transfer with subtle tail and fur follow-through.
```

## Sit — 4 frames

```text
Create exactly four transition frames: standing, lowering hindquarters, nearly seated while front paws adjust, and fully seated looking upward. Frame four must be a stable hold pose.
```

## Sleep — 4 frames

```text
Create exactly four loop frames of the pet already curled and lying asleep: relaxed pose, inhale, tiny ear movement, and exhale with subtle tail-tip movement. Do not draw Z letters or motion lines.
```

## Reaction — 4 frames

```text
Create exactly four personality reaction frames using only subtle pose changes: gently startled tuck, cautious recognition, one small paw or head movement, and a happy settled look upward. Lock the torso size, torso center, feet baseline, and camera distance across all four frames so rapid replay never looks like zooming or panning. Do not bake hearts into the art.
```
