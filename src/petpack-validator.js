'use strict';

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const REQUIRED_ACTIONS = Object.freeze({ idle: 4, walk: 6, sit: 4, sleep: 4, reaction: 4 });
const INTERACTION_ROLES = new Set(['drag', 'climb', 'perch', 'hang', 'fall', 'impact', 'recover']);
const PET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,47}$/;
const SEQUENCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/;
const MAX_SEQUENCES = 8;
const MAX_ARCHIVE_ENTRIES = 300;
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_IMAGE_DIMENSION = 4096;
const MAX_IMAGE_PIXELS = 16 * 1024 * 1024;

function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')) {
    throw new Error(`不安全的资源路径：${value}`);
  }
  const parts = value.split('/');
  if (value.startsWith('/') || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`不安全的资源路径：${value}`);
  }
  for (const part of parts) {
    if (/[:<>"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part)) {
      throw new Error(`不安全的 Windows 资源路径：${value}`);
    }
  }
  return parts;
}

function resolveInside(root, relative) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...safeRelative(relative));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('资源路径越界');
  }
  return resolved;
}

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg']);

function referencedFiles(manifest) {
  const referenced = new Set(['pet.json', manifest.preview]);
  for (const animation of Object.values(manifest.animations || {})) {
    for (const frame of animation.frames || []) referenced.add(frame);
  }
  for (const item of manifest.contextMenuActions || []) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.speechAudio === 'string' && item.speechAudio) referenced.add(item.speechAudio);
    if (Array.isArray(item.randomActions)) {
      for (const choice of item.randomActions) {
        if (choice && typeof choice.speechAudio === 'string' && choice.speechAudio) {
          referenced.add(choice.speechAudio);
        }
      }
    }
  }
  for (const list of [manifest.behavior?.random, manifest.behavior?.perched]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item.speechAudio === 'string' && item.speechAudio) referenced.add(item.speechAudio);
    }
  }
  return referenced;
}

