---
name: desktop-pet-maker
description: Create a complete Windows desktop pet from one to eight pet photos in this repository. Use when Codex is asked to make a desktop pet, turn pet photos into animations, build a `.petpack`, or deliver a customer-specific portable EXE.
---

# Desktop Pet Maker repository entry

1. Read `../../../skills/desktop-pet-maker/SKILL.md` completely and follow its animation, processing, privacy, and validation workflow. Resolve every relative path in that skill from `skills/desktop-pet-maker/`.
2. Follow the repository root `AGENTS.md`, including its default customer-delivery target and release gates.
3. After producing a validated `.petpack`, run `npm run build:customer` with the requested program name and delivery id.
4. Actually launch and verify the portable EXE. Deliver the EXE, `build-report.json`, and a clear list of verified and unverified items.

Do not stop at generated frames or a `.petpack` when the user requested a usable desktop pet.
