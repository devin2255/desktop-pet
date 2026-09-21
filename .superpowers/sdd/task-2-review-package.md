# Task 2 review package (working tree)

## git diff --stat

 scripts/test-capability-gates.js                   |  23 +++
 scripts/test-sequences-schema.js                   | 126 ++++++++++++++
 skills/desktop-pet-maker/scripts/petpack_tool.py   | 188 ++++++++++++++++++++-
 .../desktop-pet-maker/scripts/test_petpack_tool.py | 136 ++++++++++++++-
 src/capability-gates.js                            |  18 ++
 src/petpack-validator.js                           | 180 +++++++++++++++++++-
 6 files changed, 652 insertions(+), 19 deletions(-)

## git diff -U8

diff --git a/scripts/test-capability-gates.js b/scripts/test-capability-gates.js
index 990caad..d9a99cd 100644
--- a/scripts/test-capability-gates.js
+++ b/scripts/test-capability-gates.js
@@ -1,28 +1,42 @@
 'use strict';
 const assert = require('assert');
 const {
   hasMarketSequences,
   hasCallHangupSequence,
   hasWatch,
+  hasDuo,
+  hasDuoTent,
+  hasDuoSlack,
   watchMenuLabel,
   taskProviderFromConfig
 } = require('../src/capability-gates');
 
 const brother = {
   watch: { keywords: {}, menuLabel: '鐢婚ゼ闆疯揪' },
   sequences: {}
 };
 assert.strictEqual(hasWatch(brother), true);
 assert.strictEqual(hasMarketSequences(brother), false);
 assert.strictEqual(hasCallHangupSequence(brother), false);
 assert.strictEqual(watchMenuLabel(brother), '鐢婚ゼ闆疯揪');
 assert.strictEqual(taskProviderFromConfig({}), 'feishu');
 assert.strictEqual(taskProviderFromConfig({ tasks: { provider: 'mock' } }), 'mock');
+assert.strictEqual(hasDuo({}), false);
+assert.strictEqual(hasDuo({ duo: { members: [{}, {}] } }), true);
+assert.strictEqual(hasDuo({ duo: null }), false);
+assert.strictEqual(hasDuoTent({}), false);
+assert.strictEqual(hasDuoTent({ duo: { members: [{}, {}] } }), false);
+assert.strictEqual(hasDuoTent({ duo: { members: [{}, {}], tent: { action: 'sit' } } }), true);
+assert.strictEqual(hasDuoTent({ duo: { members: [{}, {}], tent: null } }), false);
+assert.strictEqual(hasDuoSlack({}), false);
+assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}] } }), false);
+assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}], slack: { jumpAction: 'slack-jump' } } }), true);
+assert.strictEqual(hasDuoSlack({ duo: { members: [{}, {}], slack: null } }), false);
 
 const niulaiLike = {
   watch: { menuLabel: '鍔炲叕闆疯揪' },
   sequences: {
     'market-bull': { stages: [{ action: 'fly' }] },
     'boss-call': { stages: [{ action: 'call-shout', messageLoop: true }, { action: 'call-mom-kick', onContact: true }] }
   }
 };