function validateManifest(manifest, root = '', requireFiles = false) {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error('只支持 schemaVersion 1');
  if (!PET_ID_PATTERN.test(String(manifest.id || ''))) throw new Error('宠物 id 不合法');
  if (typeof manifest.name !== 'string' || !manifest.name.trim() || manifest.name.length > 80) {
    throw new Error('宠物名称长度必须为 1 到 80 个字符');
  }
  if (manifest.description !== undefined && (typeof manifest.description !== 'string' || manifest.description.length > 500)) {
    throw new Error('description 不能超过 500 个字符');
  }
  if (manifest.personality !== undefined) {
    if (!Array.isArray(manifest.personality) || manifest.personality.length > 12 || manifest.personality.some((item) => typeof item !== 'string' || !item.trim() || item.length > 32)) {
      throw new Error('personality 必须是最多 12 个非空短字符串');
    }
  }
  if (manifest.speechGender !== undefined
    && manifest.speechGender !== 'male'
    && manifest.speechGender !== 'female') {
    throw new Error('speechGender 只能是 male 或 female');
  }
  if (manifest.startupGreeting !== undefined) {
    if (typeof manifest.startupGreeting !== 'string' || manifest.startupGreeting.length > 80) {
      throw new Error('startupGreeting 必须是不超过 80 个字符的字符串');
    }
  }
  if (manifest.watch !== undefined) {
    const watch = manifest.watch;
    if (!watch || typeof watch !== 'object' || Array.isArray(watch)) {
      throw new Error('watch 必须是对象');
    }
    if (watch.keywords !== undefined) {
      if (!watch.keywords || typeof watch.keywords !== 'object' || Array.isArray(watch.keywords)) {
        throw new Error('watch.keywords 必须是对象');
      }
      for (const [key, lines] of Object.entries(watch.keywords)) {
        if (typeof key !== 'string' || !key) {
          throw new Error('watch.keywords 的键必须是非空字符串');
        }
        if (!Array.isArray(lines) || lines.length === 0
          || lines.some((line) => typeof line !== 'string' || !line)) {
          throw new Error(`watch.keywords.${key} 必须是非空字符串数组`);
        }
      }
    }
    if (watch.fallback !== undefined && typeof watch.fallback !== 'string') {
      throw new Error('watch.fallback 必须是字符串');
    }
    if (watch.state !== undefined && typeof watch.state !== 'string') {
      throw new Error('watch.state 必须是字符串');
    }
  }
  safeRelative(manifest.preview);
  if (path.posix.extname(manifest.preview).toLowerCase() !== '.png') throw new Error('preview 必须是 PNG');
  if (!manifest.animations || typeof manifest.animations !== 'object' || Array.isArray(manifest.animations)) {
    throw new Error('animations 缺失');
  }

  function validateAnimation(action, expected) {
    const animation = manifest.animations[action];
    if (!animation || typeof animation !== 'object' || Array.isArray(animation)) {
      throw new Error(`${action} 动画配置不合法`);
    }
    if (!Array.isArray(animation.frames)
      || (expected === undefined ? animation.frames.length < 1 : animation.frames.length !== expected)) {
      throw new Error(expected === undefined
        ? `${action} 必须包含至少 1 帧`
        : `${action} 必须包含 ${expected} 帧`);
    }
    if (!Array.isArray(animation.durations) || animation.durations.length !== animation.frames.length) {
      throw new Error(`${action} 的 durations 数量不匹配`);
    }
    if (animation.durations.some((value) => !Number.isInteger(value) || value < 40 || value > 10000)) {
      throw new Error(`${action} 存在非法帧时长`);
    }
    if (animation.scale !== undefined && (!Number.isFinite(animation.scale) || animation.scale < 0.5 || animation.scale > 1.5)) {
      throw new Error(`${action} 的 scale 必须在 0.5 到 1.5 之间`);
    }
    for (const frame of animation.frames) {
      safeRelative(frame);
      if (path.posix.extname(frame).toLowerCase() !== '.png') throw new Error(`${action} 的帧必须是 PNG`);
    }
  }

  const validatedAnimations = new Set();
  for (const [action, expected] of Object.entries(REQUIRED_ACTIONS)) {
    validateAnimation(action, expected);
    validatedAnimations.add(action);
  }

  if (manifest.interactionActions !== undefined) {
    if (!manifest.interactionActions || typeof manifest.interactionActions !== 'object' || Array.isArray(manifest.interactionActions)) {
      throw new Error('interactionActions 必须是对象');
    }
    for (const [role, config] of Object.entries(manifest.interactionActions)) {
      if (!INTERACTION_ROLES.has(role) || !config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('interactionActions 包含不支持的角色');
      }
      if (typeof config.action !== 'string' || !Object.hasOwn(manifest.animations, config.action)) {
        throw new Error(`interactionActions 引用了不存在的动画：${config.action}`);
      }
      if (!validatedAnimations.has(config.action)) {
        validateAnimation(config.action);
        validatedAnimations.add(config.action);
      }
      if (config.anchor !== undefined) {
        const { x, y } = config.anchor || {};
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
          throw new Error(`interactionActions ${role} 的 anchor 必须位于 0..1`);
        }
      }
    }
  }

  if (manifest.sequences !== undefined) {
    if (!manifest.sequences || typeof manifest.sequences !== 'object' || Array.isArray(manifest.sequences)) {
      throw new Error('sequences 必须是对象');
    }
    const sequenceIds = Object.keys(manifest.sequences);
    if (sequenceIds.length > MAX_SEQUENCES) {
      throw new Error(`sequences 最多包含 ${MAX_SEQUENCES} 条`);
    }
    const seenSequenceIds = new Set();
    for (const sequenceId of sequenceIds) {
      if (!SEQUENCE_ID_PATTERN.test(sequenceId) || seenSequenceIds.has(sequenceId)) {
        throw new Error('sequences key 不合法或重复');
      }
      seenSequenceIds.add(sequenceId);
      const sequence = manifest.sequences[sequenceId];
      if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence)) {
        throw new Error(`sequences.${sequenceId} 配置格式不正确`);
      }
      const { stages } = sequence;
      if (!Array.isArray(stages) || stages.length < 2 || stages.length > 16) {
        throw new Error(`sequences.${sequenceId}.stages 必须包含 2 到 16 个阶段`);
      }
      for (let index = 0; index < stages.length; index += 1) {
        const stage = stages[index];
        if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
          throw new Error(`sequences.${sequenceId}.stages[${index}] 配置格式不正确`);
        }
        if (typeof stage.action !== 'string' || !Object.hasOwn(manifest.animations, stage.action)) {
          throw new Error(`sequences.${sequenceId}.stages[${index}] 引用了不存在的动画：${stage.action}`);
        }
        if (!validatedAnimations.has(stage.action)) {
          validateAnimation(stage.action);
          validatedAnimations.add(stage.action);
        }
        if (stage.message !== undefined && (typeof stage.message !== 'string' || stage.message.length > 80)) {
          throw new Error(`sequences.${sequenceId}.stages[${index}].message 不能超过 80 个字符`);
        }
        if (stage.messages !== undefined) {
          if (!Array.isArray(stage.messages) || stage.messages.length < 1 || stage.messages.length > 4) {
            throw new Error(`sequences.${sequenceId}.stages[${index}].messages 必须包含 1 到 4 条字符串`);
          }
          if (stage.messages.some((value) => typeof value !== 'string' || value.length > 80)) {
            throw new Error(`sequences.${sequenceId}.stages[${index}].messages 每条不能超过 80 个字符`);
          }
        }
        if (stage.messageGapMs !== undefined && (!Number.isInteger(stage.messageGapMs) || stage.messageGapMs < 0 || stage.messageGapMs > 5000)) {
          throw new Error(`sequences.${sequenceId}.stages[${index}].messageGapMs 必须为 0 到 5000 毫秒`);
        }
        if (stage.duration !== undefined && (!Number.isInteger(stage.duration) || stage.duration < 0 || stage.duration > 10000)) {
          throw new Error(`sequences.${sequenceId}.stages[${index}].duration 必须为 0 到 10000 毫秒`);
        }
        if (stage.waitForClick !== undefined && typeof stage.waitForClick !== 'boolean') {
          throw new Error(`sequences.${sequenceId}.stages[${index}].waitForClick 必须是布尔值`);
        }
      }
    }
  }

  if (manifest.contextMenuActions !== undefined) {
    if (!Array.isArray(manifest.contextMenuActions) || manifest.contextMenuActions.length > 8) {
      throw new Error('contextMenuActions 必须是最多 8 项的数组');
    }
    const actionIds = new Set();
    for (const item of manifest.contextMenuActions) {
      if (!item || typeof item !== 'object') throw new Error('右键动作配置格式不正确');
      if (!SEQUENCE_ID_PATTERN.test(String(item.id || '')) || actionIds.has(item.id)) {
        throw new Error('右键动作 id 不合法或重复');
      }
      actionIds.add(item.id);
      if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 24) throw new Error('右键动作 label 必须为 1 到 24 个字符');
      const hasAction = item.action !== undefined;
      const hasSequence = item.sequence !== undefined;
      const hasRandom = item.randomActions !== undefined;
      const triggerCount = Number(hasAction) + Number(hasSequence) + Number(hasRandom);
      if (triggerCount !== 1) {
        throw new Error('右键动作必须且只能包含 action、sequence 或 randomActions 之一');
      }
      if (hasSequence) {
        if (typeof item.sequence !== 'string' || !manifest.sequences || !Object.hasOwn(manifest.sequences, item.sequence)) {
          throw new Error('右键动作引用了不存在的序列：' + item.sequence);
        }
        if (item.message !== undefined) throw new Error('引用 sequence 的右键动作不能包含 message');
        if (item.duration !== undefined) throw new Error('引用 sequence 的右键动作不能包含 duration');
        if (item.speech !== undefined || item.speechAudio !== undefined) {
          throw new Error('引用 sequence 的右键动作不能包含 speech 或 speechAudio');
        }
      } else if (hasRandom) {
        if (!Array.isArray(item.randomActions) || item.randomActions.length < 2 || item.randomActions.length > 6) {
          throw new Error('randomActions 必须包含 2 到 6 个选项');
        }
        if (item.message !== undefined || item.duration !== undefined || item.speech !== undefined || item.speechAudio !== undefined) {
          throw new Error('引用 randomActions 的右键动作不能包含 message、duration、speech 或 speechAudio');
        }
        for (const choice of item.randomActions) {
          if (!choice || typeof choice !== 'object') throw new Error('randomActions 选项格式不正确');
          const choiceHasAction = choice.action !== undefined;
          const choiceHasSequence = choice.sequence !== undefined;
          if (choiceHasAction === choiceHasSequence) {
            throw new Error('randomActions 每个选项必须且只能包含 action 或 sequence 之一');
          }
          if (choiceHasSequence) {
            if (typeof choice.sequence !== 'string' || !manifest.sequences || !Object.hasOwn(manifest.sequences, choice.sequence)) {
              throw new Error('randomActions 引用了不存在的序列：' + choice.sequence);
            }
            if (choice.message !== undefined || choice.duration !== undefined || choice.speech !== undefined || choice.speechAudio !== undefined) {
              throw new Error('randomActions 的 sequence 选项不能包含 message、duration、speech 或 speechAudio');
            }
            continue;
          }
          if (typeof choice.action !== 'string' || !manifest.animations[choice.action]) {
            throw new Error('randomActions 引用了不存在的动画：' + choice.action);
          }
          if (!validatedAnimations.has(choice.action)) {
            validateAnimation(choice.action);
            validatedAnimations.add(choice.action);
          }
          if (choice.message !== undefined && (typeof choice.message !== 'string' || choice.message.length > 80)) {
            throw new Error('randomActions message 不能超过 80 个字符');
          }
          if (choice.duration !== undefined && (!Number.isInteger(choice.duration) || choice.duration < 600 || choice.duration > 10000)) {
            throw new Error('randomActions duration 必须为 600 到 10000 毫秒');
          }
          if (choice.speech !== undefined && (typeof choice.speech !== 'string' || choice.speech.length > 20)) {
            throw new Error('randomActions speech 不能超过 20 个字符');
          }
          if (choice.speechAudio !== undefined) {
            if (typeof choice.speechAudio !== 'string' || !choice.speechAudio) throw new Error('randomActions speechAudio 路径不合法');
            safeRelative(choice.speechAudio);
            if (!AUDIO_EXTENSIONS.has(path.posix.extname(choice.speechAudio).toLowerCase())) {
              throw new Error('randomActions speechAudio 只支持 mp3/wav/ogg');
            }
          }
        }
      } else {
        if (typeof item.action !== 'string' || !manifest.animations[item.action]) throw new Error('右键动作引用了不存在的动画：' + item.action);
        if (!validatedAnimations.has(item.action)) {
          validateAnimation(item.action);
          validatedAnimations.add(item.action);
        }
        if (item.message !== undefined && (typeof item.message !== 'string' || item.message.length > 80)) throw new Error('右键动作 message 不能超过 80 个字符');
        if (item.duration !== undefined && (!Number.isInteger(item.duration) || item.duration < 600 || item.duration > 10000)) throw new Error('右键动作 duration 必须为 600 到 10000 毫秒');
      }
      if (!hasRandom) {
        if (item.speech !== undefined && (typeof item.speech !== 'string' || item.speech.length > 20)) throw new Error('右键动作 speech 不能超过 20 个字符');
        if (item.speechAudio !== undefined) {
          if (typeof item.speechAudio !== 'string' || !item.speechAudio) throw new Error('右键动作 speechAudio 路径不合法');
          safeRelative(item.speechAudio);
          if (!AUDIO_EXTENSIONS.has(path.posix.extname(item.speechAudio).toLowerCase())) {
            throw new Error('右键动作 speechAudio 只支持 mp3/wav/ogg');
          }
        }
      }
    }
  }

  function validateBehaviorList(list, label) {
    if (!Array.isArray(list) || !list.length || list.length > 20) {
      throw new Error(`${label} 必须是 1 到 20 项的数组`);
    }
    for (const item of list) {
      if (!item || typeof item !== 'object' || !manifest.animations[item.state]) throw new Error(`${label} 引用了不存在的动画`);
      if (!validatedAnimations.has(item.state)) {
        validateAnimation(item.state);
        validatedAnimations.add(item.state);
      }
      if (!Number.isFinite(item.weight) || item.weight <= 0 || item.weight > 10000) throw new Error(`${label} weight 不合法`);
      if (!Number.isFinite(item.minDuration) || !Number.isFinite(item.maxDuration) || item.minDuration < 600 || item.maxDuration > 60000 || item.maxDuration < item.minDuration) {
        throw new Error(`${label} duration 不合法`);
      }
      if (item.message !== undefined && (typeof item.message !== 'string' || item.message.length > 80)) {
        throw new Error(`${label} message 不能超过 80 个字符`);
      }
      if (item.speech !== undefined && (typeof item.speech !== 'string' || item.speech.length > 20)) {
        throw new Error(`${label} speech 不能超过 20 个字符`);
      }
      if (item.speechAudio !== undefined) {
        if (typeof item.speechAudio !== 'string' || !item.speechAudio) throw new Error(`${label} speechAudio 路径不合法`);
        safeRelative(item.speechAudio);
        if (!AUDIO_EXTENSIONS.has(path.posix.extname(item.speechAudio).toLowerCase())) {
          throw new Error(`${label} speechAudio 只支持 mp3/wav/ogg`);
        }
      }
    }
  }

  if (manifest.behavior?.random !== undefined) {
    validateBehaviorList(manifest.behavior.random, 'behavior.random');
  }
  if (manifest.behavior?.perched !== undefined) {
    validateBehaviorList(manifest.behavior.perched, 'behavior.perched');
  }

  if (requireFiles) {
    for (const relative of referencedFiles(manifest)) {
      if (relative === 'pet.json') continue;
      if (!fs.statSync(resolveInside(root, relative), { throwIfNoEntry: false })?.isFile()) throw new Error(`资源缺失：${relative}`);
    }
  }
  return manifest;
}

