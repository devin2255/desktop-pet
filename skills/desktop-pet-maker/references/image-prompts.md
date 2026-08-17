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

If the subject is human, keep complete hands, feet, hair, and clothing hems inside each cell; ignore tail-tip wording. Never bake windows, window frames, floors, guns, or other props unless the user explicitly requested that prop.

## Drag — 6 frames

```text
Create exactly six loop frames of the character being carried or dragged toward the right: body bunched, limbs off the ground or scrambling, weight shifting, a small wobble, opposite shift, and back toward frame one. Do not draw a standing walk cycle. No window, floor, or hand of another person.
```

## Climb — 6 frames

```text
Create exactly six loop frames climbing upward along an invisible vertical edge on the character's right side: reach, pull, step, reach, pull, step. Hands and chest face the invisible wall; the butt must not be the part touching the wall. Do not draw the window or wall.
```

## Perch — 4 frames

```text
Create exactly four loop frames sitting on an invisible window-top: weight on the butt, both legs hanging forward off the ledge, leisurely ALTERNATING lower-leg swings from the knees like a person idly dangling their feet. Never swing both legs in the same direction at once. Frame 1: left lower leg gently forward, right shin near vertical. Frame 2: left shin returning toward vertical, right lower leg starting forward. Frame 3: right lower leg gently forward, left shin near vertical. Frame 4: right shin returning toward vertical, left lower leg starting forward. Upper body, hands gripping the unseen ledge, and hip position stay locked. The butt is the contact point. Do not draw the window, sill, or wall.
```

## Slipper — 4 frames

```text
Create exactly four transition frames of the same standing character taking off one flip-flop and raising it like a threatening paddle: glance down at the right foot, reach and pull the right flip-flop off, hold the flip-flop in the right hand at the waist with the right foot now bare and the left flip-flop still on, then raise the flip-flop beside the head as if about to smack someone. Do not draw a window, floor, extra shoes, or any prop except the one held flip-flop.
```

## Hang — 4 frames

```text
Create exactly four loop frames hanging from an invisible bottom edge: both hands gripping above the head, body dangling, a tiny sway, and return. Do not draw the window.
```

## Fall — 4 frames

```text
Create exactly four loop frames falling downward: lose support, tuck slightly, rotate a little, and continue falling. No ground, no window, no motion lines.
```

## Impact — 4 frames

```text
Create exactly four transition frames landing: falling contact, compress into a sit, settle, and a stable seated-on-the-ground hold. Do not squash the body into a cartoon smear.
```

## Recover — 6 frames

```text
Create exactly six transition frames getting back up: seated, shift weight, rise, a small pat or shake-off, almost standing or kneeling in the default idle posture, and a stable hold that matches idle body size.
```

## Crawl — 6 frames

```text
Create exactly six smooth loop frames kneeling-crawling toward the right: both knees on the unseen ground, hands walking, hips low, alternating limbs. Do not stand up in any frame.
```

## Kowtow — 4 frames

```text
Create exactly four transition frames of a respectful kowtow: upright, folding forward, forehead toward the ground, and returning. Keep the same outfit and identity. Optional companion strip kowtow-crawl must stay kneeling throughout.
```