@@ -38,12 +52,21 @@ function testRuntimeCapabilitiesAreManifestGated() {
   assert.match(src, /function canRunOfficeBus\(\) \{[\s\S]*hasWatch\(activeManifest\)/, 'office bus requires the active petpack watch capability');
   assert.match(src, /function canPollCallHangup\(\) \{[\s\S]*hasCallHangupSequence\(activeManifest\)/, 'call polling requires the active petpack hangup sequence');
   assert.match(src, /function canWatchMarket\(\) \{[\s\S]*hasMarketSequences\(activeManifest\)/, 'market watcher requires the active petpack market sequences');
   assert.match(src, /enabled: canWatchMarket\(\)/, 'market ticker visibility must use the combined market gate');
   assert.match(src, /callHangup: \{[\s\S]*enabled: canPollCallHangup\(\)/, 'DingTalk adapter receives a manifest-gated call polling configuration');
   assert.match(src, /applyLoadedWatchConfig\(loadWatchConfig\([\s\S]*manifestWatch: next\.watch/);
   assert.match(src, /restartOfficeBus\(\);\s+restartMarketWatcher\(\)/, 'pet switch reloads and restarts runtime capabilities');
   assert.match(src, /restartMarketWatcher = \(\) => \{[\s\S]*marketWatcher\?\.stop\(\);[\s\S]*marketWatcher\.start\(\)/, 'market restarts only through its manifest-aware gate');
+  assert.match(src, /hasDuo\(activeManifest\)/, 'duo windows/gestures are gated by the active petpack duo capability');
+  assert.match(src, /hasDuoTent\(activeManifest\)/, 'tent standby is gated by duo.tent');
+  assert.match(src, /id === 'duo-tent'/, 'main process recognizes the tent menu id');
+  assert.match(src, /function canRunOfficeBus\(\) \{[\s\S]*duo\.mode\(\) === 'tent'/, 'tent mode silences the office bus');
+  assert.match(src, /startAtLast/, 'tent pose snaps to the hold frame instead of replaying sit');
+  assert.match(src, /pet:duo-pointer-down/, 'main process wires the duo pointer-down IPC channel');
+  assert.match(src, /createDuoController/, 'main process owns a duo controller instance');
+  assert.match(src, /\.find\(\s*\(m\)\s*=>\s*m\.watch\s*===?\s*true/, 'watch hits target the watch:true duo member');
+  assert.match(src, /function targetWatchWindow\(/, 'watch dispatch uses a window helper');
 }
 
 testRuntimeCapabilitiesAreManifestGated();
 console.log('test-capability-gates: ok');
diff --git a/scripts/test-sequences-schema.js b/scripts/test-sequences-schema.js
index 08bd218..6818bb8 100644
--- a/scripts/test-sequences-schema.js
+++ b/scripts/test-sequences-schema.js
@@ -310,9 +310,135 @@ for (const timeoutMs of [10001, -1, 1.5]) {
     }), '', false),
     /timeoutMs/,
     `timeoutMs ${timeoutMs} must throw`
   );
 }
 
 assert(referencedFiles(bossCallManifest()).has('audio/call-mom.mp3'));
 
+function memberAnimations(memberId) {
+  return {
+    idle: makeAnimation(`${memberId}/idle`, 4, true),
+    walk: makeAnimation(`${memberId}/walk`, 6, true),
+    sit: makeAnimation(`${memberId}/sit`, 4, false),
+    sleep: makeAnimation(`${memberId}/sleep`, 4, true),
+    reaction: makeAnimation(`${memberId}/reaction`, 4, false)
+  };
+}
+
+function duoManifest(overrides = {}) {
+  return baseManifest({
+    duo: {
+      gesture: {
+        menuSlopPx: 12,
+        commitPx: 48,
+        snapProgress: 0.5
+      },
+      members: [
+        {
+          id: 'judge',
+          side: 'left',
+          name: '鍏勫紵鍒ゅ畼',
+          watch: true,
+          animations: memberAnimations('judge')
+        },
+        {
+          id: 'floral',
+          side: 'right',
+          name: '鑺辫寮?,
+          watch: false,
+          animations: memberAnimations('floral')
+        }
+      ],
+      ...overrides
+    }
+  });
+}
+
+assert.doesNotThrow(() => validateManifest(duoManifest(), '', false));
+
+assert.throws(
+  () => validateManifest(duoManifest({
+    members: [
+      {
+        id: 'judge',
+        side: 'left',
+        name: '鍏勫紵鍒ゅ畼',
+        animations: memberAnimations('judge')
+      }
+    ]
+  }), '', false),
+  /members/
+);
+
+assert.throws(
+  () => validateManifest(duoManifest({
+    members: [
+      {
+        id: 'judge',
+        side: 'left',
+        name: '鍏勫紵鍒ゅ畼',
+        animations: memberAnimations('judge')
+      },
+      {
+        id: 'floral',
+        side: 'left',
+        name: '鑺辫寮?,
+        animations: memberAnimations('floral')
+      }
+    ]
+  }), '', false),
+  /side/
+);
+
+assert.throws(
+  () => {
+    const manifest = duoManifest();
+    manifest.duo.members[0].animations.idle.frames[0] = manifest.animations.idle.frames[0];
+    validateManifest(manifest, '', false);
+  },
+  /鍔ㄧ敾璺緞鍐茬獊/
+);
+
+assert.doesNotThrow(() => validateManifest(duoManifest({
+  unfoldAction: 'reaction',
+  foldAction: 'idle'
+}), '', false));
+assert.throws(
+  () => validateManifest(duoManifest({ unfoldAction: 'missing-kick' }), '', false),
+  /unfoldAction/
+);
+
+assert.doesNotThrow(() => validateManifest(duoManifest({
+  tent: { action: 'sit', enterLabel: '鏀捣鏉?, leaveLabel: '鏀惰捣鏉?, openProgress: 0.48 }
+}), '', false));
+assert.throws(
+  () => validateManifest(duoManifest({ tent: { openProgress: 0.2 } }), '', false),
+  /openProgress/
+);
+assert.throws(
+  () => validateManifest(duoManifest({ tent: { action: 'missing-sit' } }), '', false),
+  /tent\.action/
+);
+assert.throws(
+  () => validateManifest(duoManifest({ tent: { enterLabel: '' } }), '', false),
+  /enterLabel/
+);
+
+assert.doesNotThrow(() => validateManifest(duoManifest({
+  slack: { jumpAction: 'idle', carryAction: 'walk', clips: ['video/slack/01.webm'] }
+}), '', false));
+assert.throws(
+  () => validateManifest(duoManifest({ slack: { jumpAction: 'idle', carryAction: 'walk', clips: [] } }), '', false),
+  /clips/
+);
+assert.throws(
+  () => validateManifest(duoManifest({
+    slack: { jumpAction: 'missing', carryAction: 'walk', clips: ['video/slack/01.webm'] }
+  }), '', false),
+  /jumpAction/
+);
+
+assert(referencedFiles(duoManifest()).has('animations/judge/idle/01.png'));
+assert(referencedFiles(duoManifest()).has('animations/floral/reaction/04.png'));
+
 console.log('test-sequences-schema: ok');
diff --git a/skills/desktop-pet-maker/scripts/petpack_tool.py b/skills/desktop-pet-maker/scripts/petpack_tool.py
index dc4867c..eeef5cf 100644
--- a/skills/desktop-pet-maker/scripts/petpack_tool.py
+++ b/skills/desktop-pet-maker/scripts/petpack_tool.py
@@ -33,24 +33,34 @@ def safe_relative(value: str) -> Path:
         raise ValueError(f"unsafe relative path: {value}")
     for part in pure.parts:
         if part in {"", ".", ".."} or re.search(r'[:<>"|?*\x00-\x1f]', part) or part.endswith((".", " ")):
             raise ValueError(f"unsafe relative path: {value}")
     return Path(*pure.parts)
 
 
 AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg"}
+VIDEO_EXTENSIONS = {".mp4", ".webm"}
 
 
 def referenced_files(manifest: dict) -> set[str]:
     referenced = {"pet.json", safe_relative(str(manifest.get("preview", ""))).as_posix()}
     for config in manifest.get("animations", {}).values():
         if isinstance(config, dict):
             for frame in config.get("frames", []):
                 referenced.add(safe_relative(str(frame)).as_posix())
+    duo = manifest.get("duo")
+    if isinstance(duo, dict):
+        for member in duo.get("members") or []:
+            if not isinstance(member, dict):
+                continue
+            for config in member.get("animations", {}).values():
+                if isinstance(config, dict):
+                    for frame in config.get("frames", []):
+                        referenced.add(safe_relative(str(frame)).as_posix())
     for item in manifest.get("contextMenuActions") or []:
         if not isinstance(item, dict):
             continue
         if item.get("speechAudio"):
             referenced.add(safe_relative(str(item["speechAudio"])).as_posix())
         for choice in item.get("randomActions") or []:
             if isinstance(choice, dict) and choice.get("speechAudio"):
                 referenced.add(safe_relative(str(choice["speechAudio"])).as_posix())
@@ -79,16 +89,21 @@ def referenced_files(manifest: dict) -> set[str]:
             if not isinstance(pool, dict):
                 continue
             for entries in pool.values():
                 if not isinstance(entries, list):
                     continue
                 for entry in entries:
                     if isinstance(entry, dict) and entry.get("audio"):
                         referenced.add(safe_relative(str(entry["audio"])).as_posix())
+    slack = duo.get("slack") if isinstance(duo, dict) else None
+    if isinstance(slack, dict):
+        for clip in slack.get("clips") or []:
+            if isinstance(clip, str) and clip:
+                referenced.add(safe_relative(clip).as_posix())
     sequences = manifest.get("sequences")
     if isinstance(sequences, dict):
         for sequence in sequences.values():
             if not isinstance(sequence, dict):
                 continue
             for stage in sequence.get("stages") or []:
                 if isinstance(stage, dict) and stage.get("speechAudio"):
                     referenced.add(safe_relative(str(stage["speechAudio"])).as_posix())
@@ -126,38 +141,49 @@ def validate_manifest_shape(manifest: dict) -> list[str]:
     if preview.suffix.lower() != ".png":
         raise ValueError("preview must be a PNG")
     animations = manifest.get("animations")
     if not isinstance(animations, dict):
         raise ValueError("animations must be an object")
 
     frame_paths: list[str] = []
 
-    def validate_animation(action: str, expected: int | None = None) -> None:
-        config = animations.get(action)
+    def validate_animation_from(
+        animation_root: dict,
+        action: str,
+        expected: int | None = None,
+        label: str | None = None,
+    ) -> list[str]:
+        label = label or action
+        config = animation_root.get(action)
         if not isinstance(config, dict):
-            raise ValueError(f"{action}: animation must be an object")
+            raise ValueError(f"{label}: animation must be an object")
         frames = config.get("frames")
         durations = config.get("durations")
         if not isinstance(frames, list) or (len(frames) != expected if expected is not None else not frames):
             expectation = f"{expected}" if expected is not None else "at least 1"
-            raise ValueError(f"{action}: expected {expectation} frame paths")
+            raise ValueError(f"{label}: expected {expectation} frame paths")
         if not isinstance(durations, list) or len(durations) != len(frames):
-            raise ValueError(f"{action}: durations must match frames")
+            raise ValueError(f"{label}: durations must match frames")
         if any(not isinstance(value, int) or isinstance(value, bool) or not 40 <= value <= 10000 for value in durations):
-            raise ValueError(f"{action}: duration must be an integer from 40 to 10000 ms")
+            raise ValueError(f"{label}: duration must be an integer from 40 to 10000 ms")
         scale = config.get("scale", 1)
         if not isinstance(scale, (int, float)) or isinstance(scale, bool) or not 0.5 <= scale <= 1.5:
-            raise ValueError(f"{action}: scale must be a number from 0.5 to 1.5")
+            raise ValueError(f"{label}: scale must be a number from 0.5 to 1.5")
+        normalized_frames: list[str] = []
         for frame_path in frames:
             relative = safe_relative(str(frame_path))
             if relative.suffix.lower() != ".png":
-                raise ValueError(f"{action}: frames must be PNG files")
+                raise ValueError(f"{label}: frames must be PNG files")
             # Allow reused frame paths so actions can ping-pong or settle on a shared pose.
-            frame_paths.append(relative.as_posix())
+            normalized_frames.append(relative.as_posix())
+        return normalized_frames
+
+    def validate_animation(action: str, expected: int | None = None) -> None:
+        frame_paths.extend(validate_animation_from(animations, action, expected))
 
     validated_animations: set[str] = set()
     for action, expected in REQUIRED_ACTIONS.items():
         validate_animation(action, expected)
         validated_animations.add(action)
 
     interaction_actions = manifest.get("interactionActions")
     if interaction_actions is not None:
@@ -228,16 +254,155 @@ def validate_manifest_shape(manifest: dict) -> list[str]:
                         raise ValueError(f"sequences.{sequence_id}.stages[{index}].messageGapMs must be an integer from 0 to 5000")
                 if "duration" in stage:
                     duration = stage["duration"]
                     if not isinstance(duration, int) or isinstance(duration, bool) or not 0 <= duration <= 10000:
                         raise ValueError(f"sequences.{sequence_id}.stages[{index}].duration must be an integer from 0 to 10000")
                 if "waitForClick" in stage and not isinstance(stage["waitForClick"], bool):
                     raise ValueError(f"sequences.{sequence_id}.stages[{index}].waitForClick must be a boolean")
 
+    duo = manifest.get("duo")
+    if duo is not None:
+        if not isinstance(duo, dict):
+            raise ValueError("duo must be an object")
+        gesture = duo.get("gesture")
+        if gesture is not None:
+            if not isinstance(gesture, dict):
+                raise ValueError("duo.gesture must be an object")
+            menu_slop_px = gesture.get("menuSlopPx")
+            if menu_slop_px is not None and (
+                not isinstance(menu_slop_px, int) or isinstance(menu_slop_px, bool) or not 1 <= menu_slop_px <= 40
+            ):
+                raise ValueError("duo.gesture.menuSlopPx must be an integer from 1 to 40")
+            commit_px = gesture.get("commitPx")
+            if commit_px is not None and (
+                not isinstance(commit_px, int) or isinstance(commit_px, bool) or not 20 <= commit_px <= 200
+            ):
+                raise ValueError("duo.gesture.commitPx must be an integer from 20 to 200")
+            snap_progress = gesture.get("snapProgress")
+            if snap_progress is not None and (
+                not isinstance(snap_progress, (int, float))
+                or isinstance(snap_progress, bool)
+                or not math.isfinite(snap_progress)
+                or not 0.2 <= snap_progress <= 0.9
+            ):
+                raise ValueError("duo.gesture.snapProgress must be a number from 0.2 to 0.9")
+        for action_key in ("unfoldAction", "foldAction"):
+            action_name = duo.get(action_key)
+            if action_name is None:
+                continue
+            if not isinstance(action_name, str) or not action_name.strip():
+                raise ValueError(f"duo.{action_key} must be a non-empty string")
+            if action_name not in animations:
+                raise ValueError(f"duo.{action_key} must point to a root animation")
+        members = duo.get("members")
+        if not isinstance(members, list) or len(members) != 2:
+            raise ValueError("duo.members must contain exactly 2 members")
+        root_frame_paths: set[str] = set()
+        for config in animations.values():
+            if not isinstance(config, dict):
+                continue
+            for frame_path in config.get("frames") or []:
+                root_frame_paths.add(safe_relative(str(frame_path)).as_posix())
+        seen_member_ids: set[str] = set()
+        seen_sides: set[str] = set()
+        member_frame_paths: set[str] = set()
+        pet_id_pattern = re.compile(r"[a-z0-9][a-z0-9-]{1,47}")
+        for index, member in enumerate(members):
+            label = f"duo.members[{index}]"
+            if not isinstance(member, dict):
+                raise ValueError(f"{label} must be an object")
+            member_id = member.get("id")
+            if not isinstance(member_id, str) or not pet_id_pattern.fullmatch(member_id) or member_id in seen_member_ids:
+                raise ValueError(f"{label}.id is invalid or duplicated")
+            seen_member_ids.add(member_id)
+            side = member.get("side")
+            if side not in {"left", "right"}:
+                raise ValueError(f"{label}.side must be left or right")
+            seen_sides.add(side)
+            name = member.get("name")
+            if not isinstance(name, str) or not name.strip() or len(name) > 80:
+                raise ValueError(f"{label}.name must contain 1 to 80 characters")
+            watch = member.get("watch")
+            if watch is not None and not isinstance(watch, bool):
+                raise ValueError(f"{label}.watch must be a boolean")
+            member_animations = member.get("animations")
+            if not isinstance(member_animations, dict):
+                raise ValueError(f"{label}.animations must be an object")
+            for action, expected in REQUIRED_ACTIONS.items():
+                frames = validate_animation_from(
+                    member_animations,
+                    action,
+                    expected,
+                    f"{label}.animations.{action}",
+                )
+                for frame_path in frames:
+                    if frame_path in root_frame_paths or frame_path in member_frame_paths:
+                        raise ValueError("鍔ㄧ敾璺緞鍐茬獊")
+                    member_frame_paths.add(frame_path)
+                    frame_paths.append(frame_path)
+        if seen_sides != {"left", "right"}:
+            raise ValueError("duo.members sides must be left and right")
+        tent = duo.get("tent")
+        if tent is not None:
+            if not isinstance(tent, dict):
+                raise ValueError("duo.tent must be an object")
+            tent_action = tent.get("action")
+            if tent_action is not None:
+                if not isinstance(tent_action, str) or not tent_action.strip():
+                    raise ValueError("duo.tent.action must be a non-empty string")
+                if tent_action not in animations:
+                    raise ValueError("duo.tent.action must point to a root animation")
+            for label_key in ("enterLabel", "leaveLabel"):
+                label_value = tent.get(label_key)
+                if label_value is None:
+                    continue
+                if not isinstance(label_value, str) or not label_value.strip() or len(label_value) > 24:
+                    raise ValueError(f"duo.tent.{label_key} must contain 1 to 24 characters")
+            open_progress = tent.get("openProgress")
+            if open_progress is not None and (
+                not isinstance(open_progress, (int, float))
+                or isinstance(open_progress, bool)
+                or not math.isfinite(open_progress)
+                or not 0.35 <= open_progress <= 0.65
+            ):
+                raise ValueError("duo.tent.openProgress must be a number from 0.35 to 0.65")
+        slack = duo.get("slack")
+        if slack is not None:
+            if not isinstance(slack, dict):
+                raise ValueError("duo.slack must be an object")
+            for action_key in ("jumpAction", "carryAction"):
+                action_name = slack.get(action_key)
+                if not isinstance(action_name, str) or not action_name.strip():
+                    raise ValueError(f"duo.slack.{action_key} must be a non-empty string")
+                if action_name not in animations:
+                    raise ValueError(f"duo.slack.{action_key} must point to a root animation")
+            for label_key in ("enterLabel", "leaveLabel"):
+                label_value = slack.get(label_key)
+                if label_value is None:
+                    continue
+                if not isinstance(label_value, str) or not label_value.strip() or len(label_value) > 24:
+                    raise ValueError(f"duo.slack.{label_key} must contain 1 to 24 characters")
+            clips = slack.get("clips")
+            if not isinstance(clips, list) or not 1 <= len(clips) <= 8:
+                raise ValueError("duo.slack.clips must contain 1 to 8 video paths")
+            for clip in clips:
+                if not isinstance(clip, str) or not clip.strip():
+                    raise ValueError("duo.slack.clips must be non-empty strings")
+                clip_path = safe_relative(clip)
+                if clip_path.suffix.lower() not in VIDEO_EXTENSIONS:
+                    raise ValueError("duo.slack.clips must be mp4/webm")
+            board_secids = slack.get("boardSecids")
+            if board_secids is not None and (
+                not isinstance(board_secids, list)
+                or not 1 <= len(board_secids) <= 8
+                or any(not isinstance(value, str) or not value.strip() for value in board_secids)
+            ):
+                raise ValueError("duo.slack.boardSecids must contain 1 to 8 non-empty strings")
+
     context_menu_actions = manifest.get("contextMenuActions")
     if context_menu_actions is not None:
         if not isinstance(context_menu_actions, list) or len(context_menu_actions) > 8:
             raise ValueError("contextMenuActions must be an array with at most 8 items")
         action_ids: set[str] = set()
         for item in context_menu_actions:
             if not isinstance(item, dict):
                 raise ValueError("contextMenuActions entries must be objects")
@@ -437,16 +602,21 @@ def validate_directory(root: Path) -> dict:
     for relative_value in sorted(referenced - {"pet.json"}):
         path = root / safe_relative(relative_value)
         suffix = path.suffix.lower()
         if suffix in AUDIO_EXTENSIONS:
             size = path.stat().st_size
             if size <= 0 or size > MAX_SINGLE_FILE_BYTES:
                 raise ValueError(f"audio size invalid: {relative_value}")
             continue
+        if suffix in VIDEO_EXTENSIONS:
+            size = path.stat().st_size
+            if size <= 0 or size > MAX_SINGLE_FILE_BYTES:
+                raise ValueError(f"video size invalid: {relative_value}")
+            continue
         canvas_size, subject_area, subject_span = validate_png(path, relative_value)
         if relative_value in frame_paths:
             canvas_sizes.add(canvas_size)
             subject_areas.append(subject_area)
             subject_spans.append(subject_span)
     if len(canvas_sizes) != 1:
         raise ValueError(f"animation frames must share one canvas size: {sorted(canvas_sizes)}")
 
diff --git a/skills/desktop-pet-maker/scripts/test_petpack_tool.py b/skills/desktop-pet-maker/scripts/test_petpack_tool.py
index 7b8884d..4381219 100644
--- a/skills/desktop-pet-maker/scripts/test_petpack_tool.py
+++ b/skills/desktop-pet-maker/scripts/test_petpack_tool.py
@@ -1,29 +1,108 @@
 from __future__ import annotations
 
 import sys
 import tempfile
 import unittest
 import zipfile
 import json
+from io import BytesIO
 from pathlib import Path
 
+from PIL import Image
+
 
 SCRIPT_DIR = Path(__file__).resolve().parent
 if str(SCRIPT_DIR) not in sys.path:
     sys.path.insert(0, str(SCRIPT_DIR))
 
 import petpack_tool
 
 
 class PetpackArchiveSecurityTests(unittest.TestCase):
     @classmethod
     def setUpClass(cls) -> None:
-        cls.fixture = SCRIPT_DIR.parents[2] / "pets" / "packages" / "xiaogou.petpack"
+        cls.fixture_temp = tempfile.TemporaryDirectory()
+        cls.fixture = Path(cls.fixture_temp.name) / "xiaogou.petpack"
+        manifest = cls.base_manifest()
+        manifest["id"] = "xiaogou"
+        with zipfile.ZipFile(cls.fixture, "w") as package:
+            package.writestr("pet.json", json.dumps(manifest, ensure_ascii=False).encode("utf-8"))
+            png = cls.sample_png()
+            for relative in sorted(petpack_tool.referenced_files(manifest) - {"pet.json"}):
+                package.writestr(relative, png)
+
+    @classmethod
+    def tearDownClass(cls) -> None:
+        cls.fixture_temp.cleanup()
+
+    @staticmethod
+    def sample_png() -> bytes:
+        image = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
+        image.putpixel((1, 1), (255, 0, 0, 255))
+        output = BytesIO()
+        image.save(output, format="PNG")
+        return output.getvalue()
+
+    @staticmethod
+    def make_animation(action: str, frame_count: int, loop: bool = False) -> dict:
+        frames = [f"animations/{action}/{index:02d}.png" for index in range(1, frame_count + 1)]
+        return {"frames": frames, "durations": [100] * frame_count, "loop": loop, "scale": 1}
+
+    @classmethod
+    def base_manifest(cls) -> dict:
+        return {
+            "schemaVersion": 1,
+            "id": "demo-seq",
+            "name": "Demo",
+            "personality": ["x"],
+            "preview": "preview.png",
+            "animations": {
+                "idle": cls.make_animation("idle", 4, True),
+                "walk": cls.make_animation("walk", 6, True),
+                "sit": cls.make_animation("sit", 4),
+                "sleep": cls.make_animation("sleep", 4, True),
+                "reaction": cls.make_animation("reaction", 4),
+            },
+        }
+
+    @classmethod
+    def member_animations(cls, member_id: str) -> dict:
+        return {
+            "idle": cls.make_animation(f"{member_id}/idle", 4, True),
+            "walk": cls.make_animation(f"{member_id}/walk", 6, True),
+            "sit": cls.make_animation(f"{member_id}/sit", 4),
+            "sleep": cls.make_animation(f"{member_id}/sleep", 4, True),
+            "reaction": cls.make_animation(f"{member_id}/reaction", 4),
+        }
+
+    @classmethod
+    def duo_manifest(cls) -> dict:
+        manifest = cls.base_manifest()
+        manifest["duo"] = {
+            "gesture": {"menuSlopPx": 12, "commitPx": 48, "snapProgress": 0.5},
+            "members": [
+                {
+                    "id": "judge",
+                    "side": "left",
+                    "name": "鍏勫紵鍒ゅ畼",
+                    "watch": True,
+                    "animations": cls.member_animations("judge"),
+                },
+                {
+                    "id": "floral",
+                    "side": "right",
+                    "name": "鑺辫寮?,
+                    "watch": False,
+                    "animations": cls.member_animations("floral"),
+                },
+            ],
+        }
+        return manifest
 
     def copy_with_extra(self, destination: Path, name: str, content: bytes = b"extra") -> None:
         with zipfile.ZipFile(self.fixture) as source, zipfile.ZipFile(destination, "w") as target:
             for info in source.infolist():
                 target.writestr(info, source.read(info.filename))
             target.writestr(name, content)
 
     def test_reviewed_demo_package_is_valid(self) -> None:
@@ -149,11 +228,66 @@ class PetpackArchiveSecurityTests(unittest.TestCase):
                 "label": "浜掑姩",
                 "action": "reaction",
                 "speech": "hello",
                 "speechAudio": "audio/hello.mp3",
             }
         ]
         petpack_tool.validate_manifest_shape(manifest)
 
+    def test_duo_manifest_validates_and_references_member_frames(self) -> None:
+        manifest = self.duo_manifest()
+        petpack_tool.validate_manifest_shape(manifest)
+        referenced = petpack_tool.referenced_files(manifest)
+        self.assertIn("animations/judge/idle/01.png", referenced)
+        self.assertIn("animations/floral/reaction/04.png", referenced)
+
+    def test_duo_manifest_requires_two_members(self) -> None:
+        manifest = self.duo_manifest()
+        manifest["duo"]["members"] = manifest["duo"]["members"][:1]
+        with self.assertRaisesRegex(ValueError, "duo.*members"):
+            petpack_tool.validate_manifest_shape(manifest)
+
+    def test_duo_manifest_root_member_path_collision_uses_contract_error(self) -> None:
+        manifest = self.duo_manifest()
+        manifest["duo"]["members"][0]["animations"]["idle"]["frames"][0] = manifest["animations"]["idle"]["frames"][0]
+        with self.assertRaisesRegex(ValueError, "鍔ㄧ敾璺緞鍐茬獊"):
+            petpack_tool.validate_manifest_shape(manifest)
+
+    def test_duo_tent_validates(self) -> None:
+        manifest = self.duo_manifest()
+        manifest["duo"]["tent"] = {
+            "action": "sit",
+            "enterLabel": "鏀捣鏉?,
+            "leaveLabel": "鏀惰捣鏉?,
+            "openProgress": 0.48,
+        }
+        petpack_tool.validate_manifest_shape(manifest)
+
+    def test_duo_tent_rejects_invalid_open_progress(self) -> None:
+        manifest = self.duo_manifest()
+        manifest["duo"]["tent"] = {"openProgress": 0.2}
+        with self.assertRaisesRegex(ValueError, "openProgress"):
+            petpack_tool.validate_manifest_shape(manifest)
+
+    def test_duo_slack_validates(self) -> None:
+        manifest = self.duo_manifest()
+        manifest["duo"]["slack"] = {
+            "jumpAction": "idle",
+            "carryAction": "walk",
+            "clips": ["video/slack/01.webm"],
+        }
+        petpack_tool.validate_manifest_shape(manifest)
+        self.assertIn("video/slack/01.webm", petpack_tool.referenced_files(manifest))
+
+    def test_duo_slack_rejects_empty_clips(self) -> None:
+        manifest = self.duo_manifest()
+        manifest["duo"]["slack"] = {
+            "jumpAction": "idle",
+            "carryAction": "walk",
+            "clips": [],
+        }
+        with self.assertRaisesRegex(ValueError, "clips"):
+            petpack_tool.validate_manifest_shape(manifest)
+
 
 if __name__ == "__main__":
     unittest.main()
diff --git a/src/capability-gates.js b/src/capability-gates.js
index e8e6837..4a4cdc5 100644
--- a/src/capability-gates.js
+++ b/src/capability-gates.js
@@ -12,26 +12,44 @@ function hasMarketSequences(manifest) {
 function hasCallHangupSequence(manifest) {
   const sequences = manifest && manifest.sequences && typeof manifest.sequences === 'object'
     ? Object.values(manifest.sequences)
     : [];
   return sequences.some((seq) => Array.isArray(seq && seq.stages)
     && seq.stages.some((stage) => stage && (stage.onContact || stage.messageLoop)));
 }
 
+function hasDuo(manifest) {
+  const duo = manifest && manifest.duo;
+  return Boolean(duo && typeof duo === 'object' && !Array.isArray(duo) && Array.isArray(duo.members) && duo.members.length === 2);
+}
+
+function hasDuoTent(manifest) {
+  return hasDuo(manifest)
+    && Boolean(manifest.duo.tent && typeof manifest.duo.tent === 'object' && !Array.isArray(manifest.duo.tent));
+}
+
+function hasDuoSlack(manifest) {
+  return hasDuo(manifest)
+    && Boolean(manifest.duo.slack && typeof manifest.duo.slack === 'object' && !Array.isArray(manifest.duo.slack));
+}
+
 function watchMenuLabel(manifest) {
   const label = manifest && manifest.watch && typeof manifest.watch.menuLabel === 'string'
     ? manifest.watch.menuLabel.trim()
     : '';
   return label || '娑堟伅闆疯揪';
 }
 
 function taskProviderFromConfig(watchConfig) {
   return watchConfig && watchConfig.tasks && watchConfig.tasks.provider === 'mock' ? 'mock' : 'feishu';
 }
 
 module.exports = {
   hasWatch,
   hasMarketSequences,
   hasCallHangupSequence,
+  hasDuo,
+  hasDuoTent,
+  hasDuoSlack,
   watchMenuLabel,
   taskProviderFromConfig
 };
diff --git a/src/petpack-validator.js b/src/petpack-validator.js
index 1b74a8e..1bc1960 100644
--- a/src/petpack-validator.js
+++ b/src/petpack-validator.js
@@ -89,16 +89,22 @@ function validateWatchPool(pool, label) {
   }
 }
 
 function referencedFiles(manifest) {
   const referenced = new Set(['pet.json', manifest.preview]);
   for (const animation of Object.values(manifest.animations || {})) {
     for (const frame of animation.frames || []) referenced.add(frame);
   }
+  for (const member of manifest.duo?.members || []) {
+    if (!member || typeof member !== 'object') continue;
+    for (const animation of Object.values(member.animations || {})) {
+      for (const frame of animation.frames || []) referenced.add(frame);
+    }
+  }
   for (const item of manifest.contextMenuActions || []) {
     if (!item || typeof item !== 'object') continue;
     addAudioRef(referenced, item.speechAudio);
     if (Array.isArray(item.randomActions)) {
       for (const choice of item.randomActions) {
         if (choice && typeof choice === 'object') addAudioRef(referenced, choice.speechAudio);
       }
     }
@@ -122,16 +128,22 @@ function referencedFiles(manifest) {
     for (const value of Object.values(fallbackAudio)) addAudioRef(referenced, value);
   }
   const watch = manifest.watch;
   if (watch && typeof watch === 'object' && !Array.isArray(watch)) {
     if (watch.fallback && typeof watch.fallback === 'object') addAudioRef(referenced, watch.fallback.audio);
     addWatchPoolAudio(referenced, watch.keywords);
     addWatchPoolAudio(referenced, watch.archivedKeywords);
   }
+  const slack = manifest.duo?.slack;
+  if (slack && typeof slack === 'object' && !Array.isArray(slack) && Array.isArray(slack.clips)) {
+    for (const clip of slack.clips) {
+      if (typeof clip === 'string' && clip) referenced.add(clip);
+    }
+  }
   return referenced;
 }
 
 function validateManifest(manifest, root = '', requireFiles = false) {
   if (!manifest || manifest.schemaVersion !== 1) throw new Error('鍙敮鎸?schemaVersion 1');
   if (!PET_ID_PATTERN.test(String(manifest.id || ''))) throw new Error('瀹犵墿 id 涓嶅悎娉?);
   if (typeof manifest.name !== 'string' || !manifest.name.trim() || manifest.name.length > 80) {
     throw new Error('瀹犵墿鍚嶇О闀垮害蹇呴』涓?1 鍒?80 涓瓧绗?);
@@ -208,40 +220,45 @@ function validateManifest(manifest, root = '', requireFiles = false) {
     }
   }
   safeRelative(manifest.preview);
   if (path.posix.extname(manifest.preview).toLowerCase() !== '.png') throw new Error('preview 蹇呴』鏄?PNG');
   if (!manifest.animations || typeof manifest.animations !== 'object' || Array.isArray(manifest.animations)) {
     throw new Error('animations 缂哄け');
   }
 
-  function validateAnimation(action, expected) {
-    const animation = manifest.animations[action];
+  function validateAnimationFrom(animations, action, expected, label = action) {
+    const animation = animations[action];
     if (!animation || typeof animation !== 'object' || Array.isArray(animation)) {
-      throw new Error(`${action} 鍔ㄧ敾閰嶇疆涓嶅悎娉昤);
+      throw new Error(`${label} 鍔ㄧ敾閰嶇疆涓嶅悎娉昤);
     }
     if (!Array.isArray(animation.frames)
       || (expected === undefined ? animation.frames.length < 1 : animation.frames.length !== expected)) {
       throw new Error(expected === undefined
-        ? `${action} 蹇呴』鍖呭惈鑷冲皯 1 甯
-        : `${action} 蹇呴』鍖呭惈 ${expected} 甯);
+        ? `${label} 蹇呴』鍖呭惈鑷冲皯 1 甯
+        : `${label} 蹇呴』鍖呭惈 ${expected} 甯);
     }
     if (!Array.isArray(animation.durations) || animation.durations.length !== animation.frames.length) {
-      throw new Error(`${action} 鐨?durations 鏁伴噺涓嶅尮閰峘);
+      throw new Error(`${label} 鐨?durations 鏁伴噺涓嶅尮閰峘);
     }
     if (animation.durations.some((value) => !Number.isInteger(value) || value < 40 || value > 10000)) {
-      throw new Error(`${action} 瀛樺湪闈炴硶甯ф椂闀縛);
+      throw new Error(`${label} 瀛樺湪闈炴硶甯ф椂闀縛);
     }
     if (animation.scale !== undefined && (!Number.isFinite(animation.scale) || animation.scale < 0.5 || animation.scale > 1.5)) {
-      throw new Error(`${action} 鐨?scale 蹇呴』鍦?0.5 鍒?1.5 涔嬮棿`);
+      throw new Error(`${label} 鐨?scale 蹇呴』鍦?0.5 鍒?1.5 涔嬮棿`);
     }
     for (const frame of animation.frames) {
       safeRelative(frame);
-      if (path.posix.extname(frame).toLowerCase() !== '.png') throw new Error(`${action} 鐨勫抚蹇呴』鏄?PNG`);
+      if (path.posix.extname(frame).toLowerCase() !== '.png') throw new Error(`${label} 鐨勫抚蹇呴』鏄?PNG`);
     }
+    return animation.frames;
+  }
+
+  function validateAnimation(action, expected) {
+    return validateAnimationFrom(manifest.animations, action, expected);
   }
 
   const validatedAnimations = new Set();
   for (const [action, expected] of Object.entries(REQUIRED_ACTIONS)) {
     validateAnimation(action, expected);
     validatedAnimations.add(action);
   }
 
@@ -378,16 +395,161 @@ function validateManifest(manifest, root = '', requireFiles = false) {
         }
         if (stage.restorePosition !== undefined && typeof stage.restorePosition !== 'boolean') {
           throw new Error(`sequences.${sequenceId}.stages[${index}].restorePosition 蹇呴』鏄竷灏斿€糮);
         }
       }
     }
   }
 
+  if (manifest.duo !== undefined) {
+    const duo = manifest.duo;
+    if (!duo || typeof duo !== 'object' || Array.isArray(duo)) {
+      throw new Error('duo 蹇呴』鏄璞?);
+    }
+    if (duo.gesture !== undefined) {
+      const gesture = duo.gesture;
+      if (!gesture || typeof gesture !== 'object' || Array.isArray(gesture)) {
+        throw new Error('duo.gesture 蹇呴』鏄璞?);
+      }
+      if (gesture.menuSlopPx !== undefined && (!Number.isInteger(gesture.menuSlopPx) || gesture.menuSlopPx < 1 || gesture.menuSlopPx > 40)) {
+        throw new Error('duo.gesture.menuSlopPx 蹇呴』涓?1 鍒?40 鐨勬暣鏁?);
+      }
+      if (gesture.commitPx !== undefined && (!Number.isInteger(gesture.commitPx) || gesture.commitPx < 20 || gesture.commitPx > 200)) {
+        throw new Error('duo.gesture.commitPx 蹇呴』涓?20 鍒?200 鐨勬暣鏁?);
+      }
+      if (gesture.snapProgress !== undefined && (!Number.isFinite(gesture.snapProgress) || gesture.snapProgress < 0.2 || gesture.snapProgress > 0.9)) {
+        throw new Error('duo.gesture.snapProgress 蹇呴』涓?0.2 鍒?0.9 鐨勬暟瀛?);
+      }
+    }
+    for (const key of ['unfoldAction', 'foldAction']) {
+      if (duo[key] === undefined) continue;
+      if (typeof duo[key] !== 'string' || !duo[key].trim()) {
+        throw new Error(`duo.${key} 蹇呴』鏄潪绌哄瓧绗︿覆`);
+      }
+      if (!manifest.animations?.[duo[key]]) {
+        throw new Error(`duo.${key} 蹇呴』鎸囧悜鏍圭骇鍔ㄧ敾`);
+      }
+    }
+    if (!Array.isArray(duo.members) || duo.members.length !== 2) {
+      throw new Error('duo.members 蹇呴』鍖呭惈 2 涓垚鍛?);
+    }
+    const rootFramePaths = new Set();
+    for (const animation of Object.values(manifest.animations)) {
+      if (!animation || typeof animation !== 'object' || Array.isArray(animation) || !Array.isArray(animation.frames)) continue;
+      for (const frame of animation.frames) rootFramePaths.add(frame);
+    }
+    const seenMemberIds = new Set();
+    const seenSides = new Set();
+    const memberFramePaths = new Set();
+    for (const [index, member] of duo.members.entries()) {
+      const label = `duo.members[${index}]`;
+      if (!member || typeof member !== 'object' || Array.isArray(member)) {
+        throw new Error(`${label} 蹇呴』鏄璞);
+      }
+      if (!PET_ID_PATTERN.test(String(member.id || '')) || seenMemberIds.has(member.id)) {
+        throw new Error(`${label}.id 涓嶅悎娉曟垨閲嶅`);
+      }
+      seenMemberIds.add(member.id);
+      if (member.side !== 'left' && member.side !== 'right') {
+        throw new Error(`${label}.side 蹇呴』鏄?left 鎴?right`);
+      }
+      seenSides.add(member.side);
+      if (typeof member.name !== 'string' || !member.name.trim() || member.name.length > 80) {
+        throw new Error(`${label}.name 闀垮害蹇呴』涓?1 鍒?80 涓瓧绗);
+      }
+      if (member.watch !== undefined && typeof member.watch !== 'boolean') {
+        throw new Error(`${label}.watch 蹇呴』鏄竷灏斿€糮);
+      }
+      if (!member.animations || typeof member.animations !== 'object' || Array.isArray(member.animations)) {
+        throw new Error(`${label}.animations 蹇呴』鏄璞);
+      }
+      for (const [action, expected] of Object.entries(REQUIRED_ACTIONS)) {
+        const frames = validateAnimationFrom(member.animations, action, expected, `${label}.animations.${action}`);
+        for (const frame of frames) {
+          if (rootFramePaths.has(frame) || memberFramePaths.has(frame)) {
+            throw new Error('鍔ㄧ敾璺緞鍐茬獊');
+          }
+          memberFramePaths.add(frame);
+        }
+      }
+    }
+    if (!seenSides.has('left') || !seenSides.has('right')) {
+      throw new Error('duo.members side 蹇呴』鍒嗗埆涓?left 鍜?right');
+    }
+    if (duo.tent !== undefined) {
+      const tent = duo.tent;
+      if (!tent || typeof tent !== 'object' || Array.isArray(tent)) {
+        throw new Error('duo.tent 蹇呴』鏄璞?);
+      }
+      if (tent.action !== undefined) {
+        if (typeof tent.action !== 'string' || !tent.action.trim()) {
+          throw new Error('duo.tent.action 蹇呴』鏄潪绌哄瓧绗︿覆');
+        }
+        if (!manifest.animations?.[tent.action]) {
+          throw new Error('duo.tent.action 蹇呴』鎸囧悜鏍圭骇鍔ㄧ敾');
+        }
+      }
+      for (const key of ['enterLabel', 'leaveLabel']) {
+        if (tent[key] === undefined) continue;
+        if (typeof tent[key] !== 'string' || !tent[key].trim() || tent[key].length > 24) {
+          throw new Error(`duo.tent.${key} 闀垮害蹇呴』涓?1 鍒?24 涓瓧绗);
+        }
+      }
+      if (tent.openProgress !== undefined) {
+        const progress = tent.openProgress;
+        if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0.35 || progress > 0.65) {
+          throw new Error('duo.tent.openProgress 蹇呴』涓?0.35 鍒?0.65 鐨勬暟瀛?);
+        }
+      }
+    }
+    if (duo.slack !== undefined) {
+      const slack = duo.slack;
+      if (!slack || typeof slack !== 'object' || Array.isArray(slack)) {
+        throw new Error('duo.slack 蹇呴』鏄璞?);
+      }
+      for (const key of ['jumpAction', 'carryAction']) {
+        if (typeof slack[key] !== 'string' || !slack[key].trim()) {
+          throw new Error(`duo.slack.${key} 蹇呴』鏄潪绌哄瓧绗︿覆`);
+        }
+        if (!manifest.animations?.[slack[key]]) {
+          throw new Error(`duo.slack.${key} 蹇呴』鎸囧悜鏍圭骇鍔ㄧ敾`);
+        }
+      }
+      for (const key of ['enterLabel', 'leaveLabel']) {
+        if (slack[key] === undefined) continue;
+        if (typeof slack[key] !== 'string' || !slack[key].trim() || slack[key].length > 24) {
+          throw new Error(`duo.slack.${key} 闀垮害蹇呴』涓?1 鍒?24 涓瓧绗);
+        }
+      }
+      if (!Array.isArray(slack.clips) || slack.clips.length < 1 || slack.clips.length > 8) {
+        throw new Error('duo.slack.clips 蹇呴』鍖呭惈 1 鍒?8 涓棰戣矾寰?);
+      }
+      for (const clip of slack.clips) {
+        if (typeof clip !== 'string' || !clip.trim()) {
+          throw new Error('duo.slack.clips 蹇呴』鏄潪绌哄瓧绗︿覆鏁扮粍');
+        }
+        safeRelative(clip);
+        const ext = path.posix.extname(clip).toLowerCase();
+        if (ext !== '.mp4' && ext !== '.webm') {
+          throw new Error('duo.slack.clips 鍙敮鎸?mp4/webm');
+        }
+        if (requireFiles && !fs.statSync(resolveInside(root, clip), { throwIfNoEntry: false })?.isFile()) {
+          throw new Error(`璧勬簮缂哄け锛?{clip}`);
+        }
+      }
+      if (slack.boardSecids !== undefined) {
+        if (!Array.isArray(slack.boardSecids) || slack.boardSecids.length < 1 || slack.boardSecids.length > 8
+          || slack.boardSecids.some((value) => typeof value !== 'string' || !value.trim())) {
+          throw new Error('duo.slack.boardSecids 蹇呴』鍖呭惈 1 鍒?8 涓潪绌哄瓧绗︿覆');
+        }
+      }
+    }
+  }
+
   if (manifest.contextMenuActions !== undefined) {
     if (!Array.isArray(manifest.contextMenuActions) || manifest.contextMenuActions.length > 8) {
       throw new Error('contextMenuActions 蹇呴』鏄渶澶?8 椤圭殑鏁扮粍');
     }
     const actionIds = new Set();
     for (const item of manifest.contextMenuActions) {
       if (!item || typeof item !== 'object') throw new Error('鍙抽敭鍔ㄤ綔閰嶇疆鏍煎紡涓嶆纭?);
       if (!SEQUENCE_ID_PATTERN.test(String(item.id || '')) || actionIds.has(item.id)) {
