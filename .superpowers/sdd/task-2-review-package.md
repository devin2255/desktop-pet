# Review Package — Task 2
Base: after Task1 working tree (no commits)
Head: WORKING_TREE

## Status
 M package.json  M skills/desktop-pet-maker/references/petpack-schema.md  M skills/desktop-pet-maker/scripts/petpack_tool.py  M src/petpack-validator.js ?? scripts/test-sequences-schema.js

## Diff stat
 package.json                                       |  2 +-  .../desktop-pet-maker/references/petpack-schema.md | 43 +++++++++++  skills/desktop-pet-maker/scripts/petpack_tool.py   | 85 ++++++++++++++++++----  src/petpack-validator.js                           | 85 +++++++++++++++++++++-  4 files changed, 197 insertions(+), 18 deletions(-)

## Full diff
```diff
diff --git a/package.json b/package.json index 7337ff6..b00c57f 100644 --- a/package.json +++ b/package.json @@ -10,7 +10,7 @@    },    "scripts": {      "test": "npm run test:js && npm run test:python && npm run validate:demo", -    "test:js": "node --check src/main-v3.js && node --check src/preload-v3.js && node --check src/renderer-v3.js && node --check src/petpack-validator.js && node --check src/startup-greeting.js && node --check src/window-discovery.js && node --check src/interaction-controller.js && node --check src/topmost-guard.js && node --check scripts/build-customer.js && node scripts/test-renderer-interaction.js && node scripts/test-petpack-security.js && node scripts/test-window-interactions.js && node scripts/test-window-discovery.js && node scripts/test-interaction-controller.js && node scripts/test-topmost-guard.js && node scripts/test-runtime-cdp-contract.js && node scripts/test-laopo-petpack.js && node scripts/test-startup-greeting.js", +    "test:js": "node --check src/main-v3.js && node --check src/preload-v3.js && node --check src/renderer-v3.js && node --check src/petpack-validator.js && node --check src/startup-greeting.js && node --check src/window-discovery.js && node --check src/interaction-controller.js && node --check src/topmost-guard.js && node --check src/sequence-controller.js && node --check scripts/build-customer.js && node scripts/test-renderer-interaction.js && node scripts/test-petpack-security.js && node scripts/test-sequences-schema.js && node scripts/test-window-interactions.js && node scripts/test-window-discovery.js && node scripts/test-interaction-controller.js && node scripts/test-topmost-guard.js && node scripts/test-runtime-cdp-contract.js && node scripts/test-laopo-petpack.js && node scripts/test-startup-greeting.js && node scripts/test-sequence-controller.js",      "test:python": "python -m unittest discover -s skills/desktop-pet-maker/scripts -p test_*.py -v",      "test:regression": "node scripts/test-renderer-interaction.js && python skills/desktop-pet-maker/scripts/test_process_animation_strips.py -v",      "validate:demo": "python skills/desktop-pet-maker/scripts/petpack_tool.py validate pets/packages/laopo.petpack", diff --git a/skills/desktop-pet-maker/references/petpack-schema.md b/skills/desktop-pet-maker/references/petpack-schema.md index 88ceeeb..433cc23 100644 --- a/skills/desktop-pet-maker/references/petpack-schema.md +++ b/skills/desktop-pet-maker/references/petpack-schema.md @@ -26,6 +26,8 @@ Manifest fields:  - `animations`: required object keyed by action.  - `behavior.random`: weighted state definitions used by the player.  - `interactionActions`: optional object that maps window-interaction roles to animation actions. +- `sequences`: optional object keyed by sequence id; each value defines a multi-stage scripted interaction. +- `contextMenuActions`: optional array of menu entries. Each entry must contain exactly one of `action` (single animation) or `sequence` (reference to `sequences`).    Each animation contains:   @@ -64,4 +66,45 @@ Standard action counts are idle 4, walk 6, sit 4, sleep 4, and reaction 4. The p    The archive must contain only the manifest, preview, and referenced assets. Every PNG must have an alpha channel, non-empty visible pixels, transparent corners, and no material green-screen residue.   +## Sequences + +`sequences` is optional. When present it must be an object with at most 8 entries. Keys must match `^[a-z0-9][a-z0-9-]{1,31}$`. + +Each sequence contains a required `stages` array with 2 to 16 stage objects. Every stage requires an `action` that names an animation in `animations`. Optional fields: + +| Field | Type | Constraints | +| --- | --- | --- | +| `message` | string | up to 80 characters | +| `messages` | string array | 1 to 4 entries, each up to 80 characters | +| `messageGapMs` | integer | 0 to 5000 | +| `duration` | integer | 0 to 10000 milliseconds; may be omitted when `waitForClick` is true | +| `waitForClick` | boolean | pause until the user clicks before advancing | + +Stages may omit both `message` and `messages`. Referenced stage actions receive the same structural animation validation as other manifest actions. + +Example: + +```json +{ +  "sequences": { +    "relax": { +      "stages": [ +        { "action": "relax-a", "message": "鍏堝紕濂界湅涓€鐐癸綖", "duration": 2800 }, +        { "action": "relax-b", "messages": ["鎴戣杩欎釜", "鎴戣杩欎釜"], "messageGapMs": 700, "waitForClick": true }, +        { "action": "idle", "duration": 0 } +      ] +    } +  } +} +``` + +## Context menu actions + +`contextMenuActions` may contain at most 8 entries. Each entry requires `id`, `label`, and exactly one trigger: + +- **Single action:** `{ "id": "react", "label": "浜掑姩", "action": "reaction", "message": "浣犲ソ", "duration": 2000 }` +- **Sequence:** `{ "id": "relax", "label": "鍘绘斁鏉?, "sequence": "relax" }` + +When using `sequence`, do not include `action`, `message`, or `duration`; dialogue and timing live in the sequence stages. `speech` and `speechAudio` remain optional on either entry type. +  All exported frames must use the same transparent canvas size and baseline. Normalize visual scale across all actions, not merely within each action strip, so switching poses does not make the pet jump in size. diff --git a/skills/desktop-pet-maker/scripts/petpack_tool.py b/skills/desktop-pet-maker/scripts/petpack_tool.py index c0c64e0..26ec3af 100644 --- a/skills/desktop-pet-maker/scripts/petpack_tool.py +++ b/skills/desktop-pet-maker/scripts/petpack_tool.py @@ -21,6 +21,8 @@ MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024  MAX_MANIFEST_BYTES = 1024 * 1024  MAX_IMAGE_DIMENSION = 4096  MAX_IMAGE_PIXELS = 16 * 1024 * 1024 +SEQUENCE_ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]{1,31}") +MAX_SEQUENCES = 8      def safe_relative(value: str) -> Path: @@ -150,6 +152,50 @@ def validate_manifest_shape(manifest: dict) -> list[str]:                  ):                      raise ValueError("interactionActions anchor must be within 0..1")   +    sequences = manifest.get("sequences") +    if sequences is not None: +        if not isinstance(sequences, dict): +            raise ValueError("sequences must be an object") +        if len(sequences) > MAX_SEQUENCES: +            raise ValueError(f"sequences must contain at most {MAX_SEQUENCES} entries") +        seen_sequence_ids: set[str] = set() +        for sequence_id, sequence in sequences.items(): +            if not isinstance(sequence_id, str) or not SEQUENCE_ID_PATTERN.fullmatch(sequence_id) or sequence_id in seen_sequence_ids: +                raise ValueError("sequences key is invalid or duplicated") +            seen_sequence_ids.add(sequence_id) +            if not isinstance(sequence, dict): +                raise ValueError(f"sequences.{sequence_id} must be an object") +            stages = sequence.get("stages") +            if not isinstance(stages, list) or not 2 <= len(stages) <= 16: +                raise ValueError(f"sequences.{sequence_id}.stages must contain 2 to 16 entries") +            for index, stage in enumerate(stages): +                if not isinstance(stage, dict): +                    raise ValueError(f"sequences.{sequence_id}.stages[{index}] must be an object") +                action = stage.get("action") +                if not isinstance(action, str) or action not in animations: +                    raise ValueError(f"sequences.{sequence_id}.stages[{index}] references an unknown animation") +                if action not in validated_animations: +                    validate_animation(action) +                    validated_animations.add(action) +                if "message" in stage and (not isinstance(stage["message"], str) or len(stage["message"]) > 80): +                    raise ValueError(f"sequences.{sequence_id}.stages[{index}].message must be a string up to 80 characters") +                if "messages" in stage: +                    messages = stage["messages"] +                    if not isinstance(messages, list) or not 1 <= len(messages) <= 4: +                        raise ValueError(f"sequences.{sequence_id}.stages[{index}].messages must contain 1 to 4 strings") +                    if any(not isinstance(value, str) or len(value) > 80 for value in messages): +                        raise ValueError(f"sequences.{sequence_id}.stages[{index}].messages entries must be strings up to 80 characters") +                if "messageGapMs" in stage: +                    gap = stage["messageGapMs"] +                    if not isinstance(gap, int) or isinstance(gap, bool) or not 0 <= gap <= 5000: +                        raise ValueError(f"sequences.{sequence_id}.stages[{index}].messageGapMs must be an integer from 0 to 5000") +                if "duration" in stage: +                    duration = stage["duration"] +                    if not isinstance(duration, int) or isinstance(duration, bool) or not 0 <= duration <= 10000: +                        raise ValueError(f"sequences.{sequence_id}.stages[{index}].duration must be an integer from 0 to 10000") +                if "waitForClick" in stage and not isinstance(stage["waitForClick"], bool): +                    raise ValueError(f"sequences.{sequence_id}.stages[{index}].waitForClick must be a boolean") +      context_menu_actions = manifest.get("contextMenuActions")      if context_menu_actions is not None:          if not isinstance(context_menu_actions, list) or len(context_menu_actions) > 8: @@ -159,20 +205,37 @@ def validate_manifest_shape(manifest: dict) -> list[str]:              if not isinstance(item, dict):                  raise ValueError("contextMenuActions entries must be objects")              item_id = item.get("id") -            if not isinstance(item_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,31}", item_id) or item_id in action_ids: +            if not isinstance(item_id, str) or not SEQUENCE_ID_PATTERN.fullmatch(item_id) or item_id in action_ids:                  raise ValueError("contextMenuActions id is invalid or duplicated")              action_ids.add(item_id)              label = item.get("label")              if not isinstance(label, str) or not label.strip() or len(label) > 24:                  raise ValueError("contextMenuActions label must be 1 to 24 characters") -            action = item.get("action") -            if not isinstance(action, str) or action not in animations: -                raise ValueError("contextMenuActions references an unknown animation") -            if action not in validated_animations: -                validate_animation(action) -                validated_animations.add(action) -            if "message" in item and (not isinstance(item["message"], str) or len(item["message"]) > 80): -                raise ValueError("contextMenuActions message must be a string up to 80 characters") +            has_action = "action" in item +            has_sequence = "sequence" in item +            if has_action == has_sequence: +                raise ValueError("contextMenuActions entry must contain exactly one of action or sequence") +            if has_sequence: +                sequence_id = item.get("sequence") +                if not isinstance(sequence_id, str) or not isinstance(sequences, dict) or sequence_id not in sequences: +                    raise ValueError("contextMenuActions references an unknown sequence") +                if "message" in item: +                    raise ValueError("contextMenuActions sequence entry must not include message") +                if "duration" in item: +                    raise ValueError("contextMenuActions sequence entry must not include duration") +            else: +                action = item.get("action") +                if not isinstance(action, str) or action not in animations: +                    raise ValueError("contextMenuActions references an unknown animation") +                if action not in validated_animations: +                    validate_animation(action) +                    validated_animations.add(action) +                if "message" in item and (not isinstance(item["message"], str) or len(item["message"]) > 80): +                    raise ValueError("contextMenuActions message must be a string up to 80 characters") +                if "duration" in item: +                    duration = item["duration"] +                    if not isinstance(duration, int) or isinstance(duration, bool) or not 600 <= duration <= 10000: +                        raise ValueError("contextMenuActions duration must be an integer from 600 to 10000")              if "speech" in item and (not isinstance(item["speech"], str) or len(item["speech"]) > 20):                  raise ValueError("contextMenuActions speech must be a string up to 20 characters")              if "speechAudio" in item: @@ -182,10 +245,6 @@ def validate_manifest_shape(manifest: dict) -> list[str]:                  audio_path = safe_relative(audio)                  if audio_path.suffix.lower() not in AUDIO_EXTENSIONS:                      raise ValueError("contextMenuActions speechAudio must be mp3/wav/ogg") -            if "duration" in item: -                duration = item["duration"] -                if not isinstance(duration, int) or isinstance(duration, bool) or not 600 <= duration <= 10000: -                    raise ValueError("contextMenuActions duration must be an integer from 600 to 10000")        def validate_behavior_list(behavior: object, label: str) -> None:          if not isinstance(behavior, list) or not 1 <= len(behavior) <= 20: diff --git a/src/petpack-validator.js b/src/petpack-validator.js index ebd238b..c3bc781 100644 --- a/src/petpack-validator.js +++ b/src/petpack-validator.js @@ -7,6 +7,8 @@ const AdmZip = require('adm-zip');  const REQUIRED_ACTIONS = Object.freeze({ idle: 4, walk: 6, sit: 4, sleep: 4, reaction: 4 });  const INTERACTION_ROLES = new Set(['drag', 'climb', 'perch', 'hang', 'fall', 'impact', 'recover']);  const PET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/; +const SEQUENCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/; +const MAX_SEQUENCES = 8;  const MAX_ARCHIVE_ENTRIES = 300;  const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;  const MAX_ASSET_BYTES = 50 * 1024 * 1024; @@ -144,6 +146,64 @@ function validateManifest(manifest, root = '', requireFiles = false) {      }    }   +  if (manifest.sequences !== undefined) { +    if (!manifest.sequences || typeof manifest.sequences !== 'object' || Array.isArray(manifest.sequences)) { +      throw new Error('sequences 蹇呴』鏄璞?); +    } +    const sequenceIds = Object.keys(manifest.sequences); +    if (sequenceIds.length > MAX_SEQUENCES) { +      throw new Error(`sequences 鏈€澶氬寘鍚?${MAX_SEQUENCES} 鏉); +    } +    const seenSequenceIds = new Set(); +    for (const sequenceId of sequenceIds) { +      if (!SEQUENCE_ID_PATTERN.test(sequenceId) || seenSequenceIds.has(sequenceId)) { +        throw new Error('sequences key 涓嶅悎娉曟垨閲嶅'); +      } +      seenSequenceIds.add(sequenceId); +      const sequence = manifest.sequences[sequenceId]; +      if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence)) { +        throw new Error(`sequences.${sequenceId} 閰嶇疆鏍煎紡涓嶆纭甡); +      } +      const { stages } = sequence; +      if (!Array.isArray(stages) || stages.length < 2 || stages.length > 16) { +        throw new Error(`sequences.${sequenceId}.stages 蹇呴』鍖呭惈 2 鍒?16 涓樁娈礰); +      } +      for (let index = 0; index < stages.length; index += 1) { +        const stage = stages[index]; +        if (!stage || typeof stage !== 'object' || Array.isArray(stage)) { +          throw new Error(`sequences.${sequenceId}.stages[${index}] 閰嶇疆鏍煎紡涓嶆纭甡); +        } +        if (typeof stage.action !== 'string' || !Object.hasOwn(manifest.animations, stage.action)) { +          throw new Error(`sequences.${sequenceId}.stages[${index}] 寮曠敤浜嗕笉瀛樺湪鐨勫姩鐢伙細${stage.action}`); +        } +        if (!validatedAnimations.has(stage.action)) { +          validateAnimation(stage.action); +          validatedAnimations.add(stage.action); +        } +        if (stage.message !== undefined && (typeof stage.message !== 'string' || stage.message.length > 80)) { +          throw new Error(`sequences.${sequenceId}.stages[${index}].message 涓嶈兘瓒呰繃 80 涓瓧绗); +        } +        if (stage.messages !== undefined) { +          if (!Array.isArray(stage.messages) || stage.messages.length < 1 || stage.messages.length > 4) { +            throw new Error(`sequences.${sequenceId}.stages[${index}].messages 蹇呴』鍖呭惈 1 鍒?4 鏉″瓧绗︿覆`); +          } +          if (stage.messages.some((value) => typeof value !== 'string' || value.length > 80)) { +            throw new Error(`sequences.${sequenceId}.stages[${index}].messages 姣忔潯涓嶈兘瓒呰繃 80 涓瓧绗); +          } +        } +        if (stage.messageGapMs !== undefined && (!Number.isInteger(stage.messageGapMs) || stage.messageGapMs < 0 || stage.messageGapMs > 5000)) { +          throw new Error(`sequences.${sequenceId}.stages[${index}].messageGapMs 蹇呴』涓?0 鍒?5000 姣`); +        } +        if (stage.duration !== undefined && (!Number.isInteger(stage.duration) || stage.duration < 0 || stage.duration > 10000)) { +          throw new Error(`sequences.${sequenceId}.stages[${index}].duration 蹇呴』涓?0 鍒?10000 姣`); +        } +        if (stage.waitForClick !== undefined && typeof stage.waitForClick !== 'boolean') { +          throw new Error(`sequences.${sequenceId}.stages[${index}].waitForClick 蹇呴』鏄竷灏斿€糮); +        } +      } +    } +  } +    if (manifest.contextMenuActions !== undefined) {      if (!Array.isArray(manifest.contextMenuActions) || manifest.contextMenuActions.length > 8) {        throw new Error('contextMenuActions 蹇呴』鏄渶澶?8 椤圭殑鏁扮粍'); @@ -151,13 +211,31 @@ function validateManifest(manifest, root = '', requireFiles = false) {      const actionIds = new Set();      for (const item of manifest.contextMenuActions) {        if (!item || typeof item !== 'object') throw new Error('鍙抽敭鍔ㄤ綔閰嶇疆鏍煎紡涓嶆纭?); -      if (!/^[a-z0-9][a-z0-9-]{1,31}$/.test(String(item.id || '')) || actionIds.has(item.id)) { +      if (!SEQUENCE_ID_PATTERN.test(String(item.id || '')) || actionIds.has(item.id)) {          throw new Error('鍙抽敭鍔ㄤ綔 id 涓嶅悎娉曟垨閲嶅');        }        actionIds.add(item.id);        if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 24) throw new Error('鍙抽敭鍔ㄤ綔 label 蹇呴』涓?1 鍒?24 涓瓧绗?); -      if (typeof item.action !== 'string' || !manifest.animations[item.action]) throw new Error('鍙抽敭鍔ㄤ綔寮曠敤浜嗕笉瀛樺湪鐨勫姩鐢伙細' + item.action); -      if (item.message !== undefined && (typeof item.message !== 'string' || item.message.length > 80)) throw new Error('鍙抽敭鍔ㄤ綔 message 涓嶈兘瓒呰繃 80 涓瓧绗?); +      const hasAction = item.action !== undefined; +      const hasSequence = item.sequence !== undefined; +      if (hasAction === hasSequence) { +        throw new Error('鍙抽敭鍔ㄤ綔蹇呴』涓斿彧鑳藉寘鍚?action 鎴?sequence 涔嬩竴'); +      } +      if (hasSequence) { +        if (typeof item.sequence !== 'string' || !manifest.sequences || !Object.hasOwn(manifest.sequences, item.sequence)) { +          throw new Error('鍙抽敭鍔ㄤ綔寮曠敤浜嗕笉瀛樺湪鐨勫簭鍒楋細' + item.sequence); +        } +        if (item.message !== undefined) throw new Error('寮曠敤 sequence 鐨勫彸閿姩浣滀笉鑳藉寘鍚?message'); +        if (item.duration !== undefined) throw new Error('寮曠敤 sequence 鐨勫彸閿姩浣滀笉鑳藉寘鍚?duration'); +      } else { +        if (typeof item.action !== 'string' || !manifest.animations[item.action]) throw new Error('鍙抽敭鍔ㄤ綔寮曠敤浜嗕笉瀛樺湪鐨勫姩鐢伙細' + item.action); +        if (!validatedAnimations.has(item.action)) { +          validateAnimation(item.action); +          validatedAnimations.add(item.action); +        } +        if (item.message !== undefined && (typeof item.message !== 'string' || item.message.length > 80)) throw new Error('鍙抽敭鍔ㄤ綔 message 涓嶈兘瓒呰繃 80 涓瓧绗?); +        if (item.duration !== undefined && (!Number.isInteger(item.duration) || item.duration < 600 || item.duration > 10000)) throw new Error('鍙抽敭鍔ㄤ綔 duration 蹇呴』涓?600 鍒?10000 姣'); +      }        if (item.speech !== undefined && (typeof item.speech !== 'string' || item.speech.length > 20)) throw new Error('鍙抽敭鍔ㄤ綔 speech 涓嶈兘瓒呰繃 20 涓瓧绗?);        if (item.speechAudio !== undefined) {          if (typeof item.speechAudio !== 'string' || !item.speechAudio) throw new Error('鍙抽敭鍔ㄤ綔 speechAudio 璺緞涓嶅悎娉?); @@ -166,7 +244,6 @@ function validateManifest(manifest, root = '', requireFiles = false) {            throw new Error('鍙抽敭鍔ㄤ綔 speechAudio 鍙敮鎸?mp3/wav/ogg');          }        } -      if (item.duration !== undefined && (!Number.isInteger(item.duration) || item.duration < 600 || item.duration > 10000)) throw new Error('鍙抽敭鍔ㄤ綔 duration 蹇呴』涓?600 鍒?10000 姣');      }    }  
```

## Untracked
```diff
--- /dev/null
+++ b/scripts/test-sequences-schema.js
+'use strict';
+
+const assert = require('assert');
+const { validateManifest } = require('../src/petpack-validator');
+
+function makeAnimation(action, frameCount, loop = false) {
+  const frames = [];
+  const durations = [];
+  for (let i = 1; i <= frameCount; i += 1) {
+    frames.push(`animations/${action}/${String(i).padStart(2, '0')}.png`);
+    durations.push(100);
+  }
+  return { frames, durations, loop, scale: 1 };
+}
+
+function baseManifest(overrides = {}) {
+  return {
+    schemaVersion: 1,
+    id: 'demo-seq',
+    name: 'Demo',
+    personality: ['x'],
+    preview: 'preview.png',
+    animations: {
+      idle: makeAnimation('idle', 4, true),
+      walk: makeAnimation('walk', 6, true),
+      sit: makeAnimation('sit', 4, false),
+      sleep: makeAnimation('sleep', 4, true),
+      reaction: makeAnimation('reaction', 4, false),
+      'relax-a': makeAnimation('relax-a', 1, false),
+      'relax-b': makeAnimation('relax-b', 1, false)
+    },
+    behavior: { random: [{ state: 'walk', weight: 1, minDuration: 1000, maxDuration: 2000 }] },
+    sequences: {
+      relax: {
+        stages: [
+          { action: 'relax-a', message: 'hi', duration: 1000 },
+          { action: 'relax-b', messages: ['我要这个', '我要这个'], waitForClick: true },
+          { action: 'idle', duration: 0 }
+        ]
+      }
+    },
+    contextMenuActions: [
+      { id: 'relax', label: '去放松', sequence: 'relax' }
+    ],
+    ...overrides
+  };
+}
+
+assert.doesNotThrow(() => validateManifest(baseManifest(), '', false));
+
+assert.throws(
+  () => validateManifest(baseManifest({
+    contextMenuActions: [{ id: 'relax', label: '去放松', action: 'reaction', sequence: 'relax' }]
+  }), '', false)
+);
+
+assert.throws(
+  () => validateManifest(baseManifest({
+    contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'missing' }]
+  }), '', false)
+);
+
+assert.throws(
+  () => validateManifest(baseManifest({
+    contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'relax', message: 'nope' }]
+  }), '', false)
+);
+
+assert.throws(
+  () => validateManifest(baseManifest({
+    contextMenuActions: [{ id: 'relax', label: '去放松', sequence: 'relax', duration: 1000 }]
+  }), '', false)
+);
+
+assert.throws(
+  () => validateManifest(baseManifest({
+    sequences: {
+      relax: { stages: [{ action: 'relax-a', duration: 1000 }] }
+    }
+  }), '', false),
+  /stages/
+);
+
+assert.throws(
+  () => validateManifest(baseManifest({
+    sequences: {
+      relax: {
+        stages: [
+          { action: 'missing', duration: 1000 },
+          { action: 'idle', duration: 0 }
+        ]
+      }
+    }
+  }), '', false)
+);
+
+assert.doesNotThrow(() => validateManifest(baseManifest({
+  contextMenuActions: [{ id: 'react', label: '互动', action: 'reaction', message: '你好' }]
+}), '', false));
+
+console.log('test-sequences-schema: ok');
+
```