function validatePngEntry(entry, relative) {
  const size = Number(entry.header?.size || 0);
  if (size <= 0 || size > MAX_ASSET_BYTES) throw new Error(`PNG 文件大小不合法：${relative}`);
  const data = entry.getData();
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (data.length < 33 || !data.subarray(0, 8).equals(signature) || data.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`不是有效 PNG：${relative}`);
  }
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const colorType = data[25];
  if (!width || !height || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    throw new Error(`PNG 尺寸超限：${relative}`);
  }
  if (![4, 6].includes(colorType)) throw new Error(`PNG 必须包含 alpha 通道：${relative}`);
}

function validatePetpack(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  if (!entries.length || entries.length > MAX_ARCHIVE_ENTRIES) throw new Error('资源包文件数量不合法');
  const canonicalNames = new Set();
  const files = new Map();
  let total = 0;
  for (const entry of entries) {
    const raw = String(entry.entryName || '');
    const name = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    safeRelative(name);
    const canonical = name.toLowerCase();
    if (canonicalNames.has(canonical)) throw new Error(`资源包包含重复或大小写冲突路径：${name}`);
    canonicalNames.add(canonical);
    const size = Number(entry.header?.size || 0);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`资源大小不合法：${name}`);
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) throw new Error('资源包解压后不能超过 200MB');
    if (!entry.isDirectory) files.set(name, entry);
  }

  const manifestEntry = files.get('pet.json');
  if (!manifestEntry) throw new Error('资源包缺少 pet.json');
  if (Number(manifestEntry.header?.size || 0) > MAX_MANIFEST_BYTES) throw new Error('pet.json 不能超过 1MB');
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  } catch {
    throw new Error('pet.json 不是有效 JSON');
  }
  validateManifest(manifest);
  const allowed = referencedFiles(manifest);
  for (const name of files.keys()) {
    if (!allowed.has(name)) throw new Error(`资源包包含未引用文件：${name}`);
  }
  for (const relative of allowed) {
    const entry = files.get(relative);
    if (!entry) throw new Error(`资源包缺少文件：${relative}`);
    if (relative.endsWith('.png')) validatePngEntry(entry, relative);
    else if (AUDIO_EXTENSIONS.has(path.posix.extname(relative).toLowerCase())) {
      const size = Number(entry.header?.size || 0);
      if (size <= 0 || size > MAX_ASSET_BYTES) throw new Error(`音频文件大小不合法：${relative}`);
    }
  }
  return { zip, manifest, previewEntry: files.get(manifest.preview) };
}

module.exports = {
  MAX_ARCHIVE_ENTRIES,
  MAX_UNCOMPRESSED_BYTES,
  PET_ID_PATTERN,
  REQUIRED_ACTIONS,
  referencedFiles,
  resolveInside,
  safeRelative,
  validateManifest,
  validatePetpack
};
